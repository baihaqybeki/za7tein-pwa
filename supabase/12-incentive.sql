-- =============================================================================
-- Sa7tein — insentif merchant: modal (credit) + cashback (tier)
--   1) category cashback_tiers diselaraskan ke flow F9 (ambang ORDER + JOD),
--      dan di-seed (500/1000/1250 → 15/40/62,5 JOD).
--   2) tabel merchant_credit_events (jejak modal: grant / fee / rebate) + seed.
--   3) merchant_credits & deposits diisi untuk SEMUA merchant.
-- Aditif & idempoten. Sumber: flow f9-incentive + src/data/incentive.ts.
-- =============================================================================

begin;

-- 1) cashback_tiers: tambah kolom sesuai flow (ambang order + nominal JOD)
alter table public.cashback_tiers add column if not exists threshold_orders integer;
alter table public.cashback_tiers add column if not exists amount_jod numeric(12, 3);
-- flow memakai ambang ORDER, bukan volume JOD → longgarkan min_volume_jod
alter table public.cashback_tiers alter column min_volume_jod drop not null;

insert into public.cashback_tiers (tier, min_volume_jod, threshold_orders, amount_jod, pct) values
  ('tier_1', null,  500, 15.0, 0.12),
  ('tier_2', null, 1000, 40.0, 0.11),
  ('tier_3', null, 1250, 62.5, 0.10)
on conflict (tier) do update
  set threshold_orders = excluded.threshold_orders,
      amount_jod = excluded.amount_jod,
      pct = excluded.pct;

-- 2) jejak modal merchant
create table if not exists public.merchant_credit_events (
  id          bigint generated always as identity primary key,
  merchant_id bigint not null references public.merchants (id) on delete cascade,
  event       text not null check (event in ('merchant_credit_granted', 'credit_fee_deducted', 'rebate_tier_reached', 'rebate_paid')),
  amount_jod  numeric(12, 3) not null default 0,
  at          timestamptz not null default now()
);
create index if not exists merchant_credit_events_merchant_idx on public.merchant_credit_events (merchant_id, at desc);

alter table public.merchant_credit_events enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchant_credit_events' and policyname='mce_owner') then
    create policy mce_owner on public.merchant_credit_events for select to public
      using (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='merchant_credit_events' and policyname='mce_ops') then
    create policy mce_ops on public.merchant_credit_events for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- 3) merchant_credits + deposits + events untuk SEMUA merchant
do $$
declare mid int;
begin
  for mid in 1..9 loop
    insert into public.merchant_credits (merchant_id, balance_jod, non_withdrawable, rebate_tier, rebate_period, rebate_amount_jod)
    values (mid, 5, true, case when mid = 5 then 'tier_2' else 'tier_1' end, '2026-10', case when mid = 5 then 40 else 15 end)
    on conflict (merchant_id) do nothing;

    if not exists (select 1 from public.deposits where merchant_id = mid and kind = 'founding_credit') then
      insert into public.deposits (merchant_id, kind, amount_jod, status) values (mid, 'founding_credit', 5, 'held');
    end if;
    if not exists (select 1 from public.deposits where merchant_id = mid and kind = 'cod') then
      insert into public.deposits (merchant_id, kind, amount_jod, status) values (mid, 'cod', 3.5, 'held');
    end if;

    if not exists (select 1 from public.merchant_credit_events where merchant_id = mid and event = 'merchant_credit_granted') then
      insert into public.merchant_credit_events (merchant_id, event, amount_jod) values (mid, 'merchant_credit_granted', 5);
    end if;
    if not exists (select 1 from public.merchant_credit_events where merchant_id = mid and event = 'credit_fee_deducted') then
      insert into public.merchant_credit_events (merchant_id, event, amount_jod) values (mid, 'credit_fee_deducted', -1.5);
    end if;
    if not exists (select 1 from public.merchant_credit_events where merchant_id = mid and event = 'rebate_tier_reached') then
      insert into public.merchant_credit_events (merchant_id, event, amount_jod)
        values (mid, 'rebate_tier_reached', case when mid = 5 then 40 else 15 end);
    end if;
  end loop;
end $$;

commit;
