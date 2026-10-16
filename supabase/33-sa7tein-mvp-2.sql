-- =============================================================================
-- Sa7tein — PRD aktif tahap lanjut: discovery (M2), marketing (M8),
-- dispute snapshot (M10), chat retention (M11)
-- =============================================================================

begin;

-- ── Tag merchant (§10, MER-02; group hanya berdasarkan tag — OPEN-22) ────────
create table if not exists public.merchant_tags (
  id bigserial primary key,
  merchant_id bigint not null references public.merchants (id) on delete cascade,
  tag text not null,
  proposed boolean not null default false,
  approved boolean not null default true,
  created_at timestamptz not null default now(),
  unique (merchant_id, tag)
);
alter table public.merchant_tags enable row level security;
drop policy if exists merchant_tags_public_read on public.merchant_tags;
create policy merchant_tags_public_read on public.merchant_tags for select using (approved);
drop policy if exists merchant_tags_owner on public.merchant_tags;
create policy merchant_tags_owner on public.merchant_tags for all
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
drop policy if exists merchant_tags_ops on public.merchant_tags;
create policy merchant_tags_ops on public.merchant_tags for all using (public.app_is_ops());

insert into public.merchant_tags (merchant_id, tag)
select m.id, t.tag from public.merchants m
cross join lateral (values ('makanan'), ('minuman')) as t(tag)
on conflict do nothing;

-- ── Discovery (M2, CUS-04..09): browse dalam coverage + tag + sembunyi kuota ──
create or replace function public.browse_merchants(
  p_lat double precision default null,
  p_lng double precision default null,
  p_tag text default null,
  p_q text default null,
  p_sort text default 'distance',
  p_limit integer default 50
) returns table (
  id bigint, store_name text, description text, photo text,
  latitude double precision, longitude double precision,
  rating_avg numeric, rating_count integer, store_status text,
  distance_m double precision, order_count bigint
) language sql stable as $$
  select m.id, m.store_name, m.description, m.photo, m.latitude, m.longitude,
         m.rating_avg, m.rating_count, m.store_status,
         case when p_lat is not null and m.latitude is not null
              then public.haversine_m(p_lat, p_lng, m.latitude, m.longitude) end as distance_m,
         (select count(*) from public.orders o where o.merchant_id = m.id) as order_count
  from public.merchants m
  where m.tenant_status = 'approved'
    and (p_q is null or m.store_name ilike '%' || p_q || '%' or m.description ilike '%' || p_q || '%')
    and (p_tag is null or exists (select 1 from public.merchant_tags t where t.merchant_id = m.id and t.tag = p_tag and t.approved))
    and (p_lat is null or public.check_coverage(m.id, p_lat, p_lng))
    and (
      m.accept_without_quota
      or exists (select 1 from public.quota_subscriptions qs
                 where qs.merchant_id = m.id and qs.status = 'active'
                   and (qs.period_end is null or qs.period_end > now())
                   and (qs.quota_total - qs.quota_used - qs.quota_reserved) > 0)
    )
  order by
    case when p_sort = 'rating' then m.rating_avg end desc nulls last,
    case when p_sort = 'distance' and p_lat is not null
         then public.haversine_m(p_lat, p_lng, m.latitude, m.longitude) end asc nulls last,
    m.rating_avg desc nulls last
  limit p_limit
$$;

-- ── Marketing: hitung Dm & Da (§15, M8, OPEN-23) ────────────────────────────
-- Aturan sederhana hingga OPEN-23 diputuskan: per program reward = percent×subtotal
-- atau value_jod; non-stackable terbaik dipilih satu, stackable dijumlahkan.
create or replace function public.compute_discounts(
  p_merchant bigint, p_subtotal_jod numeric
) returns jsonb language plpgsql stable as $$
declare dm numeric := 0; da numeric := 0; r record;
begin
  for r in
    select mp.owner, mp.is_stackable,
           greatest(
             coalesce((select max(mr.value_jod) from public.marketing_rewards mr where mr.program_id = mp.id), 0),
             coalesce((select max(mr.percent) from public.marketing_rewards mr where mr.program_id = mp.id), 0) / 100.0 * p_subtotal_jod
           ) as reward
    from public.marketing_programs mp
    where mp.active
      and (mp.active_from is null or mp.active_from <= now())
      and (mp.active_to is null or mp.active_to >= now())
      and (mp.max_uses is null or mp.used_count < mp.max_uses)
      and (mp.owner = 'applicator' or mp.merchant_id = p_merchant)
  loop
    if r.is_stackable then
      if r.owner = 'merchant' then dm := dm + r.reward; else da := da + r.reward; end if;
    else
      if r.owner = 'merchant' then dm := greatest(dm, r.reward); else da := greatest(da, r.reward); end if;
    end if;
  end loop;
  return jsonb_build_object('discount_merchant_jod', dm, 'discount_applicator_jod', da);
end $$;

insert into public.marketing_programs (owner, name, program_type, is_stackable, active)
  select 'applicator', 'Diskon Aplikator 0,3 JOD', 'discount', false, true
  where not exists (select 1 from public.marketing_programs where owner = 'applicator');
insert into public.marketing_rewards (program_id, reward_type, value_jod)
  select p.id, 'discount', 0.3 from public.marketing_programs p
  where p.owner = 'applicator' and not exists (select 1 from public.marketing_rewards r where r.program_id = p.id);
insert into public.marketing_programs (owner, merchant_id, name, program_type, is_stackable, active)
  select 'merchant', m.id, 'Diskon Toko 0,5 JOD', 'discount', false, true
  from public.merchants m
  where not exists (select 1 from public.marketing_programs p where p.merchant_id = m.id);
insert into public.marketing_rewards (program_id, reward_type, value_jod)
  select p.id, 'discount', 0.5 from public.marketing_programs p
  where p.owner = 'merchant' and not exists (select 1 from public.marketing_rewards r where r.program_id = p.id);

-- ── Dispute: snapshot rule ke order (§18, M10) ──────────────────────────────
alter table public.orders add column if not exists dispute_rule_ids jsonb not null default '[]'::jsonb;

create or replace function public.snapshot_dispute_rules(p_order bigint)
returns void language plpgsql as $$
declare v_merchant bigint;
begin
  select merchant_id into v_merchant from public.orders where id = p_order;
  update public.orders
    set dispute_rule_ids = coalesce(
      (select jsonb_agg(rule_id) from public.merchant_dispute_rules where merchant_id = v_merchant), '[]'::jsonb)
    where id = p_order;
end $$;

-- ── Chat retention (M11, OPEN-20) ───────────────────────────────────────────
alter table public.chats add column if not exists auto_close_at timestamptz;
alter table public.chats add column if not exists closed_at timestamptz;

commit;
