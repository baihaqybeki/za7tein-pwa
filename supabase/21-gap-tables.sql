-- =============================================================================
-- Sa7tein — sisa tabel gap (dipakai UI, belum ada tabelnya)
--   * customer_risk_flags — riwayat blacklist/risk COD customer (F15)
--   * admin_escalations   — alert SLA yang naik ke CS/SA (F12/F21)
--   * menu_reviews        — ulasan menu legacy (tanpa order; display)
-- Aditif + RLS + seed. Idempoten.
-- =============================================================================

begin;

-- 1) customer_risk_flags
create table if not exists public.customer_risk_flags (
  id              bigint generated always as identity primary key,
  customer_id     bigint not null references public.customers (id) on delete cascade,
  reason          text not null,
  by_operator_id  bigint references public.users (id) on delete set null,
  at              timestamptz not null default now()
);
create index if not exists customer_risk_flags_customer_idx on public.customer_risk_flags (customer_id);
alter table public.customer_risk_flags enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='customer_risk_flags' and policyname='crf_ops') then
    create policy crf_ops on public.customer_risk_flags for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- 2) admin_escalations
create table if not exists public.admin_escalations (
  id           bigint generated always as identity primary key,
  order_id     bigint references public.orders (id) on delete set null,
  merchant_id  bigint references public.merchants (id) on delete set null,
  detail       text not null,
  minutes_late integer not null default 0,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists admin_escalations_merchant_idx on public.admin_escalations (merchant_id);
alter table public.admin_escalations enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='admin_escalations' and policyname='admin_escalations_ops') then
    create policy admin_escalations_ops on public.admin_escalations for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- 3) menu_reviews (legacy, tanpa order)
create table if not exists public.menu_reviews (
  id         bigint generated always as identity primary key,
  menu_id    bigint not null references public.menus (id) on delete cascade,
  name       text not null,
  avatar     text,
  rating     integer not null check (rating between 1 and 5),
  text       text,
  created_at timestamptz not null default now()
);
create index if not exists menu_reviews_menu_idx on public.menu_reviews (menu_id);
alter table public.menu_reviews enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='menu_reviews' and policyname='menu_reviews_public_read') then
    create policy menu_reviews_public_read on public.menu_reviews for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='menu_reviews' and policyname='menu_reviews_ops') then
    create policy menu_reviews_ops on public.menu_reviews for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- seed contoh (hanya bila kosong)
insert into public.customer_risk_flags (customer_id, reason, by_operator_id)
select 6, 'COD gagal 2× berturut', (select id from public.users where role='cs' order by id limit 1)
where not exists (select 1 from public.customer_risk_flags);

insert into public.admin_escalations (order_id, merchant_id, detail, minutes_late)
select 1, 1, 'SLA prepare terlewat', 12
where not exists (select 1 from public.admin_escalations);

insert into public.menu_reviews (menu_id, name, avatar, rating, text)
select v.mid, v.nm, null, v.r, v.tx
from (values
  (1, 'Rina',  5, 'Nasi gorengnya mantap!'),
  (1, 'Dimas', 4, 'Porsi pas, pedasnya bisa diatur.'),
  (4, 'Sari',  5, 'Lontongnya lembut.')
) as v(mid, nm, r, tx)
where not exists (select 1 from public.menu_reviews);

commit;
