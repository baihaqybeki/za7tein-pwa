-- =============================================================================
-- Sa7tein — skema untuk 4 fitur customer
--   1) profil merchant  2) estimated cooking time per menu
--   3) busy store (store_status)  4) audio push (preferensi + notifications)
-- Aditif & idempoten. Sumber: keputusan sesi ini (2026-10-10).
-- =============================================================================

begin;

-- 1) Profil merchant: status toko jadi satu enum (open/busy/closed)
alter table public.merchants
  add column if not exists store_status text not null default 'open'
    check (store_status in ('open', 'busy', 'closed'));

update public.merchants
  set store_status = case when available then 'open' else 'closed' end
  where store_status = 'open' and available is distinct from true;

alter table public.merchants drop column if exists available;

-- 2) Estimated cooking time per menu (menit)
alter table public.menus
  add column if not exists cook_minutes integer
    check (cook_minutes is null or cook_minutes >= 0);

-- isi contoh cook_minutes untuk menu yang ada (berdasarkan nama hidangan)
update public.menus set cook_minutes = 15 where cook_minutes is null and name ilike '%nasi goreng%';
update public.menus set cook_minutes = 20 where cook_minutes is null and name ilike '%sate%';
update public.menus set cook_minutes = 10 where cook_minutes is null and name ilike '%lontong%';
update public.menus set cook_minutes = 3  where cook_minutes is null and name ilike '%es teh%';

-- 4) Audio push: preferensi suara pada langganan
alter table public.push_subscriptions
  add column if not exists sound_enabled boolean not null default true;
alter table public.push_subscriptions
  add column if not exists sound text not null default 'default';

-- Riwayat notifikasi (dipakai UI customer + audio)
create table if not exists public.notifications (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references public.users (id) on delete cascade,
  kind       text not null check (kind in ('order', 'promo', 'payment', 'system', 'courier')),
  title      text not null,
  body       text,
  sound      text not null default 'default',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_owner') then
    create policy notifications_owner on public.notifications
      for all to public using (user_id = public.app_uid()) with check (user_id = public.app_uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='notifications' and policyname='notifications_ops') then
    create policy notifications_ops on public.notifications
      for all to public using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

commit;
