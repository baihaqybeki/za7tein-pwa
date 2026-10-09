-- =============================================================================
-- Sa7tein — HAPUS skema referensi (DESTRUKTIF, jalankan manual)
-- =============================================================================
-- Menghapus 7 tabel dari repo referensi `baihaqybeki/sa7tein`
-- (docs/product/prd/versions/irbid-mvp-v2-2026-09-21/repo-sa7tein-schema.md §6):
--   merchants, menu_items, orders, couriers, profiles, settings, order_messages
--
-- PERINGATAN
--   * Ini MENGHAPUS SEMUA DATA di tabel-tabel tersebut. Tidak bisa dibatalkan.
--   * Jalankan HANYA jika database project dwzxtnfesmpobnepilhl memang masih
--     berisi skema referensi lama dan isinya boleh dibuang.
--   * Jalankan skrip ini SEBELUM `schema.sql`, karena tiga nama bertabrakan
--     dengan skema target (merchants, orders, couriers: id text vs bigserial).
--     Tanpa drop, `CREATE TABLE IF NOT EXISTS` tidak akan memperbaiki kolomnya.
--   * `profiles` mereferensi auth.users — hanya tabel profil yang dihapus,
--     akun auth.users tidak disentuh.
--
-- Urutan yang benar:
--   1) reference-schema-drop.sql   (skrip ini)
--   2) schema.sql                  (skema target, aditif)
-- =============================================================================

-- cabut dari publication realtime dulu supaya tidak ada subscriber menggantung.
-- Tiap DROP dibungkus exception: tabel yang tidak ada / tidak terdaftar di
-- publication tidak boleh menggagalkan skrip.
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array[
      'merchants', 'menu_items', 'orders', 'couriers',
      'profiles', 'settings', 'order_messages'
    ] loop
      begin
        execute format('alter publication supabase_realtime drop table public.%I', t);
      exception when others then
        null;  -- tabel tidak ada atau tidak terdaftar di publication
      end;
    end loop;
  end if;
end $$;

drop table if exists public.order_messages cascade;
drop table if exists public.settings cascade;
drop table if exists public.profiles cascade;
drop table if exists public.menu_items cascade;
drop table if exists public.merchants cascade;   -- bertabrakan dengan skema target
drop table if exists public.orders cascade;      -- bertabrakan dengan skema target
drop table if exists public.couriers cascade;    -- bertabrakan dengan skema target
