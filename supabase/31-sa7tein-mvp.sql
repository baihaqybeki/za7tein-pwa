-- =============================================================================
-- Sa7tein — pemetaan PRD aktif `sa7tein-mvp-2026-10-11` ke Supabase
-- (marketplace Yordania: JOD, Regular/Quick, batch <=24, DANA, kuota langganan,
--  marketing ala Odoo, dispute rule + SP, coverage polygon, refund)
-- =============================================================================
-- Sumber: docs/product/prd/versions/sa7tein-mvp-2026-10-11/{analysis,milestones}.md
--         docs/product/prd/decision-sa7tein-mvp.md
--         docs/backend/PRD-MAPPING-sa7tein-mvp.md
--
-- DEVIASI DISETUJUI (2026-10-16): backend tetap Supabase, BUKAN Cloudflare
-- Workers + Durable Objects (ARC-01..13). ARC-04/05 (Global Index DO) dan
-- OPEN-25 tidak diberlakukan; query lintas entitas memakai Postgres.
-- Tandai UNRESOLVED pada tiap tempat ARC disebut.
--
-- Sifat: ADITIF / AMAN. `add column if not exists`, `create table if not exists`.
-- Tidak menghapus data. Satu-satunya update nilai: normalisasi `payment_method`
-- legacy -> himpunan PRD aktif.
--
-- OPEN-01 (DANA) masih terbuka: kolom pembayaran/payout disiapkan sebagai state,
-- tidak ada integrasi pembayaran sungguhan (AGENTS.md §1).
-- =============================================================================

begin;

-- ── Kurs (NFR-03, OPEN-02) ──────────────────────────────────────────────────
alter table public.exchange_rates add column if not exists effective_on date;
alter table public.exchange_rates add column if not exists updated_at timestamptz not null default now();
create unique index if not exists exchange_rates_pair_day_uidx
  on public.exchange_rates (base, quote, effective_on);
create unique index if not exists exchange_rates_pair_latest_uidx
  on public.exchange_rates (base, quote, fetched_at desc);
insert into public.exchange_rates (base, quote, rate, source, effective_on)
  select 'JOD', 'IDR', 23000, 'seed', current_date
  where not exists (select 1 from public.exchange_rates);

-- ── Role kurir & setelan merchant (§9, ACC-03, MER) ─────────────────────────
alter table public.couriers add column if not exists courier_type text not null default 'inhouse';
alter table public.couriers drop constraint if exists couriers_type_check;
alter table public.couriers add constraint couriers_type_check
  check (courier_type in ('inhouse', 'partner'));

alter table public.merchants add column if not exists accept_without_quota boolean not null default false;

-- ── Order: tipe, kuota, komponen harga PRD §16.3 (OPEN-26 untuk enum status) ─
alter table public.orders add column if not exists delivery_type text not null default 'regular';
alter table public.orders drop constraint if exists orders_delivery_type_check;
alter table public.orders add constraint orders_delivery_type_check
  check (delivery_type in ('regular', 'quick'));

alter table public.orders add column if not exists quota_kind_used text;
alter table public.orders drop constraint if exists orders_quota_kind_check;
alter table public.orders add constraint orders_quota_kind_check
  check (quota_kind_used is null or quota_kind_used in ('order', 'order_cod'));

alter table public.orders add column if not exists rate_locked numeric(18, 6);
alter table public.orders add column if not exists transaction_fee_jod numeric(12, 3) not null default 0;
alter table public.orders add column if not exists transaction_fee_idr bigint not null default 0;
alter table public.orders add column if not exists rounding_up_idr bigint not null default 0;
alter table public.orders add column if not exists platform_fee_customer_jod numeric(12, 3) not null default 0;
alter table public.orders add column if not exists platform_fee_merchant_jod numeric(12, 3) not null default 0;
alter table public.orders add column if not exists discount_merchant_jod numeric(12, 3) not null default 0;
alter table public.orders add column if not exists discount_applicator_jod numeric(12, 3) not null default 0;
alter table public.orders add column if not exists refund_status text;
alter table public.orders drop constraint if exists orders_refund_status_check;
alter table public.orders add constraint orders_refund_status_check
  check (refund_status is null or refund_status in ('none', 'pending', 'refunded', 'failed'));

-- ── Batch: rute auto-sort + batas 24 order (§9.6, MER-14) ────────────────────
alter table public.batches add column if not exists route jsonb;
alter table public.batches add column if not exists order_count integer not null default 0;

create or replace function public.enforce_batch_cap()
returns trigger language plpgsql as $$
declare
  cnt integer;
begin
  if new.batch_id is null then
    return new;
  end if;
  select count(*) into cnt from public.orders
   where batch_id = new.batch_id and id <> coalesce(new.id, -1);
  if cnt >= 24 then
    raise exception 'batch % sudah berisi 24 order (batas PRD §9.6)', new.batch_id;
  end if;
  return new;
end $$;

drop trigger if exists orders_batch_cap on public.orders;
create trigger orders_batch_cap before insert or update of batch_id on public.orders
  for each row execute function public.enforce_batch_cap();

-- ── Metode bayar PRD §16.2: QRIS, saldo DANA, COD (COD wajib kuota COD) ──────
alter table public.orders drop constraint if exists orders_payment_method_check;
update public.orders set payment_method = 'dana_balance' where payment_method in ('wallet', 'dana_va');
update public.orders set payment_method = 'qris' where payment_method not in ('qris', 'dana_balance', 'cod');
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('qris', 'dana_balance', 'cod'));

alter table public.payments drop constraint if exists payments_method_check;
update public.payments set method = 'dana_balance' where method in ('wallet', 'dana_va');
update public.payments set method = 'qris' where method not in ('qris', 'dana_balance', 'cod');
alter table public.payments add constraint payments_method_check
  check (method in ('qris', 'dana_balance', 'cod'));

alter table public.payment_methods drop constraint if exists payment_methods_provider_check;
alter table public.payment_methods add constraint payment_methods_provider_check
  check (provider in ('dana', 'none'));
delete from public.payment_methods where key not in ('qris', 'dana_balance', 'cod');
insert into public.payment_methods (key, label, provider, kind, fee_jod, description, sort_order) values
  ('qris',         'QRIS',              'dana', 'prepaid',  0, 'Scan QR dinamis (DANA, 30 menit) pakai aplikasi bank atau e-wallet apa pun. Dikenai transaction fee 1,5%.', 1),
  ('dana_balance', 'Bayar pakai DANA',  'dana', 'prepaid',  0, 'Bayar dari saldo akun DANA. Tanpa transaction fee. (OPEN-30: dihapus bila dikenai tarif + PPN.)', 2),
  ('cod',          'COD — Tunai',        'none', 'postpaid', 0, 'Bayar tunai JOD. Hanya tersedia bila merchant punya kuota order COD (MER-19).', 3)
on conflict (key) do update set
  label = excluded.label, provider = excluded.provider, kind = excluded.kind,
  fee_jod = excluded.fee_jod, description = excluded.description, sort_order = excluded.sort_order;

-- ── Coverage merchant (§9.1, MER-04) ────────────────────────────────────────
create table if not exists public.coverage_zones (
  id            bigserial primary key,
  merchant_id   bigint not null references public.merchants (id) on delete cascade,
  mode          text not null default 'radius' check (mode in ('radius', 'polygon')),
  center_lat    double precision,
  center_lng    double precision,
  radius_m      integer,
  polygon       jsonb,
  delivery_fee_jod numeric(12, 3) not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index if not exists coverage_zones_merchant_idx on public.coverage_zones (merchant_id);
alter table public.coverage_zones enable row level security;
drop policy if exists coverage_zones_public_read on public.coverage_zones;
create policy coverage_zones_public_read on public.coverage_zones for select using (true);
drop policy if exists coverage_zones_merchant on public.coverage_zones;
create policy coverage_zones_merchant on public.coverage_zones for all
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
drop policy if exists coverage_zones_ops on public.coverage_zones;
create policy coverage_zones_ops on public.coverage_zones for all using (public.app_is_ops());

-- ── Dispatch kurir partner (§9.3-9.5, COU-18) ───────────────────────────────
create table if not exists public.dispatch_assignments (
  id            bigserial primary key,
  order_id      bigint not null references public.orders (id) on delete cascade,
  courier_id    bigint not null references public.couriers (id) on delete cascade,
  status        text not null default 'reserved'
                  check (status in ('reserved', 'approved', 'rejected', 'no_response', 'expired')),
  reject_reason text,
  reserved_at   timestamptz not null default now(),
  responded_at  timestamptz
);
create index if not exists dispatch_order_idx on public.dispatch_assignments (order_id);
create index if not exists dispatch_courier_idx on public.dispatch_assignments (courier_id);
alter table public.dispatch_assignments enable row level security;
drop policy if exists dispatch_participant on public.dispatch_assignments;
create policy dispatch_participant on public.dispatch_assignments for all
  using (courier_id in (select id from public.couriers where user_id = public.app_uid())
         or order_id in (select id from public.orders where customer_id in (select id from public.customers where user_id = public.app_uid())))
  with check (courier_id in (select id from public.couriers where user_id = public.app_uid()));
drop policy if exists dispatch_ops on public.dispatch_assignments;
create policy dispatch_ops on public.dispatch_assignments for all using (public.app_is_ops());

-- ── Monetisasi: paket & langganan kuota (§17, MER-17..19, OPS-09) ───────────
create table if not exists public.quota_packages (
  id          bigserial primary key,
  kind        text not null check (kind in ('order', 'order_cod')),
  label       text not null,
  quota       integer not null check (quota > 0),
  period      text not null default 'day' check (period in ('day', 'week', 'month')),
  price_jod   numeric(12, 3) not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create table if not exists public.quota_subscriptions (
  id            bigserial primary key,
  merchant_id   bigint not null references public.merchants (id) on delete cascade,
  kind          text not null check (kind in ('order', 'order_cod')),
  package_id    bigint references public.quota_packages (id),
  quota_total   integer not null default 0,
  quota_used    integer not null default 0,
  quota_reserved integer not null default 0,
  period_start  timestamptz not null default now(),
  period_end    timestamptz,
  status        text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  created_at    timestamptz not null default now()
);
create index if not exists quota_subs_merchant_idx on public.quota_subscriptions (merchant_id, kind, status);
alter table public.quota_packages enable row level security;
alter table public.quota_subscriptions enable row level security;
drop policy if exists quota_packages_public_read on public.quota_packages;
create policy quota_packages_public_read on public.quota_packages for select using (true);
drop policy if exists quota_packages_ops on public.quota_packages;
create policy quota_packages_ops on public.quota_packages for all using (public.app_is_ops());
drop policy if exists quota_subs_merchant on public.quota_subscriptions;
create policy quota_subs_merchant on public.quota_subscriptions for all
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
drop policy if exists quota_subs_ops on public.quota_subscriptions;
create policy quota_subs_ops on public.quota_subscriptions for all using (public.app_is_ops());

-- ── Marketing ala Odoo (§15, MER-09, OPEN-23) ───────────────────────────────
create table if not exists public.marketing_programs (
  id            bigserial primary key,
  owner         text not null default 'merchant' check (owner in ('merchant', 'applicator')),
  merchant_id   bigint references public.merchants (id) on delete cascade,
  name          text not null,
  program_type  text not null default 'discount'
                  check (program_type in ('discount', 'gift_card', 'e_wallet', 'loyalty')),
  scope         text not null default 'order',
  is_stackable  boolean not null default false,
  active        boolean not null default true,
  active_from   timestamptz,
  active_to     timestamptz,
  max_uses      integer,
  used_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint marketing_program_owner_chk
    check ((owner = 'merchant' and merchant_id is not null) or owner = 'applicator')
);
create table if not exists public.marketing_rules (
  id          bigserial primary key,
  program_id  bigint not null references public.marketing_programs (id) on delete cascade,
  rule_type   text not null,
  threshold   numeric(12, 3),
  min_qty     integer,
  min_amount_jod numeric(12, 3),
  created_at  timestamptz not null default now()
);
create table if not exists public.marketing_rewards (
  id          bigserial primary key,
  program_id  bigint not null references public.marketing_programs (id) on delete cascade,
  reward_type text not null default 'discount' check (reward_type in ('discount', 'free_delivery', 'gift')),
  value_jod   numeric(12, 3) not null default 0,
  percent     numeric(5, 2),
  created_at  timestamptz not null default now()
);
create index if not exists marketing_programs_merchant_idx on public.marketing_programs (merchant_id);
alter table public.marketing_programs enable row level security;
alter table public.marketing_rules enable row level security;
alter table public.marketing_rewards enable row level security;
drop policy if exists marketing_programs_public_read on public.marketing_programs;
create policy marketing_programs_public_read on public.marketing_programs for select using (active);
drop policy if exists marketing_programs_owner on public.marketing_programs;
create policy marketing_programs_owner on public.marketing_programs for all
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
drop policy if exists marketing_programs_ops on public.marketing_programs;
create policy marketing_programs_ops on public.marketing_programs for all using (public.app_is_ops());
drop policy if exists marketing_rules_public_read on public.marketing_rules;
create policy marketing_rules_public_read on public.marketing_rules for select using (true);
drop policy if exists marketing_rules_ops on public.marketing_rules;
create policy marketing_rules_ops on public.marketing_rules for all using (public.app_is_ops());
drop policy if exists marketing_rewards_public_read on public.marketing_rewards;
create policy marketing_rewards_public_read on public.marketing_rewards for select using (true);
drop policy if exists marketing_rewards_ops on public.marketing_rewards;
create policy marketing_rewards_ops on public.marketing_rewards for all using (public.app_is_ops());

-- ── Dispute rule + kompensasi + punishment + SP (§18, OPEN-17/18/19) ────────
create table if not exists public.dispute_rules (
  id           bigserial primary key,
  code         text not null unique,
  name         text not null,
  category     text not null,
  trigger_condition text,
  responsible_party text check (responsible_party in ('customer', 'merchant', 'courier')),
  mitigation   text,
  compensation jsonb,
  punishment   jsonb,
  version      integer not null default 1,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create table if not exists public.merchant_dispute_rules (
  id          bigserial primary key,
  merchant_id bigint not null references public.merchants (id) on delete cascade,
  rule_id     bigint not null references public.dispute_rules (id) on delete cascade,
  effective_from timestamptz not null default now(),
  unique (merchant_id, rule_id)
);
create table if not exists public.punishments (
  id          bigserial primary key,
  subject_type text not null check (subject_type in ('merchant', 'courier', 'customer')),
  subject_id  bigint not null,
  kind        text not null default 'sp' check (kind in ('sp', 'fine', 'suspend')),
  level       integer not null default 1,
  reason      text,
  dispute_id  bigint references public.disputes (id),
  issued_by   bigint,
  created_at  timestamptz not null default now()
);
create index if not exists punishments_subject_idx on public.punishments (subject_type, subject_id);
alter table public.dispute_rules enable row level security;
alter table public.merchant_dispute_rules enable row level security;
alter table public.punishments enable row level security;
drop policy if exists dispute_rules_public_read on public.dispute_rules;
create policy dispute_rules_public_read on public.dispute_rules for select using (active);
drop policy if exists dispute_rules_ops on public.dispute_rules;
create policy dispute_rules_ops on public.dispute_rules for all using (public.app_is_ops());
drop policy if exists merchant_dispute_rules_read on public.merchant_dispute_rules;
create policy merchant_dispute_rules_read on public.merchant_dispute_rules for select using (true);
drop policy if exists merchant_dispute_rules_owner on public.merchant_dispute_rules;
create policy merchant_dispute_rules_owner on public.merchant_dispute_rules for all
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
drop policy if exists merchant_dispute_rules_ops on public.merchant_dispute_rules;
create policy merchant_dispute_rules_ops on public.merchant_dispute_rules for all using (public.app_is_ops());
drop policy if exists punishments_ops on public.punishments;
create policy punishments_ops on public.punishments for all using (public.app_is_ops());

-- ── Refund & ledger enterprise (§16.6, NFR-01/02) ───────────────────────────
create table if not exists public.refunds (
  id            bigserial primary key,
  order_id      bigint not null references public.orders (id) on delete cascade,
  method        text not null check (method in ('dana', 'bank_bifast')),
  amount_idr    bigint not null,
  bank_name     text,
  account_number text,
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'completed', 'failed')),
  idempotency_key text unique,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);
create table if not exists public.enterprise_ledger (
  id          bigserial primary key,
  order_id    bigint references public.orders (id),
  entry_type  text not null
                check (entry_type in ('charge', 'payout', 'refund', 'fee', 'discount_subsidy', 'rounding')),
  party       text not null check (party in ('applicator', 'merchant', 'courier', 'customer')),
  amount_jod  numeric(12, 3) not null default 0,
  amount_idr  bigint not null default 0,
  idempotency_key text unique,
  note        text,
  created_at  timestamptz not null default now()
);
create index if not exists enterprise_ledger_order_idx on public.enterprise_ledger (order_id);
alter table public.refunds enable row level security;
alter table public.enterprise_ledger enable row level security;
drop policy if exists refunds_participant on public.refunds;
create policy refunds_participant on public.refunds for select
  using (order_id in (select id from public.orders where customer_id in (select id from public.customers where user_id = public.app_uid())));
drop policy if exists refunds_ops on public.refunds;
create policy refunds_ops on public.refunds for all using (public.app_is_ops());
drop policy if exists enterprise_ledger_ops on public.enterprise_ledger;
create policy enterprise_ledger_ops on public.enterprise_ledger for all using (public.app_is_ops());

commit;
