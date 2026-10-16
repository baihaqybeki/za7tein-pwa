-- =============================================================================
-- Sa7tein — AP1.3 katalog atribut/variant, AP8 rating, AP9.2 dispute lifecycle
-- Sumber: api-spec §17.3.6, §17.3.7, §4 G5, §5.9 (berbasis PRD aktif).
-- =============================================================================

begin;

-- ── AP1.3 katalog atribut ala Odoo (§14, R-MER-CATALOG) ─────────────────────
create table if not exists public.product_attributes (
  id bigserial primary key,
  name text not null,
  display_type text not null default 'pills' check (display_type in ('radio', 'pills', 'select', 'color', 'multi')),
  create_variant text not null default 'always' check (create_variant in ('always', 'dynamic', 'no_variant')),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.product_attribute_values (
  id bigserial primary key,
  attribute_id bigint not null references public.product_attributes (id) on delete cascade,
  name text not null,
  html_color text,
  price_extra numeric(12, 3) not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists pav_attribute_idx on public.product_attribute_values (attribute_id);

-- Baris atribut pada satu menu; exclude_for = id nilai yang dilarang untuk menu ini.
create table if not exists public.menu_attribute_lines (
  id bigserial primary key,
  menu_id bigint not null references public.menus (id) on delete cascade,
  attribute_id bigint not null references public.product_attributes (id) on delete cascade,
  required boolean not null default false,
  exclude_for jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  unique (menu_id, attribute_id)
);
create index if not exists mal_menu_idx on public.menu_attribute_lines (menu_id);

alter table public.product_attributes enable row level security;
alter table public.product_attribute_values enable row level security;
alter table public.menu_attribute_lines enable row level security;
drop policy if exists product_attributes_read on public.product_attributes;
create policy product_attributes_read on public.product_attributes for select using (is_active);
drop policy if exists product_attributes_ops on public.product_attributes;
create policy product_attributes_ops on public.product_attributes for all using (public.app_is_ops());
drop policy if exists pav_read on public.product_attribute_values;
create policy pav_read on public.product_attribute_values for select using (true);
drop policy if exists pav_ops on public.product_attribute_values;
create policy pav_ops on public.product_attribute_values for all using (public.app_is_ops());
drop policy if exists mal_read on public.menu_attribute_lines;
create policy mal_read on public.menu_attribute_lines for select using (true);
drop policy if exists mal_merchant on public.menu_attribute_lines;
create policy mal_merchant on public.menu_attribute_lines for all
  using (menu_id in (select id from public.menus where merchant_id in (select id from public.merchants where user_id = public.app_uid())))
  with check (menu_id in (select id from public.menus where merchant_id in (select id from public.merchants where user_id = public.app_uid())));
drop policy if exists mal_ops on public.menu_attribute_lines;
create policy mal_ops on public.menu_attribute_lines for all using (public.app_is_ops());

insert into public.product_attributes (name, display_type, create_variant, sort_order)
  select 'Ukuran', 'pills', 'always', 1 where not exists (select 1 from public.product_attributes where name = 'Ukuran');
insert into public.product_attribute_values (attribute_id, name, price_extra, sort_order)
  select a.id, v.name, v.extra, v.ord from public.product_attributes a
  cross join (values ('Biasa', 0, 1), ('Jumbo', 0.5, 2)) as v(name, extra, ord)
  where a.name = 'Ukuran' and not exists (select 1 from public.product_attribute_values pav where pav.attribute_id = a.id);
insert into public.product_attributes (name, display_type, create_variant, sort_order)
  select 'Level Pedas', 'radio', 'no_variant', 2 where not exists (select 1 from public.product_attributes where name = 'Level Pedas');
insert into public.product_attribute_values (attribute_id, name, price_extra, sort_order)
  select a.id, v.name, 0, v.ord from public.product_attributes a
  cross join (values ('Tidak pedas', 1), ('Sedang', 2), ('Pedas', 3)) as v(name, ord)
  where a.name = 'Level Pedas' and not exists (select 1 from public.product_attribute_values pav where pav.attribute_id = a.id);

-- ── AP8 rating & review (§5.9, R-CUS-RATING) ────────────────────────────────
create or replace function public.submit_review(
  p_order bigint, p_customer bigint, p_rating integer, p_review text default null,
  p_merchant_id bigint default null, p_menu_id bigint default null
) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  if p_rating < 1 or p_rating > 5 then raise exception 'rating harus 1..5'; end if;
  if (p_merchant_id is not null) = (p_menu_id is not null) then
    raise exception 'isi tepat satu dari merchant_id atau menu_id';
  end if;
  insert into public.rating_reviews (order_id, customer_id, merchant_id, menu_id, rating, review)
    values (p_order, p_customer, p_merchant_id, p_menu_id, p_rating, p_review)
    on conflict do nothing
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.reply_review(p_review bigint, p_body text)
returns bigint language plpgsql as $$
declare v_id bigint; v_merchant bigint;
begin
  select merchant_id into v_merchant from public.rating_reviews where id = p_review;
  if v_merchant is null then raise exception 'review % bukan ulasan merchant / tidak ada', p_review; end if;
  if not public.app_is_ops() and v_merchant not in (select id from public.merchants where user_id = public.app_uid()) then
    raise exception 'hanya pemilik merchant yang boleh membalas';
  end if;
  insert into public.review_replies (review_id, merchant_id, body) values (p_review, v_merchant, p_body)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.refresh_merchant_rating()
returns trigger language plpgsql as $$
begin
  if new.merchant_id is not null then
    update public.merchants m set
      rating_avg = (select round(avg(rating)::numeric, 2) from public.rating_reviews where merchant_id = new.merchant_id and deleted_at is null),
      rating_count = (select count(*) from public.rating_reviews where merchant_id = new.merchant_id and deleted_at is null)
    where m.id = new.merchant_id;
  end if;
  return new;
end $$;
drop trigger if exists rating_reviews_refresh on public.rating_reviews;
create trigger rating_reviews_refresh after insert or update on public.rating_reviews
  for each row execute function public.refresh_merchant_rating();

-- ── AP9.2 dispute lifecycle (§4 G5, §5.8, R-DISPUTE-RULE) ───────────────────
-- Selaras enum existing: resolution ∈ refund_customer|refund_order|resettle|no_action;
-- status ∈ open|investigating|resolved|rejected (+ appealed); type ∈ late|missing|wrong|not_delivered|payment_failed.
alter table public.disputes add column if not exists category text;
alter table public.disputes add column if not exists filed_role text;
alter table public.disputes add column if not exists photos jsonb not null default '[]'::jsonb;
alter table public.disputes add column if not exists resolution_note text;

alter table public.disputes drop constraint if exists disputes_status_check;
alter table public.disputes add constraint disputes_status_check
  check (status in ('open', 'investigating', 'resolved', 'rejected', 'appealed'));

create or replace function public.open_dispute(
  p_order bigint, p_filed_by bigint, p_filed_role text, p_category text, p_reason text default null
) returns bigint language plpgsql as $$
declare v_id bigint; v_type text;
begin
  v_type := case when p_category in ('late', 'missing', 'wrong', 'not_delivered', 'payment_failed')
              then p_category else 'late' end;
  insert into public.disputes (order_id, opened_by, filed_role, category, type, status, resolution_note)
    values (p_order, p_filed_by, p_filed_role, p_category, v_type, 'open', p_reason)
    returning id into v_id;
  return v_id;
end $$;

create or replace function public.resolve_dispute(
  p_dispute bigint, p_resolution text, p_actor bigint, p_note text default null, p_refund_jod numeric default 0
) returns void language plpgsql as $$
declare v_order bigint; v_status text;
begin
  if p_resolution not in ('refund_customer', 'refund_order', 'resettle', 'no_action') then
    raise exception 'resolusi tidak valid';
  end if;
  v_status := case when p_resolution = 'no_action' then 'rejected' else 'resolved' end;
  update public.disputes set status = v_status, resolution = p_resolution, resolution_note = p_note,
         refund_amount_jod = coalesce(p_refund_jod, 0), resolved_by = p_actor, resolved_at = now()
    where id = p_dispute
    returning order_id into v_order;
  if v_order is not null and coalesce(p_refund_jod, 0) > 0 then
    insert into public.enterprise_ledger (order_id, entry_type, party, amount_jod, amount_idr, idempotency_key, note)
      values (v_order, 'refund', 'customer', p_refund_jod, 0, 'dispute:' || p_dispute || ':refund', 'kompensasi dispute')
      on conflict (idempotency_key) do nothing;
  end if;
end $$;

create or replace function public.appeal_dispute(p_dispute bigint, p_actor bigint)
returns void language plpgsql as $$
begin
  update public.disputes set status = 'appealed' where id = p_dispute and status in ('resolved', 'rejected');
  if not found then raise exception 'hanya dispute yang sudah diputus bisa dibanding'; end if;
end $$;

commit;
