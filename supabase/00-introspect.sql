-- =============================================================================
-- Sa7tein — INTROSPEKSI (BACA SAJA)
-- =============================================================================
-- Menghasilkan definisi lengkap schema `public` (kolom, PK, FK) supaya bisa
-- dibandingkan dengan docs/product/schema-draft-v1.md dan supabase/schema.sql.
-- Jalankan tiap query, lalu salin hasilnya.
-- =============================================================================

-- 1) KOLOM: satu baris per kolom
select c.table_name,
       c.ordinal_position as pos,
       c.column_name,
       c.data_type,
       c.is_nullable,
       c.column_default
from information_schema.columns c
join information_schema.tables t
  on t.table_schema = c.table_schema and t.table_name = c.table_name
where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
order by c.table_name, c.ordinal_position;

-- 2) PRIMARY KEY
select tc.table_name, kcu.column_name
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
order by tc.table_name, kcu.ordinal_position;

-- 3) FOREIGN KEY: anak -> induk
select tc.table_name as child_table,
       kcu.column_name as child_column,
       ccu.table_name as parent_table,
       ccu.column_name as parent_column
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu
  on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.table_schema = 'public' and tc.constraint_type = 'FOREIGN KEY'
order by child_table, child_column;

-- 4) Ringkasan cepat: tabel target schema.sql yang belum ada di DB
with expected(name) as (
  values ('users'), ('marketing'), ('merchants'), ('customers'), ('addresses'),
         ('couriers'), ('menus'), ('menu_variants'), ('batches'), ('orders'),
         ('order_items'), ('fav_merchants'), ('wallets'), ('ledgers'), ('chats'),
         ('chat_messages'), ('incident_resolutions'), ('rating_reviews')
)
select e.name as in_schema_sql_not_in_db
from expected e
where not exists (
  select 1 from information_schema.tables t
  where t.table_schema = 'public' and t.table_name = e.name and t.table_type = 'BASE TABLE'
)
order by e.name;
