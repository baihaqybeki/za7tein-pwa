-- =============================================================================
-- Sa7tein — courier type sebagai picklist ops (menggantikan CHECK text)
-- =============================================================================
-- Konteks: `couriers.courier_type` text ber-CHECK {inhouse,partner}. Diganti
-- tabel lookup yang dikelola ops (pola sama dengan menu_categories/DEC-88104),
-- supaya jenis kurir baru bisa ditambah tanpa migrasi.
-- =============================================================================

begin;

create table if not exists public.courier_types (
  id         bigserial primary key,
  code       text not null unique,
  label      text not null,
  sort_order integer not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.courier_types (code, label, sort_order) values
  ('inhouse', 'Kurir inhouse (karyawan merchant)', 1),
  ('partner', 'Kurir partner (aplikator)', 2)
on conflict (code) do nothing;

alter table public.courier_types enable row level security;
drop policy if exists courier_types_read on public.courier_types;
create policy courier_types_read on public.courier_types for select using (is_active);
drop policy if exists courier_types_ops on public.courier_types;
create policy courier_types_ops on public.courier_types for all using (public.app_is_ops());

-- Ganti CHECK dengan FK ke picklist (courier_type menyimpan `code`).
alter table public.couriers drop constraint if exists couriers_type_check;
alter table public.couriers drop constraint if exists couriers_type_fk;
alter table public.couriers add constraint couriers_type_fk
  foreign key (courier_type) references public.courier_types (code) on update cascade;

-- RPC upsert picklist (ops-only), dipetakan dari UI konsol ops.
create or replace function public.ops_upsert_courier_type(
  p_code text, p_label text, p_sort integer default 0, p_active boolean default true
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.app_is_ops() then raise exception 'hanya ops yang boleh mengubah picklist'; end if;
  insert into public.courier_types (code, label, sort_order, is_active)
    values (p_code, p_label, p_sort, p_active)
    on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order, is_active = excluded.is_active
    returning id into v_id;
  return v_id;
end $$;

commit;
