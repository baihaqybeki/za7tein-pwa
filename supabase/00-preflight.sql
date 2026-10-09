-- =============================================================================
-- Sa7tein — PREFLIGHT (BACA SAJA, aman dijalankan)
-- =============================================================================
-- Untuk mendiagnosa error 42703 ("column does not exist") saat menjalankan
-- schema.sql. Penyebabnya: tabel lama sudah ada di schema `public`, sehingga
-- `CREATE TABLE IF NOT EXISTS` dilewati dan statement berikutnya menabrak kolom
-- yang tidak ada. Jalankan 3 query di bawah, lalu buang tabel yang bentrok.
-- =============================================================================

-- 1) Semua tabel di schema public + daftar kolomnya
select t.table_name,
       coalesce(string_agg(c.column_name, ', ' order by c.ordinal_position), '(tanpa kolom)') as columns
from information_schema.tables t
left join information_schema.columns c
  on c.table_schema = t.table_schema and c.table_name = t.table_name
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
group by t.table_name
order by t.table_name;

-- 2) Tabel TARGET yang SUDAH ADA (bentrok dengan CREATE TABLE IF NOT EXISTS).
--    Kalau ada, itu biang error-nya — harus di-drop dulu.
with expected(name) as (
  values
    ('users'), ('marketing'), ('merchants'), ('customers'), ('addresses'),
    ('couriers'), ('menus'), ('menu_variants'), ('batches'), ('orders'),
    ('order_items'), ('fav_merchants'), ('wallets'), ('ledgers'), ('chats'),
    ('chat_messages'), ('incident_resolutions'), ('rating_reviews')
)
select e.name as existing_conflicting_table
from expected e
join information_schema.tables t
  on t.table_schema = 'public' and t.table_name = e.name and t.table_type = 'BASE TABLE'
order by e.name;

-- 3) Tabel mana saja yang punya kolom bernama `type` (untuk menebak statement
--    yang gagal di skema kita: users / marketing / ledgers / incident_resolutions)
select table_name
from information_schema.columns
where table_schema = 'public' and column_name = 'type'
order by table_name;
