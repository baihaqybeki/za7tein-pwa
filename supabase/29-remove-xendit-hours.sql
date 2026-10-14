-- =============================================================================
-- Sa7tein — hapus opsi Xendit dari metode bayar ORDER + jam operasional merchant
-- =============================================================================
-- Xendit (xendit_va/xendit_qris) tidak dipakai → dibuang dari orders/payments/
-- payment_methods. Data lama dipetakan ke 'wallet'. Aditif & idempoten.
-- (Kanal TOP-UP via Xendit di luar cakupan ini.)
-- =============================================================================

begin;

-- 1) migrasi data lama
update public.orders set payment_method = 'wallet' where payment_method in ('xendit_va', 'xendit_qris');
update public.payments set method = 'wallet' where method in ('xendit_va', 'xendit_qris');
update public.payments set provider = 'wallet' where provider = 'xendit';

-- 2) perketat enum
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('cod', 'transfer', 'wallet'));

alter table public.payments drop constraint if exists payments_method_check;
alter table public.payments add constraint payments_method_check
  check (method in ('cod', 'transfer', 'wallet'));

alter table public.payments drop constraint if exists payments_provider_check;
alter table public.payments add constraint payments_provider_check
  check (provider in ('wallet', 'none'));

-- 3) hapus dari katalog metode bayar
delete from public.payment_methods where key in ('xendit_va', 'xendit_qris');

-- 4) jam operasional merchant: pastikan bisa diubah pemilik (RLS merchants_owner
--    sudah `user_id = app_uid()` → UPDATE kolom open_time/close_time diizinkan).
--    Tambah validasi ringan: tutup harus beda dari buka.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'merchants_hours_check') then
    alter table public.merchants add constraint merchants_hours_check
      check (open_time is null or close_time is null or open_time <> close_time);
  end if;
end $$;

commit;
