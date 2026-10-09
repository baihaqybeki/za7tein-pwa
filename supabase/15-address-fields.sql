-- =============================================================================
-- Sa7tein — lengkapi kolom alamat apartemen di `addresses`
-- =============================================================================
-- FE `Address` memakai name, building, floor, unit, notes, city, fullAddress —
-- kolomnya belum ada di DB (hanya label/address). Aditif & idempoten.
-- =============================================================================

begin;

alter table public.addresses add column if not exists name text;
alter table public.addresses add column if not exists building text;
alter table public.addresses add column if not exists floor text;
alter table public.addresses add column if not exists unit text;
alter table public.addresses add column if not exists notes text;
alter table public.addresses add column if not exists city text;
alter table public.addresses add column if not exists full_address text;

update public.addresses set
  name = coalesce(name, label),
  city = coalesce(city, 'Irbid'),
  full_address = coalesce(full_address, address),
  building = coalesce(building, 'Green View Apartment'),
  floor = coalesce(floor, ((id % 5) + 1)::text),
  unit = coalesce(unit, 'A' || id),
  notes = coalesce(notes, 'Titip ke resepsionis bila tidak ada di tempat');

commit;
