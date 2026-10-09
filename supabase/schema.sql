-- =============================================================================
-- Sa7tein — Skema database (Supabase / PostgreSQL)
-- =============================================================================
-- Sumber tunggal: docs/product/schema-draft-v1.md (17 entitas, 2026-09-22).
--
-- Status dokumen sumber: **draft — belum final**. Beberapa isinya masih
-- UNRESOLVED (AUTH-1, SLA-1, FEE-1, MARK-1, OQ-2..30). Skrip ini mengikuti draft
-- apa adanya, TIDAK menebak nilai bisnis: kolom yang tak ada di draft ditandai
-- eksplisit di komentar ("TAMBAHAN STRUKTURAL").
--
-- Sifat: ADITIF / AMAN — `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT
-- EXISTS`. Tidak menyentuh data/kolom yang sudah ada. Untuk menghapus skema
-- referensi lama (repo-sa7tein-schema.md §6, 7 tabel), jalankan skrip terpisah
-- `reference-schema-drop.sql` (destruktif, manual).
--
-- Konvensi: nama tabel/kolom snake_case (standar Postgres/Supabase). Nilai enum
-- mengikuti literal draft (termasuk camelCase seperti 'waitingCourier'), dijaga
-- lewat CHECK constraint — bukan tipe ENUM, supaya mudah diubah tanpa migrasi tipe.
--
-- Pemetaan entitas draft -> tabel:
--   user -> users · address -> addresses · customer -> customers
--   merchant -> merchants · courier -> couriers · favMerchant -> fav_merchants
--   menu -> menus · menuVariant -> menu_variants · order -> orders
--   orderItem -> order_items · batch -> batches · wallet -> wallets
--   ledger -> ledgers · chat -> chats + chat_messages
--   incidentResolution -> incident_resolutions · marketing -> marketing
--   ratingReview -> rating_reviews
-- ("order"/"user" di-kuotasi sebagai identifier reserved, jadi dipakai bentuk
--  plural: orders/users.)
--
-- Uang: numeric(14,2). Draft menulis `number` tanpa presisi — anggap UNRESOLVED.
-- Waktu: timestamptz.
-- =============================================================================

-- ── 1. users ─────────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          bigserial primary key,
  type        text not null check (type in ('customer', 'courier', 'merchant')),
  email       text,
  verified    boolean not null default false,
  status      text not null default 'active' check (status in ('active', 'suspended')),
  phone       text,                                  -- E.164 (+962/+62), PRD M8
  created_at  timestamptz not null default now()
);
create index if not exists users_type_idx on public.users (type);

-- ── 16. marketing (dibuat lebih dahulu: dirujuk orders.promo_id) ─────────────
create table if not exists public.marketing (
  id          bigserial primary key,
  type        text check (type in ('promo_delivery', 'discount_pct', 'discount_fixed')),
  value       numeric(14, 2),
  code        text,                                  -- null = auto apply
  active_from timestamptz,
  active_to   timestamptz,
  max_uses    integer,
  used_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ── 4. merchants ─────────────────────────────────────────────────────────────
create table if not exists public.merchants (
  id             bigserial primary key,
  user_id        bigint references public.users (id) on delete cascade,
  name           text,                               -- TAMBAHAN STRUKTURAL: draft tidak mencantumkan; dibutuhkan UI
  description    text,
  photo          text,
  available      boolean not null default true,
  delivery_config jsonb not null default '{}'::jsonb, -- { mode, radiusMeters, feeByDistance, feeByArea }
  tenant_status  text not null default 'pending'
                   check (tenant_status in ('pending', 'approved', 'suspended', 'blacklisted')),
  deposit        numeric(14, 2) not null default 0,  -- deposit COD 3,50 JOD (DEC-1038)
  deposit_status text not null default 'unpaid'
                   check (deposit_status in ('unpaid', 'held', 'released')),
  created_at     timestamptz not null default now()
);
create index if not exists merchants_user_idx on public.merchants (user_id);

-- ── 3. customers ─────────────────────────────────────────────────────────────
create table if not exists public.customers (
  id         bigserial primary key,
  user_id    bigint references public.users (id) on delete cascade,
  name       text,
  risk_flag  boolean not null default false,          -- blacklist COD (Super Admin)
  created_at timestamptz not null default now()
);
create index if not exists customers_user_idx on public.customers (user_id);

-- ── 2. addresses ─────────────────────────────────────────────────────────────
create table if not exists public.addresses (
  id          bigserial primary key,
  user_id     bigint references public.users (id) on delete cascade,
  label       text,
  address     text,
  latitude    numeric(9, 6),
  longitude   numeric(9, 6),
  is_default  boolean not null default false,
  zone        text check (zone in ('A', 'B', 'C')),
  created_at  timestamptz not null default now()
);
create index if not exists addresses_user_idx on public.addresses (user_id);

-- ── 5. couriers ──────────────────────────────────────────────────────────────
create table if not exists public.couriers (
  id            bigserial primary key,
  user_id       bigint references public.users (id) on delete cascade,
  merchant_id   bigint references public.merchants (id) on delete cascade, -- karyawan merchant, maks 3 (C-06)
  availability  text not null default 'available'
                  check (availability in ('available', 'unavailable', 'busy')),
  created_at    timestamptz not null default now()
);
create index if not exists couriers_merchant_idx on public.couriers (merchant_id);

-- ── 7. menus ─────────────────────────────────────────────────────────────────
create table if not exists public.menus (
  id          bigserial primary key,
  merchant_id bigint references public.merchants (id) on delete cascade, -- TAMBAHAN STRUKTURAL: draft F7 mendahului keputusan multi-merchant (DEC-1041); menu tanpa merchant tidak terpakai
  name        text,
  description text,
  price       numeric(14, 2) not null default 0,
  available   boolean not null default true,
  image       text,
  created_at  timestamptz not null default now()
);
create index if not exists menus_merchant_idx on public.menus (merchant_id);

-- ── 8. menuVariants ──────────────────────────────────────────────────────────
create table if not exists public.menu_variants (
  id         bigserial primary key,
  menu_id    bigint references public.menus (id) on delete cascade,
  name       text,                                    -- "Ukuran", "Pedas"
  required   boolean not null default false,          -- size (wajib) / topping (opsional)
  max_select integer not null default 1,              -- 1 = radio, N = checkbox
  options    jsonb not null default '[]'::jsonb,      -- [{ id, name, priceDelta }]
  created_at timestamptz not null default now()
);
create index if not exists menu_variants_menu_idx on public.menu_variants (menu_id);

-- ── 11. batch (dibuat sebelum orders: dirujuk orders.batch_id) ───────────────
create table if not exists public.batches (
  id                    bigserial primary key,
  merchant_id           bigint references public.merchants (id),
  courier_id            bigint references public.couriers (id),
  status                text not null default 'prepare'
                          check (status in ('prepare', 'closed', 'waitingCourier', 'waitingDelivery', 'delivery')),
  eta_prepare           integer,                      -- countdown mulai saat status prepare
  eta_delivery          integer,                      -- countdown mulai saat status delivery
  created_at            timestamptz not null default now(),
  sla_prepare_deadline  timestamptz,                  -- placedAt + SLA prepare (angka UNRESOLVED, SLA-1)
  sla_delivery_deadline timestamptz,
  escalated_to_admin    boolean not null default false
);
create index if not exists batches_merchant_idx on public.batches (merchant_id);
create index if not exists batches_courier_idx on public.batches (courier_id);

-- ── 9. order ─────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id                  bigserial primary key,
  status              text not null default 'cart'
                        check (status in ('cart', 'quotation', 'canceled', 'prepare', 'waitingCourier', 'waitingDelivery', 'delivery', 'done')),
  customer_id         bigint references public.customers (id),
  merchant_id         bigint references public.merchants (id),
  delivery_address_id bigint references public.addresses (id),
  batch_id            bigint references public.batches (id),
  sub_total           numeric(14, 2) not null default 0,
  delivery_fee        numeric(14, 2) not null default 0,
  platform_fee        numeric(14, 2) not null default 0,
  total               numeric(14, 2) not null default 0,
  payment_method      text check (payment_method in ('cod', 'transfer', 'xendit_va', 'xendit_qris')),
  payment_status      text not null default 'unpaid'
                        check (payment_status in ('unpaid', 'pending', 'paid', 'failed', 'refunded')),
  paid_at             timestamptz,
  created_at          timestamptz not null default now(),
  placed_at           timestamptz,                    -- masuk antrean merchant -> mulai SLA prepare
  cancel_reason       text,
  cancel_by           text check (cancel_by in ('customer', 'merchant', 'system')),
  tip                 numeric(14, 2) not null default 0,  -- F1: tip masuk order
  zone                text check (zone in ('A', 'B', 'C')), -- snapshot tarif saat order
  promo_id            bigint references public.marketing (id),
  promo_amount        numeric(14, 2) not null default 0
);
-- CATATAN UNRESOLVED: draft memakai 'quotation' yang belum ada di flow F1
-- (cart -> placed -> prepare). Samakan bahasa sebelum ERD final.
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_merchant_idx on public.orders (merchant_id);
create index if not exists orders_batch_idx on public.orders (batch_id);
create index if not exists orders_status_idx on public.orders (status);

-- ── 10. orderItem ────────────────────────────────────────────────────────────
create table if not exists public.order_items (
  id         bigserial primary key,
  order_id   bigint references public.orders (id) on delete cascade,
  menu_id    bigint references public.menus (id),
  qty        integer not null default 1,
  unit_price numeric(14, 2) not null default 0,        -- snapshot menu.price saat order dibuat
  modifiers  jsonb not null default '[]'::jsonb,       -- [{ variantId, optionId, name, priceDelta }]
  line_total numeric(14, 2) not null default 0,        -- (unitPrice + sum(priceDelta)) * qty
  note       text
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_menu_idx on public.order_items (menu_id);

-- ── 6. favMerchant ───────────────────────────────────────────────────────────
create table if not exists public.fav_merchants (
  id          bigserial primary key,
  user_id     bigint references public.users (id) on delete cascade,
  merchant_id bigint references public.merchants (id) on delete cascade,
  unique (user_id, merchant_id)
);

-- ── 12. wallet ───────────────────────────────────────────────────────────────
create table if not exists public.wallets (
  id               bigserial primary key,
  user_id          bigint references public.users (id) on delete cascade,
  balance          numeric(14, 2) not null default 0,
  reserved_balance numeric(14, 2) not null default 0,  -- COD hold (F2) + payout in-flight (F6)
  created_at       timestamptz not null default now()
);
create index if not exists wallets_user_idx on public.wallets (user_id);

-- ── 13. ledger ───────────────────────────────────────────────────────────────
create table if not exists public.ledgers (
  id         bigserial primary key,
  user_id    bigint references public.users (id),
  type       text check (type in ('cr', 'db')),
  reference  text check (reference in ('topUp', 'order', 'delivery', 'withdrawal', 'refund', 'hold', 'release')),
  amount     numeric(14, 2),
  created_at timestamptz not null default now()
);
create index if not exists ledgers_user_idx on public.ledgers (user_id);

-- ── 14. chat + chatMessage ───────────────────────────────────────────────────
create table if not exists public.chats (
  id           bigserial primary key,
  order_id     bigint references public.orders (id) on delete cascade,
  participants bigint[],                              -- [userId] customer/merchant/courier
  last_message text,
  last_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists chats_order_idx on public.chats (order_id);

create table if not exists public.chat_messages (
  id        bigserial primary key,
  chat_id   bigint references public.chats (id) on delete cascade,
  sender_id bigint references public.users (id),
  body      text,
  at        timestamptz not null default now(),
  read_at   timestamptz
);
create index if not exists chat_messages_chat_idx on public.chat_messages (chat_id);

-- ── 15. incidentResolution ───────────────────────────────────────────────────
create table if not exists public.incident_resolutions (
  id            bigserial primary key,
  order_id      bigint references public.orders (id) on delete cascade,
  opened_by     bigint references public.users (id),
  type          text check (type in ('late', 'missing', 'wrong', 'not_delivered', 'payment_failed')),
  status        text not null default 'open'
                  check (status in ('open', 'investigating', 'resolved', 'rejected')),
  resolution    text check (resolution in ('refund_customer', 'refund_order', 'resettle', 'no_action')),
  refund_amount numeric(14, 2),
  resolved_by   bigint references public.users (id),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists incident_resolutions_order_idx on public.incident_resolutions (order_id);

-- ── 17. ratingReview ─────────────────────────────────────────────────────────
create table if not exists public.rating_reviews (
  id          bigserial primary key,
  order_id    bigint references public.orders (id) on delete cascade,
  merchant_id bigint references public.merchants (id),   -- null jika menu_id terisi
  customer_id bigint references public.customers (id),
  menu_id     bigint references public.menus (id),       -- null jika merchant_id terisi
  review      text,                                      -- null jika review menu tanpa teks
  rating      integer check (rating between 1 and 5),
  created_at  timestamptz not null default now()
);
create index if not exists rating_reviews_merchant_idx on public.rating_reviews (merchant_id);
create index if not exists rating_reviews_menu_idx on public.rating_reviews (menu_id);

-- =============================================================================
-- BELUM DIBUAT (butuh keputusan, jangan ditebak — lihat schema-draft-v1.md):
--   * push_subscriptions — F11 / PRD M8, status `planned`, bentuk tabel belum ada.
--   * Auth (AUTH-1) — provider & OTP (email vs WA) belum jadi requirement PRD.
-- =============================================================================
