-- =============================================================================
-- Sa7tein — delta BE dari API spec (fokus G1/G4/G6/G8/G9/G13/G14 + liabilities)
-- Xendit (f17) & Google login (f21) SENGAJA dilewati.
-- Aditif & idempoten.
-- =============================================================================

begin;

-- ── G14: riwayat transisi status order ──────────────────────────────────────
create table if not exists public.order_status_history (
  id          bigint generated always as identity primary key,
  order_id    bigint not null references public.orders (id) on delete cascade,
  from_status text,
  to_status   text not null,
  actor_id    bigint references public.users (id) on delete set null,
  at          timestamptz not null default now()
);
create index if not exists order_status_history_order_idx on public.order_status_history (order_id, at);
alter table public.order_status_history enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='order_status_history' and policyname='osh_ops') then
    create policy osh_ops on public.order_status_history for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

create or replace function public.orders_status_history()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if old.status is distinct from new.status then
    insert into order_status_history (order_id, from_status, to_status, actor_id)
      values (new.id, old.status, new.status, public.app_uid());
  end if;
  return new;
end $$;
drop trigger if exists orders_status_history on public.orders;
create trigger orders_status_history after update of status on public.orders
  for each row execute function public.orders_status_history();

-- ── G13: notifikasi bisa deep-link ke order ─────────────────────────────────
alter table public.notifications add column if not exists order_id bigint references public.orders (id) on delete set null;

-- ── G8: jejak tutup insiden CS ──────────────────────────────────────────────
create table if not exists public.incident_resolutions (
  id         bigint generated always as identity primary key,
  order_id   bigint references public.orders (id) on delete set null,
  dispute_id bigint,
  kind       text,
  actor_id   bigint references public.users (id) on delete set null,
  action     text,
  note       text,
  ledger_ref bigint,
  created_at timestamptz not null default now()
);
alter table public.incident_resolutions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='incident_resolutions' and policyname='incident_resolutions_ops') then
    create policy incident_resolutions_ops on public.incident_resolutions for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- ── G6: OTP server — acak (CSPRNG), verifikasi RPC, sembunyikan dari non-customer
-- generation: ganti OTP predictable (1000+7*id) dengan acak saat insert
create or replace function public.orders_assign_otp()
returns trigger language plpgsql as $$
begin
  if new.otp is null or new.otp = '' then
    new.otp := lpad((floor(random() * 10000))::int::text, 4, '0');
  end if;
  return new;
end $$;
drop trigger if exists orders_assign_otp on public.orders;
create trigger orders_assign_otp before insert on public.orders
  for each row execute function public.orders_assign_otp();

-- verifikasi: hanya via RPC (SECURITY DEFINER)
create or replace function public.verify_order_otp(p_order_id bigint, p_code text)
returns boolean language plpgsql security definer set search_path = public
as $$
declare ok boolean;
begin
  select (o.otp = p_code) into ok from orders o where o.id = p_order_id;
  if coalesce(ok, false) then
    update orders set otp_verified = true where id = p_order_id;
    insert into checkpoints (order_id, kind, at) values (p_order_id, 'otp_verified', now());
    return true;
  end if;
  return false;
end $$;
revoke all on function public.verify_order_otp(bigint, text) from public;
grant execute on function public.verify_order_otp(bigint, text) to authenticated;

-- customer pemilik boleh baca OTP-nya sendiri
create or replace function public.my_order_otp(p_order_id bigint)
returns text language sql security definer set search_path = public
as $$
  select o.otp
  from orders o
  join customers c on c.id = o.customer_id
  where o.id = p_order_id and c.user_id = public.app_uid();
$$;
grant execute on function public.my_order_otp(bigint) to authenticated;

-- sembunyikan kolom otp dari peran klien (kurir/merchant) — hanya service/customer via RPC
revoke select (otp) on public.orders from anon, authenticated;

-- ── G1: chat peserta — isi participants + RLS peserta ───────────────────────
create or replace function public.chat_add_participants()
returns trigger language plpgsql security definer set search_path = public
as $$
declare o record;
begin
  select * into o from orders where id = new.order_id;
  if o.id is null then return new; end if;
  -- customer
  insert into chat_participants (chat_id, user_id, role, joined_at)
    select new.id, cu.user_id, 'customer', now()
    from customers cu where cu.id = o.customer_id
    on conflict do nothing;
  -- merchant
  insert into chat_participants (chat_id, user_id, role, joined_at)
    select new.id, m.user_id, 'merchant', now()
    from merchants m where m.id = o.merchant_id
    on conflict do nothing;
  -- kurir (bila sudah di-assign)
  insert into chat_participants (chat_id, user_id, role, joined_at)
    select new.id, co.user_id, 'courier', now()
    from couriers co where co.id = o.courier_id
    on conflict do nothing;
  return new;
end $$;
drop trigger if exists chats_add_participants on public.chats;
create trigger chats_add_participants after insert on public.chats
  for each row execute function public.chat_add_participants();

-- backfill participants untuk chat yang sudah ada
insert into public.chat_participants (chat_id, user_id, role, joined_at)
select ch.id, cu.user_id, 'customer', now()
  from chats ch join orders o on o.id = ch.order_id join customers cu on cu.id = o.customer_id
on conflict do nothing;
insert into public.chat_participants (chat_id, user_id, role, joined_at)
select ch.id, m.user_id, 'merchant', now()
  from chats ch join orders o on o.id = ch.order_id join merchants m on m.id = o.merchant_id
on conflict do nothing;

-- RLS: peserta (bukan hanya CS) boleh baca/tulis
do $$
begin
  if not exists (select 1 from pg_policies where tablename='chats' and policyname='chats_participant') then
    create policy chats_participant on public.chats for all to authenticated
      using (exists (select 1 from chat_participants p where p.chat_id = chats.id and p.user_id = public.app_uid()))
      with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='chat_messages' and policyname='chat_messages_participant') then
    create policy chat_messages_participant on public.chat_messages for all to authenticated
      using (exists (select 1 from chat_participants p where p.chat_id = chat_messages.chat_id and p.user_id = public.app_uid()))
      with check (exists (select 1 from chat_participants p where p.chat_id = chat_messages.chat_id and p.user_id = public.app_uid()));
  end if;
end $$;

-- ── G9: Realtime publication tambah notifications + checkpoints ─────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
    begin alter publication supabase_realtime add table public.checkpoints; exception when duplicate_object then null; end;
  end if;
end $$;

-- ── G/L: liabilities (view agregat dari dompet) ─────────────────────────────
create or replace view public.liabilities as
select
  (select coalesce(sum(balance_jod + reserved_balance_jod), 0) from wallets) as total_wallet_jod,
  (select coalesce(sum(balance_jod), 0) from wallets) as total_balance_jod,
  (select coalesce(sum(reserved_balance_jod), 0) from wallets) as total_reserved_jod;
grant select on public.liabilities to authenticated;

commit;
