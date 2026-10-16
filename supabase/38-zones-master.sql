-- =============================================================================
-- Sa7tein — master zona: izin tulis ops + helper upsert (sesuai docs /zones POST)
-- =============================================================================
-- docs/backend/openapi.yaml: `GET /zones` (master, publik) dan `POST /zones`
-- "Buat zona (butuh izin zone.write)" oleh Super Admin. Backend hanya punya
-- policy `zones_public_read`; belum ada izin tulis → Super Admin tak bisa
-- mendefinisikan zona. Migrasi ini menambah policy tulis ops + RPC upsert.
--
-- Format `polygon` (sesuai `resolve_coverage`/`_point_in_poly`): array [[lat,lng],...].
-- =============================================================================

begin;

-- Ops (cs/superadmin) boleh mengelola master zona.
drop policy if exists zones_ops on public.zones;
create policy zones_ops on public.zones for all
  using (public.app_is_ops())
  with check (public.app_is_ops());

-- RPC upsert zona (dipakai konsol SA; dipetakan dari POST/PATCH /zones).
create or replace function public.ops_upsert_zone(
  p_code text,
  p_name text,
  p_polygon jsonb,
  p_id bigint default null
) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.app_is_ops() then raise exception 'hanya ops yang boleh mengubah master zona'; end if;
  if p_polygon is null or jsonb_typeof(p_polygon) <> 'array' or jsonb_array_length(p_polygon) < 3 then
    raise exception 'polygon butuh minimal 3 titik [lat,lng]';
  end if;
  if p_id is not null then
    update public.zones set code = p_code, name = p_name, polygon = p_polygon where id = p_id
      returning id into v_id;
  else
    insert into public.zones (code, name, polygon) values (p_code, p_name, p_polygon)
      on conflict (code) do update set name = excluded.name, polygon = excluded.polygon
      returning id into v_id;
  end if;
  return v_id;
end $$;

grant execute on function public.ops_upsert_zone(text, text, jsonb, bigint) to authenticated;

commit;
