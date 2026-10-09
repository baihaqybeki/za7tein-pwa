-- =============================================================================
-- Sa7tein — RESTORE ke ERD Final (42 tabel)  →  pilihan "A"
-- =============================================================================
-- Sumber DDL: docs/backend/ERD.md (ERD Final Irbid MVP, 42 tabel).
-- Menghapus seluruh tabel public lalu membangun ulang + helper RLS + policy
-- + realtime publication + trigger append-only. DESTRUKTIF (transaksional).
-- =============================================================================

begin;

-- 1) buang semua tabel public (fungsi app_* dibiarkan, dibuat ulang nanti)
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
end $$;

-- 2) DDL 42 tabel + index + FK tertunda (dari ERD.md §3–§5)
-- users: identitas login. Peran menentukan tabel profil mana yang dipakai.
create table users (
  id          bigint generated always as identity primary key,
  auth_user_id uuid unique references auth.users(id) on delete set null,  -- jembatan ke Supabase Auth (pengganti profiles.id)
  role        text not null check (role in ('customer','merchant','courier','cs','superadmin')),
  email       text unique,
  phone       text not null unique
              check (phone ~ '^\+[1-9][0-9]{7,14}$'),  -- E.164 (+962/+62); wajib
  verified    boolean not null default false,
  status      text not null default 'active' check (status in ('active','suspended')),
  auth_provider text not null default 'phone' check (auth_provider in ('phone','google')),
  created_at  timestamptz not null default now()
);

-- phone_verifications: Level 1 = validasi format saja (tanpa OTP WA)
create table phone_verifications (
  id         bigint generated always as identity primary key,
  user_id    bigint references users(id) on delete cascade,
  phone      text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  method     text not null default 'format_only' check (method in ('format_only','wa_otp')),
  code       text,                  -- UNRESOLVED: AUT-1 (dipakai hanya bila Level 2 aktif)
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

-- customers: profil customer
create table customers (
  id         bigint generated always as identity primary key,
  user_id    bigint not null unique references users(id) on delete cascade,
  name       text not null,
  risk_flag  boolean not null default false,   -- blacklist COD (ditandai CS/SA)
  created_at timestamptz not null default now()
);

-- zones: master zona. Didefinisikan Super Admin; merchant hanya mengaktifkan.
create table zones (
  id         bigint generated always as identity primary key,
  code       text not null unique,            -- 'Hijazi', 'Syimali', ...
  name       text not null,
  polygon    jsonb,                           -- array [[lat,lng], ...]
  created_at timestamptz not null default now()
);

-- addresses: buku alamat + zona hasil hitung saat pin disimpan
create table addresses (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references users(id) on delete cascade,
  label       text not null,
  address     text not null,
  latitude    double precision not null,
  longitude   double precision not null,
  is_default  boolean not null default false,
  zone_id     bigint references zones(id),     -- UNRESOLVED: ZON-1 (aturan & ambang hitung)
  zone_code   text,                            -- denormalisasi kode zona saat disimpan
  created_at  timestamptz not null default now()
);

-- merchants: toko. tenantStatus + deposit = kontrol platform.
create table merchants (
  id            bigint generated always as identity primary key,
  user_id       bigint not null unique references users(id) on delete restrict,
  store_name    text not null,
  store_phone   text check (store_phone ~ '^\+[1-9][0-9]{7,14}$'),
  store_address text,
  latitude      double precision,      -- lokasi toko: dipakai hitung zona (haversine) & fee radius
  longitude     double precision,      -- (draft §2: zone dihitung "haversine ke merchant"; f20 gate coverage)
  description   text,
  photo         text,
  available     boolean not null default true,          -- buka/tutup (pengganti `settings.store_status`)
  delivery_config jsonb not null default '{}'::jsonb,   -- { mode, radiusMeters, feeByDistance[], feeByArea[], activeZones[] }
  tenant_status text not null default 'pending'
                check (tenant_status in ('pending','approved','suspended','blacklisted')),
  deposit_jod   numeric(12,3) not null default 0,       -- UNRESOLVED: FEE-1 (PO: 3.50)
  deposit_status text not null default 'unpaid'
                check (deposit_status in ('unpaid','held','released')),
  created_at    timestamptz not null default now()
);

-- couriers: kurir adalah karyawan merchant (maks 3 — ditegakkan di API, bukan FK)
create table couriers (
  id           bigint generated always as identity primary key,
  user_id      bigint not null unique references users(id) on delete cascade,
  merchant_id  bigint not null references merchants(id) on delete restrict,
  name         text not null,                  -- tambahan: nama tampilan kurir (draft tidak mencantumkannya;
                                               -- sejajar dengan customers.name; UI & chat menampilkannya)
  availability text not null default 'unavailable'
               check (availability in ('available','unavailable','busy')),
  latitude     double precision,
  longitude    double precision,
  last_seen_at timestamptz,                    -- tambahan: heartbeat tawaran (bukan di draft)
  photo        text,
  vehicle      text,
  created_at   timestamptz not null default now()
);

-- fav_merchants
create table fav_merchants (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references users(id) on delete cascade,
  merchant_id bigint not null references merchants(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (user_id, merchant_id)
);

-- menus
create table menus (
  id          bigint generated always as identity primary key,
  merchant_id bigint not null references merchants(id) on delete cascade,
  name        text not null,
  description text,
  price_jod   numeric(12,3) not null default 0,
  available   boolean not null default true,
  image       text,
  -- Kolom legacy yang TIDAK ada di draft → lihat §8 (butuh keputusan, jangan diisi tebakan)
  stock       integer,
  category    text,
  created_at  timestamptz not null default now()
);

-- menu_variants: 1 = radio (ukuran), N = checkbox (topping)
create table menu_variants (
  id         bigint generated always as identity primary key,
  menu_id    bigint not null references menus(id) on delete cascade,
  name       text not null,
  required   boolean not null default false,
  max_select integer not null default 1 check (max_select >= 1),
  options    jsonb not null default '[]'::jsonb,   -- [{ id, name, priceDeltaJod }]
  created_at timestamptz not null default now()
);

-- orders: semua nominal = SNAPSHOT saat order dibuat
create table orders (
  id                bigint generated always as identity primary key,
  code              text not null unique,        -- SA-1041 (tidak ada di draft; dari flows/FEAT-2014)
  status            text not null default 'cart'
                    check (status in ('cart','quotation','canceled','prepare','waitingCourier',
                                      'waitingDelivery','delivery','done')),  -- UNRESOLVED: OST-1
  customer_id       bigint not null references customers(id) on delete restrict,
  merchant_id       bigint not null references merchants(id) on delete restrict,
  delivery_address_id bigint not null references addresses(id) on delete restrict,
  batch_id          bigint,                      -- FK ditambahkan setelah `batches` ada
  courier_id        bigint references couriers(id) on delete set null,
  -- uang (JOD display, IDR settlement)
  sub_total_jod     numeric(12,3) not null,      -- snapshot
  delivery_fee_jod  numeric(12,3) not null,      -- snapshot
  platform_fee_jod  numeric(12,3) not null,      -- snapshot -- UNRESOLVED: FEE-1
  tip_jod           numeric(12,3) not null default 0,   -- snapshot
  promo_amount_jod  numeric(12,3) not null default 0,   -- snapshot
  total_jod         numeric(12,3) not null,      -- snapshot
  total_idr         numeric(18,2),               -- settlement
  zone_id           bigint references zones(id), -- snapshot (dipakai hitung fee)
  zone_code         text,                        -- snapshot
  promo_id          bigint,                      -- FK ke marketing
  -- pembayaran
  payment_method    text not null check (payment_method in ('cod','transfer','xendit_va','xendit_qris')),
  payment_status    text not null default 'unpaid'
                    check (payment_status in ('unpaid','pending','paid','failed','refunded')),
  paid_at           timestamptz,
  -- reserve/hold
  hold_status       text not null default 'none'
                    check (hold_status in ('none','reserved','settled','released')),
  -- waktu
  created_at        timestamptz not null default now(),
  placed_at         timestamptz,
  -- pembatalan
  cancel_reason     text,
  cancel_by         text check (cancel_by in ('customer','merchant','system')),
  order_note        text
);
create index on orders (merchant_id, status);
create index on orders (customer_id, created_at desc);
create index on orders (courier_id, status);

-- order_items: unit_price & modifiers = SNAPSHOT
create table order_items (
  id             bigint generated always as identity primary key,
  order_id       bigint not null references orders(id) on delete cascade,
  menu_id        bigint not null references menus(id) on delete restrict,
  name           text not null,                  -- snapshot nama hidangan
  qty            integer not null check (qty > 0),
  unit_price_jod numeric(12,3) not null,         -- snapshot
  modifiers      jsonb not null default '[]'::jsonb,  -- snapshot [{ variantId, optionId, name, priceDeltaJod }]
  line_total_jod numeric(12,3) not null,         -- snapshot (unitPrice + Σ delta) × qty
  note           text
);

-- batches: pengelompokan order untuk satu kurir + timer SLA
create table batches (
  id                    bigint generated always as identity primary key,
  merchant_id           bigint not null references merchants(id) on delete restrict,
  courier_id            bigint references couriers(id) on delete set null,
  status                text not null default 'prepare'
                        check (status in ('prepare','closed','waitingCourier','waitingDelivery','delivery')),
  eta_prepare_seconds   integer,
  eta_delivery_seconds  integer,
  sla_prepare_deadline  timestamptz,   -- UNRESOLVED: SLA-1
  sla_delivery_deadline timestamptz,   -- UNRESOLVED: SLA-1
  escalated_to_admin    boolean not null default false,
  created_at            timestamptz not null default now()
);
alter table orders add constraint orders_batch_fk
  foreign key (batch_id) references batches(id) on delete set null;

-- fees: rincian fee per order
create table fees (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  kind       text not null check (kind in ('platform_merchant','platform_customer','delivery','service')),
  amount_jod numeric(12,3) not null,
  rule_ref   text,
  created_at timestamptz not null default now()
);

-- taxes: pajak dua lapis (GST makanan + pajak fee platform)
create table taxes (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  kind       text not null check (kind in ('gst_food','platform_income')),
  rate_pct   numeric(6,3),             -- UNRESOLVED: TAX-1
  base_jod   numeric(12,3) not null,
  amount_jod numeric(12,3),            -- UNRESOLVED: TAX-1
  created_at timestamptz not null default now()
);

-- payments: jejak pembayaran per order
create table payments (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  provider    text not null default 'none' check (provider in ('xendit','none')),
  method      text not null check (method in ('cod','transfer','xendit_va','xendit_qris')),
  amount_jod  numeric(12,3) not null,
  amount_idr  numeric(18,2),
  external_id text,                    -- id transaksi di Xendit
  status      text not null default 'unpaid'
              check (status in ('unpaid','pending','paid','failed','refunded')),
  paid_at     timestamptz,
  created_at  timestamptz not null default now(),
  unique (order_id, provider, external_id)
);

-- wallets
create table wallets (
  id                    bigint generated always as identity primary key,
  user_id               bigint not null unique references users(id) on delete cascade,
  balance_jod           numeric(12,3) not null default 0,
  reserved_balance_jod  numeric(12,3) not null default 0,
  updated_at            timestamptz not null default now(),
  check (balance_jod >= 0),
  check (reserved_balance_jod >= 0)
);

-- wallet_holds: reserve saat order dibuat → settle/release saat selesai/batal
create table wallet_holds (
  id         bigint generated always as identity primary key,
  wallet_id  bigint not null references wallets(id) on delete cascade,
  order_id   bigint not null references orders(id) on delete cascade,
  amount_jod numeric(12,3) not null,
  status     text not null default 'none'
             check (status in ('none','reserved','settled','released')),  -- tahap `cut` DIHAPUS
  expires_at timestamptz,              -- UNRESOLVED: RSV-1
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (order_id)
);

-- wallet_ledgers: APPEND-ONLY, double-entry
create table wallet_ledgers (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users(id) on delete restrict,
  type       text not null check (type in ('cr','db')),
  reference  text not null
             check (reference in ('topUp','order','delivery','withdrawal','refund','hold','release')),
  amount_jod numeric(12,3) not null,
  order_id   bigint references orders(id) on delete set null,
  created_at timestamptz not null default now()
);
create index on wallet_ledgers (user_id, created_at desc);

-- topups
create table topups (
  id               bigint generated always as identity primary key,
  wallet_id        bigint not null references wallets(id) on delete cascade,
  amount_jod       numeric(12,3) not null check (amount_jod > 0),
  amount_idr       numeric(18,2),
  rate_id          bigint,             -- FK ke exchange_rates
  method           text not null check (method in ('xendit_va','xendit_qris','transfer')),
  status           text not null default 'pending'
                   check (status in ('pending','paid','expired','failed')),
  instructions     jsonb,
  external_id      text,
  expires_at       timestamptz,        -- UNRESOLVED: WEB-1
  created_at       timestamptz not null default now()
);

-- cashouts
create table cashouts (
  id          bigint generated always as identity primary key,
  wallet_id   bigint not null references wallets(id) on delete cascade,
  amount_jod  numeric(12,3) not null check (amount_jod > 0),
  fee_jod     numeric(12,3),           -- UNRESOLVED: CO-1
  status      text not null default 'requested'
              check (status in ('requested','processing','paid','rejected')),
  destination text,
  created_at  timestamptz not null default now()
);

-- deposits: deposit COD + kredit founding
create table deposits (
  id          bigint generated always as identity primary key,
  merchant_id bigint not null references merchants(id) on delete cascade,
  kind        text not null check (kind in ('cod','founding_credit')),
  amount_jod  numeric(12,3) not null,  -- UNRESOLVED: FEE-1
  status      text not null default 'unpaid' check (status in ('unpaid','held','released')),
  verified_by bigint references users(id) on delete set null,
  verified_at timestamptz,
  created_at  timestamptz not null default now()
);

-- merchant_credits: modal + cashback. NON-WITHDRAWAL.
create table merchant_credits (
  id                 bigint generated always as identity primary key,
  merchant_id        bigint not null unique references merchants(id) on delete cascade,
  balance_jod        numeric(12,3) not null default 0,
  rebate_tier        text,             -- UNRESOLVED: INC-1
  rebate_period      text,
  rebate_amount_jod  numeric(12,3),
  rebate_paid_at     timestamptz,
  non_withdrawable   boolean not null default true,
  updated_at         timestamptz not null default now()
);

-- cashback_tiers
create table cashback_tiers (
  id             bigint generated always as identity primary key,
  tier           text not null unique,
  min_volume_jod numeric(12,3) not null,
  pct            numeric(6,3) not null
);

-- disputes: sengketa + resolusi + banding
create table disputes (
  id                bigint generated always as identity primary key,
  order_id          bigint not null references orders(id) on delete restrict,
  opened_by         bigint not null references users(id) on delete restrict,
  type              text not null
                    check (type in ('late','missing','wrong','not_delivered','payment_failed')),
  status            text not null default 'open'
                    check (status in ('open','investigating','resolved','rejected')),
  resolution        text check (resolution in
                    ('refund_customer','refund_order','resettle','no_action')),
  refund_amount_jod numeric(12,3),
  resolved_by       bigint references users(id) on delete set null,
  resolved_at       timestamptz,
  window_closes_at  timestamptz,       -- UNRESOLVED: DSP-1 (24 jam, sementara)
  created_at        timestamptz not null default now()
);

-- dispute_appeals: banding atas putusan level-1 (diputus Super Admin)
create table dispute_appeals (
  id            bigint generated always as identity primary key,
  dispute_id    bigint not null references disputes(id) on delete cascade,
  filed_by      bigint not null references users(id) on delete restrict,
  reason        text,
  status        text not null default 'open' check (status in ('open','decided','rejected')),
  decided_by    bigint references users(id) on delete set null,
  decided_at    timestamptz,
  window_closes_at timestamptz,      -- UNRESOLVED: APL-1 (siapa boleh mengajukan, window/SLA)
  created_at    timestamptz not null default now()
);

-- protection_fund
create table protection_fund (
  id         bigint generated always as identity primary key,
  order_id   bigint references orders(id) on delete set null,
  dispute_id bigint references disputes(id) on delete set null,
  amount_jod numeric(12,3) not null,
  direction  text not null check (direction in ('in','out')),
  created_at timestamptz not null default now()
);

-- exchange_rates: JOD (display) ↔ IDR (settlement)
create table exchange_rates (
  id         bigint generated always as identity primary key,
  base       text not null check (base in ('JOD','USD')),
  quote      text not null check (quote in ('IDR')),
  rate       numeric(18,6) not null,
  source     text,                     -- UNRESOLVED: FX-1
  fetched_at timestamptz not null default now(),
  unique (base, quote, fetched_at)
);
alter table topups add constraint topups_rate_fk
  foreign key (rate_id) references exchange_rates(id) on delete set null;

-- chats / chat_messages: satu thread per order, maks 3 peserta
create table chats (
  id           bigint generated always as identity primary key,
  order_id     bigint not null unique references orders(id) on delete cascade,
  last_message text,
  last_at      timestamptz,
  created_at   timestamptz not null default now()
);

create table chat_participants (
  chat_id bigint not null references chats(id) on delete cascade,
  user_id bigint not null references users(id) on delete cascade,
  role    text not null,               -- peran saat bergabung (jejak, bukan otorisasi)
  joined_at timestamptz not null default now(),
  primary key (chat_id, user_id)
);

create table chat_messages (
  id         bigint generated always as identity primary key,
  chat_id    bigint not null references chats(id) on delete cascade,
  sender_id  bigint not null references users(id) on delete restrict,
  channel    text not null
             check (channel in ('customer-merchant','merchant-courier','courier-customer')),
  body       text not null,
  at         timestamptz not null default now(),
  read_at    timestamptz
);
create index on chat_messages (chat_id, at);

-- checkpoints: 4 titik verifikasi pengiriman
create table checkpoints (
  id         bigint generated always as identity primary key,
  order_id   bigint not null references orders(id) on delete cascade,
  kind       text not null check (kind in ('at_store','picked_up','arrived','otp_verified')),
  latitude   double precision,
  longitude  double precision,
  proof_photo text,
  note       text,
  at         timestamptz not null default now()
);

-- rating_reviews: merchant XOR menu
create table rating_reviews (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references orders(id) on delete cascade,
  customer_id bigint not null references customers(id) on delete cascade,
  merchant_id bigint references merchants(id) on delete cascade,
  menu_id     bigint references menus(id) on delete cascade,
  rating      integer not null check (rating between 1 and 5),
  review      text,
  window_closes_at timestamptz,        -- UNRESOLVED: RATE-1 (jendela pengisian)
  edited_at   timestamptz,             -- UNRESOLVED: RATE-1 (boleh diedit?)
  deleted_at  timestamptz,             -- UNRESOLVED: RATE-1 (hapus/moderasi)
  created_at  timestamptz not null default now(),
  check ((merchant_id is not null) <> (menu_id is not null)),  -- tepat satu
  unique (order_id, customer_id, merchant_id, menu_id)
);

create table review_replies (
  id          bigint generated always as identity primary key,
  review_id   bigint not null references rating_reviews(id) on delete cascade,
  merchant_id bigint not null references merchants(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- marketing: promo (scope MVP belum diputuskan)
create table marketing (
  id          bigint generated always as identity primary key,
  type        text not null check (type in ('promo_delivery','discount_pct','discount_fixed')),
  value       numeric(12,3) not null,  -- UNRESOLVED: MKT-1
  code        text unique,             -- null = auto apply
  active_from timestamptz not null,
  active_to   timestamptz not null,
  max_uses    integer,
  used_count  integer not null default 0,
  created_at  timestamptz not null default now()
);
alter table orders add constraint orders_promo_fk
  foreign key (promo_id) references marketing(id) on delete set null;

-- push_subscriptions
create table push_subscriptions (
  id          bigint generated always as identity primary key,
  user_id     bigint not null references users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

-- roles / operators: operator dibuat SA, tidak ada self-registration
create table roles (
  id   bigint generated always as identity primary key,
  key  text not null unique check (key in ('cs_ops','sa_ops','sa_owner')),
  name text not null,
  permissions jsonb not null default '[]'::jsonb
);

create table operators (
  id         bigint generated always as identity primary key,
  user_id    bigint not null unique references users(id) on delete cascade,
  role_id    bigint not null references roles(id) on delete restrict,
  active     boolean not null default true,
  created_by bigint references users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- audit_logs: pelaku = id, bukan nama
create table audit_logs (
  id         bigint generated always as identity primary key,
  actor_id   bigint references users(id) on delete set null,
  actor_role text,
  action     text not null,
  target     text,                     -- UNRESOLVED: AUD-1 (taksonomi)
  target_id  bigint,
  at         timestamptz not null default now()
);
create index on audit_logs (actor_id, at desc);

-- tax_reports / platform_profit / platform_switches
create table tax_reports (
  id              bigint generated always as identity primary key,
  period          text not null,        -- '2026-10'
  platform_fee_jod numeric(12,3) not null default 0,
  gst_jod         numeric(12,3),        -- UNRESOLVED: TAX-1
  other_tax_jod   numeric(12,3),        -- UNRESOLVED: TAX-1
  total_tax_jod   numeric(12,3),        -- UNRESOLVED: TAX-1
  export_url      text,                 -- UNRESOLVED: TAX-2
  created_at      timestamptz not null default now(),
  unique (period)
);

create table platform_profit (
  id            bigint generated always as identity primary key,
  period        text not null,
  gross_jod     numeric(12,3) not null default 0,
  cost_jod      numeric(12,3) not null default 0,
  net_jod       numeric(12,3) not null default 0,
  withdrawn_jod numeric(12,3) not null default 0,
  updated_at    timestamptz not null default now(),
  unique (period)
);

create table platform_switches (
  key        text primary key check (key in ('cod_enabled','payout_enabled','maintenance_mode')),
  enabled    boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by bigint references users(id) on delete set null
);

-- 3) helper RLS (dari DB live sebelumnya)
create or replace function public.app_role() returns text
  language sql stable security definer set search_path to 'public'
  as $fn$ select u.role from public.users u where u.auth_user_id = auth.uid() $fn$;

create or replace function public.app_uid() returns bigint
  language sql stable security definer set search_path to 'public'
  as $fn$ select u.id from public.users u where u.auth_user_id = auth.uid() $fn$;

create or replace function public.app_is_ops() returns boolean
  language sql stable
  as $fn$ select coalesce(public.app_role() in ('cs', 'superadmin'), false) $fn$;

-- 4) RLS: ops (cs/superadmin) penuh di semua tabel
do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format(
      'create policy %I on public.%I for all to public using (public.app_is_ops()) with check (public.app_is_ops())',
      r.tablename || '_ops', r.tablename
    );
  end loop;
end $$;

-- 5) baca publik (anon): katalog & data acuan
create policy merchants_public_read on public.merchants for select to public using (tenant_status = 'approved');
create policy menus_public_read on public.menus for select to public using (true);
create policy menu_variants_public_read on public.menu_variants for select to public using (true);
create policy zones_public_read on public.zones for select to public using (true);
create policy exchange_rates_public_read on public.exchange_rates for select to public using (true);
create policy rating_reviews_public_read on public.rating_reviews for select to public using (true);
create policy review_replies_public_read on public.review_replies for select to public using (true);
create policy marketing_public_read on public.marketing for select to public using (true);
create policy platform_switches_public_read on public.platform_switches for select to public using (true);
create policy cashback_tiers_public_read on public.cashback_tiers for select to public using (true);

-- 6) owner (user_id = app_uid())
create policy users_self on public.users for all to public
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy phone_verifications_owner on public.phone_verifications for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy customers_owner on public.customers for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy addresses_owner on public.addresses for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy merchants_owner on public.merchants for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy couriers_owner on public.couriers for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy fav_merchants_owner on public.fav_merchants for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy wallets_owner on public.wallets for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());
create policy wallet_ledgers_owner on public.wallet_ledgers for select to public
  using (user_id = public.app_uid());
create policy push_subscriptions_owner on public.push_subscriptions for all to public
  using (user_id = public.app_uid()) with check (user_id = public.app_uid());

-- wallet turunan (lewat wallet milik sendiri)
create policy topups_owner on public.topups for all to public
  using (wallet_id in (select id from public.wallets where user_id = public.app_uid()))
  with check (wallet_id in (select id from public.wallets where user_id = public.app_uid()));
create policy cashouts_owner on public.cashouts for all to public
  using (wallet_id in (select id from public.wallets where user_id = public.app_uid()))
  with check (wallet_id in (select id from public.wallets where user_id = public.app_uid()));
create policy wallet_holds_owner on public.wallet_holds for all to public
  using (wallet_id in (select id from public.wallets where user_id = public.app_uid()))
  with check (wallet_id in (select id from public.wallets where user_id = public.app_uid()));

-- 7) order & anak-anaknya (peserta: customer / merchant / courier)
create policy orders_participant on public.orders for all to public
  using (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    ) with check ( customer_id in (select id from public.customers where user_id = public.app_uid()) or merchant_id in (select id from public.merchants where user_id = public.app_uid()) or courier_id in (select id from public.couriers where user_id = public.app_uid()) );

create policy order_items_via_order on public.order_items for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy fees_via_order on public.fees for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy taxes_via_order on public.taxes for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy payments_via_order on public.payments for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy checkpoints_via_order on public.checkpoints for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy disputes_via_order on public.disputes for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy chats_via_order on public.chats for all to public
  using (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )))
  with check (order_id in (select id from public.orders where (
      customer_id in (select id from public.customers where user_id = public.app_uid())
      or merchant_id in (select id from public.merchants where user_id = public.app_uid())
      or courier_id in (select id from public.couriers where user_id = public.app_uid())
    )));
create policy chat_participants_owner on public.chat_participants for select to public
  using (user_id = public.app_uid());

-- 8) batch & turunan merchant
create policy batches_participant on public.batches for all to public
  using (
    merchant_id in (select id from public.merchants where user_id = public.app_uid())
    or courier_id in (select id from public.couriers where user_id = public.app_uid())
  )
  with check (
    merchant_id in (select id from public.merchants where user_id = public.app_uid())
    or courier_id in (select id from public.couriers where user_id = public.app_uid())
  );
create policy deposits_owner on public.deposits for all to public
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
create policy merchant_credits_owner on public.merchant_credits for all to public
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));
create policy review_replies_owner on public.review_replies for all to public
  using (merchant_id in (select id from public.merchants where user_id = public.app_uid()))
  with check (merchant_id in (select id from public.merchants where user_id = public.app_uid()));

-- rating: customer menulis miliknya
create policy rating_reviews_customer on public.rating_reviews for all to public
  using (customer_id in (select id from public.customers where user_id = public.app_uid()))
  with check (customer_id in (select id from public.customers where user_id = public.app_uid()));

-- 9) realtime publication (11 tabel)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.orders, public.couriers, public.merchants, public.menus, public.chats,
      public.chat_messages, public.wallets, public.wallet_holds, public.wallet_ledgers,
      public.disputes, public.batches;
  end if;
end $$;

-- 10) append-only: wallet_ledgers & audit_logs
create or replace function public.deny_mutation() returns trigger
  language plpgsql as $fn$ begin raise exception 'append-only: % ditolak', tg_table_name; end $fn$;
create trigger wallet_ledgers_append_only before update or delete on public.wallet_ledgers
  for each row execute function public.deny_mutation();
create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function public.deny_mutation();

commit;
