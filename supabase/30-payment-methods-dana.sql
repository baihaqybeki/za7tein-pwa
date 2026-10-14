-- =============================================================================
-- Sa7tein — metode bayar order: Saldo, COD, DANA Virtual Account, QRIS
-- (menggantikan transfer legacy; Xendit sudah dihapus sebelumnya)
-- =============================================================================

begin;

-- orders
alter table public.orders drop constraint if exists orders_payment_method_check;
update public.orders set payment_method = 'wallet' where payment_method not in ('wallet', 'cod', 'dana_va', 'qris');
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('wallet', 'cod', 'dana_va', 'qris'));

-- payments
alter table public.payments drop constraint if exists payments_method_check;
update public.payments set method = 'wallet' where method not in ('wallet', 'cod', 'dana_va', 'qris');
alter table public.payments add constraint payments_method_check
  check (method in ('wallet', 'cod', 'dana_va', 'qris'));

alter table public.payments drop constraint if exists payments_provider_check;
update public.payments set provider = 'wallet' where provider not in ('wallet', 'dana', 'none');
alter table public.payments add constraint payments_provider_check
  check (provider in ('wallet', 'dana', 'none'));

-- katalog
alter table public.payment_methods drop constraint if exists payment_methods_provider_check;
alter table public.payment_methods add constraint payment_methods_provider_check
  check (provider in ('wallet', 'dana', 'none'));
delete from public.payment_methods where key not in ('wallet', 'cod', 'dana_va', 'qris');
insert into public.payment_methods (key, label, provider, kind, fee_jod, description, sort_order) values
  ('wallet',  'Saldo Sa7tein',         'wallet', 'prepaid',  0.37, 'Bayar dari saldo wallet Sa7tein — top-up lewat DANA (VA/QRIS).', 1),
  ('cod',     'COD — Bayar di Tempat', 'none',   'postpaid', 0.37, 'Saldo dipotong (hold) saat kurir match, settle setelah OTP.', 2),
  ('dana_va', 'DANA Virtual Account',  'dana',   'prepaid',  0.37, 'Nomor VA dibuat otomatis; bayar dari m-banking atau e-wallet apa pun.', 3),
  ('qris',    'QRIS',                  'dana',   'prepaid',  0.37, 'Scan kode QR pakai aplikasi e-wallet atau m-banking apa pun.', 4)
on conflict (key) do update set
  label = excluded.label, provider = excluded.provider, kind = excluded.kind,
  fee_jod = excluded.fee_jod, description = excluded.description, sort_order = excluded.sort_order;

commit;
