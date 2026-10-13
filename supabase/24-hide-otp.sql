-- =============================================================================
-- Sa7tein — sembunyikan orders.otp dari peran klien (G6 lanjutan)
-- =============================================================================
-- `revoke select (otp)` saja tidak cukup: grant SELECT level-tabel menutupinya.
-- Jadi: cabut SELECT tabel, lalu grant SELECT per kolom (semua KECUALI otp).
-- Konsekuensi: klien harus memilih kolom eksplisit (bukan `select=*`).
-- Customer tetap bisa lihat OTP-nya via RPC `my_order_otp(order_id)`.
-- =============================================================================

begin;

do $$
declare cols text;
begin
  select string_agg(quote_ident(column_name), ', ') into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'orders' and column_name <> 'otp';

  execute 'revoke select on public.orders from anon, authenticated';
  execute 'grant select (' || cols || ') on public.orders to anon, authenticated';
end $$;

commit;
