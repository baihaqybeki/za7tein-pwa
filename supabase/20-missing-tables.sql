-- =============================================================================
-- Sa7tein — tabel yang belum terakomodir backend (dipakai UI)
--   * cards             — kartu pembayaran customer
--   * payout_accounts   — rekening tujuan pencairan (merchant & kurir)
--   * profit_withdrawals— penarikan laba platform (SA)
-- Aditif + RLS + seed contoh. Idempoten.
-- =============================================================================

begin;

-- 1) cards
create table if not exists public.cards (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references public.users (id) on delete cascade,
  brand      text not null,
  last4      text not null check (last4 ~ '^[0-9]{4}$'),
  holder     text,
  expiry     text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists cards_user_idx on public.cards (user_id);
alter table public.cards enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='cards' and policyname='cards_owner') then
    create policy cards_owner on public.cards for all to public
      using (user_id = public.app_uid()) with check (user_id = public.app_uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='cards' and policyname='cards_ops') then
    create policy cards_ops on public.cards for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- 2) payout_accounts
create table if not exists public.payout_accounts (
  id             bigint generated always as identity primary key,
  user_id        bigint not null references public.users (id) on delete cascade,
  bank_name      text not null,
  account_number text not null,
  holder_name    text not null,
  is_primary     boolean not null default false,
  created_at     timestamptz not null default now()
);
create index if not exists payout_accounts_user_idx on public.payout_accounts (user_id);
alter table public.payout_accounts enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='payout_accounts' and policyname='payout_accounts_owner') then
    create policy payout_accounts_owner on public.payout_accounts for all to public
      using (user_id = public.app_uid()) with check (user_id = public.app_uid());
  end if;
  if not exists (select 1 from pg_policies where tablename='payout_accounts' and policyname='payout_accounts_ops') then
    create policy payout_accounts_ops on public.payout_accounts for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- 3) profit_withdrawals
create table if not exists public.profit_withdrawals (
  id         bigint generated always as identity primary key,
  period     text,
  amount_jod numeric(12, 3) not null,
  method     text,
  status     text not null default 'processing'
               check (status in ('processing', 'paid', 'failed')),
  created_at timestamptz not null default now()
);
alter table public.profit_withdrawals enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='profit_withdrawals' and policyname='profit_withdrawals_ops') then
    create policy profit_withdrawals_ops on public.profit_withdrawals for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- seed contoh (hanya bila kosong)
insert into public.cards (user_id, brand, last4, holder, expiry, is_primary)
select 1, 'Visa', '4242', 'Budi Santoso', '12/27', true
where not exists (select 1 from public.cards);

insert into public.payout_accounts (user_id, bank_name, account_number, holder_name, is_primary)
select v.uid, v.bank, v.acct, v.holder, true
from (values
  (2,  'BCA', '8830112233', 'Ali Santoso'),
  (3,  'Mandiri', '1370099887', 'Budi Santoso'),
  (5,  'BNI', '0991122334', 'Umar Haddad')
) as v(uid, bank, acct, holder)
where not exists (select 1 from public.payout_accounts);

insert into public.profit_withdrawals (period, amount_jod, method, status)
select '2026-09', 250.0, 'bank_transfer', 'paid'
where not exists (select 1 from public.profit_withdrawals);

commit;
