-- =============================================================================
-- Sa7tein — definisikan SEMUA metode pembayaran di backend
--   cod · transfer · xendit_va · xendit_qris · wallet (saldo)
-- Memperbaiki: `wallet` tak ada di check orders/payments, dan metode tak punya
-- tabel definisi. Aditif + idempoten.
-- =============================================================================

begin;

-- 1) orders.payment_method: tambah wallet
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'transfer', 'xendit_va', 'xendit_qris', 'wallet'));

-- 2) payments.method: tambah wallet; provider: tambah wallet
alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cod', 'transfer', 'xendit_va', 'xendit_qris', 'wallet'));

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('xendit', 'wallet', 'none'));

-- 3) Tabel definisi metode pembayaran (katalog) — "all payment" di satu tempat
create table if not exists public.payment_methods (
  key         text primary key,
  label       text not null,
  provider    text not null check (provider in ('xendit', 'wallet', 'none')),
  kind        text not null check (kind in ('prepaid', 'postpaid')),
  fee_jod     numeric(12, 3) not null default 0,   -- fee platform (DEC-1037: flat 0,37; transfer 0)
  description text,
  active      boolean not null default true,
  sort_order  integer not null default 0
);

insert into public.payment_methods (key, label, provider, kind, fee_jod, description, sort_order) values
  ('wallet',      'Saldo Sa7tein',   'wallet', 'prepaid',  0.37, 'Bayar dari saldo wallet Sa7tein; top-up via Xendit (VA/QRIS).', 1),
  ('cod',         'COD — Bayar di Tempat', 'none', 'postpaid', 0.37, 'Tunai saat serah terima; saldo customer di-hold saat kurir match, settle setelah OTP.', 2),
  ('transfer',    'Transfer Manual', 'none',   'postpaid',  0,    'Transfer langsung ke rekening merchant; platform tidak menahan dana (DEC-1037).', 3),
  ('xendit_va',   'Xendit Virtual Account', 'xendit', 'prepaid', 0.37, 'Virtual Account via Xendit (C-01, DEC-1039).', 4),
  ('xendit_qris', 'Xendit QRIS',     'xendit', 'prepaid',  0.37, 'QRIS via Xendit (C-01, DEC-1039).', 5)
on conflict (key) do nothing;

-- 4) FK opsional: pastikan orders/payments hanya memakai metode terdaftar
alter table public.orders drop constraint if exists orders_payment_method_fkey;
alter table public.orders add constraint orders_payment_method_fkey
  foreign key (payment_method) references public.payment_methods (key);

alter table public.payments drop constraint if exists payments_method_fkey;
alter table public.payments add constraint payments_method_fkey
  foreign key (method) references public.payment_methods (key);

-- 5) RLS: baca publik (katalog), tulis ops
alter table public.payment_methods enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_methods' and policyname='payment_methods_public_read') then
    create policy payment_methods_public_read on public.payment_methods for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='payment_methods' and policyname='payment_methods_ops') then
    create policy payment_methods_ops on public.payment_methods for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

commit;
