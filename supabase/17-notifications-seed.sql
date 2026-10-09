-- =============================================================================
-- Sa7tein — inject data notifikasi (tabel `notifications`)
-- =============================================================================
-- Satu set contoh per peran (customer/merchant/courier/cs/superadmin). Kolom
-- `audience` ditambahkan untuk paritas dengan FE (inbox memfilter perannya).
-- Idempoten: hanya mengisi bila tabel masih kosong.
-- =============================================================================

begin;

alter table public.notifications add column if not exists audience text
  check (audience in ('customer', 'merchant', 'courier', 'cs', 'all'));

do $$
begin
  if (select count(*) from public.notifications) > 0 then
    return;  -- sudah ada isinya, jangan ganda
  end if;

  -- customer
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'order', 'Pesanan sedang dimasak', 'Toko sedang menyiapkan pesananmu.', 'order', false, 'customer' from public.users where role = 'customer';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'order', 'Kurir menuju lokasimu', 'Kurir sedang mengantar pesananmu.', 'courier', false, 'customer' from public.users where role = 'customer';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'promo', 'Diskon 30% pesanan pertama', 'Berlaku sampai akhir bulan.', 'promo', false, 'customer' from public.users where role = 'customer';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'payment', 'Pembayaran diterima', 'Pembayaran pesananmu sudah dikonfirmasi.', 'payment', true, 'customer' from public.users where role = 'customer';

  -- merchant
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'order', 'Order baru masuk', 'Ada pesanan baru menunggu diterima.', 'order', false, 'merchant' from public.users where role = 'merchant';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'order', 'Batch siap diantar', 'Batch pengantaran siap diserahkan ke kurir.', 'order', false, 'merchant' from public.users where role = 'merchant';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'system', 'Setelan toko diperbarui', 'Jam operasional & koordinat tersimpan.', 'system', true, 'merchant' from public.users where role = 'merchant';

  -- courier
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'courier', 'Tugas baru', 'Kamu ditugaskan mengantar sebuah pesanan.', 'courier', false, 'courier' from public.users where role = 'courier';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'order', 'Kurir berangkat', 'Pesanan dalam pengantaran.', 'courier', true, 'courier' from public.users where role = 'courier';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'system', 'Dompet tips diperbarui', 'Saldo tips bisa ditarik.', 'system', true, 'courier' from public.users where role = 'courier';

  -- cs
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'system', 'Alert SLA baru', 'Ada order yang melewati tenggat SLA.', 'system', false, 'cs' from public.users where role = 'cs';
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'order', 'Sengketa baru diajukan', 'Sengketa menunggu investigasi.', 'order', false, 'cs' from public.users where role = 'cs';

  -- superadmin
  insert into public.notifications (user_id, kind, title, body, sound, read, audience)
  select id, 'system', 'Ringkasan pajak bulanan tersedia', 'Laporan pajak periode ini siap ditinjau.', 'system', false, 'cs' from public.users where role = 'superadmin';
end $$;

commit;
