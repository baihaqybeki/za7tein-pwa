-- =============================================================================
-- Sa7tein — AP7.2 realtime notif/checkpoint, AP4.5 catatan menu, AP10.2 ops view,
-- helper notifikasi server (G3)
-- Sumber: api-spec §4 G3/G9, §5.7, §8, §17.3.1.
-- =============================================================================

begin;

-- ── AP7.2 (G9): publikasikan notifications + checkpoints ke Realtime ────────
do $$
declare t text;
begin
  foreach t in array array['notifications', 'checkpoints', 'orders', 'merchants', 'disputes', 'batches'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ── AP4.5: catatan menu & order (note_enabled) ──────────────────────────────
alter table public.menus add column if not exists note_enabled boolean not null default false;
alter table public.order_items add column if not exists note text;

-- ── Helper notifikasi (G3): recipient dari relasi order, bukan id hardcode ───
create or replace function public.emit_notification(
  p_user bigint, p_kind text, p_title text, p_body text default null,
  p_audience text default 'customer', p_order bigint default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.notifications (user_id, kind, title, body, audience, order_id)
    values (p_user, p_kind, p_title, p_body, p_audience, p_order)
    returning id into v_id;
  return v_id;
end $$;

-- ── AP7.3 (G3): alert CS saat order batal setelah match / dispute dibuka ────
create or replace function public.notify_cs_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'canceled' and old.status in ('waitingCourier', 'waitingDelivery', 'delivery') then
    for r in select id from public.users where role in ('cs', 'superadmin') loop
      perform public.emit_notification(r.id, 'order', 'Order dibatalkan setelah match', new.code, 'cs', new.id);
    end loop;
  end if;
  return new;
end $$;
drop trigger if exists orders_notify_cs_cancel on public.orders;
create trigger orders_notify_cs_cancel after update on public.orders
  for each row execute function public.notify_cs_on_cancel();

-- ── AP10.2: view pendapatan harian ops ──────────────────────────────────────
create or replace view public.ops_revenue_daily as
select date_trunc('day', coalesce(o.paid_at, o.created_at))::date as day,
       count(*) filter (where o.status = 'done') as orders_done,
       coalesce(sum(o.transaction_fee_jod) filter (where o.status = 'done'), 0) as transaction_fee_jod,
       coalesce(sum(l.amount_jod) filter (where l.party = 'applicator' and l.entry_type = 'fee'), 0) as applicator_fee_jod
from public.orders o
left join public.enterprise_ledger l on l.order_id = o.id
group by 1
order by 1 desc;

commit;
