-- =============================================================================
-- Sa7tein — AP1.2 kategori menu sebagai taksonomi ops (DEC-88104, api-spec §17.3.6)
-- =============================================================================
-- Spec: `menus.category` masih teks bebas; kategori = taksonomi **ops/BE**
-- (merchant memilih, tak mengelola). Tambah `menu_categories` + `menus.category_id`
-- (FK), backfill dari teks lama. FE baca-saja; jalur tulis ops.
-- =============================================================================

begin;

create table if not exists public.menu_categories (
  id         bigserial primary key,
  label      text not null,
  slug       text not null unique,
  icon       text,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.menu_categories (label, slug, sort_order) values
  ('Makanan Utama', 'makanan-utama', 1),
  ('Minuman',       'minuman',       2),
  ('Camilan',       'camilan',       3)
on conflict (slug) do nothing;

alter table public.menus add column if not exists category_id bigint references public.menu_categories (id);
create index if not exists menus_category_idx on public.menus (category_id);

-- Backfill dari teks lama (label) — belum ada → slug.
update public.menus m
  set category_id = c.id
  from public.menu_categories c
  where m.category_id is null
    and (lower(m.category) = lower(c.label) or lower(m.category) = c.slug);

alter table public.menu_categories enable row level security;
drop policy if exists menu_categories_public_read on public.menu_categories;
create policy menu_categories_public_read on public.menu_categories for select using (is_active);
drop policy if exists menu_categories_ops on public.menu_categories;
create policy menu_categories_ops on public.menu_categories for all using (public.app_is_ops());

commit;
