-- =============================================================================
-- Sa7tein — SEED inti (idempoten) — merchant, menu, kurir, deposit, kredit
-- =============================================================================
-- Memperbaiki: FK ke merchants kosong + seed lama memakai kolom \`name\` yang
-- tidak ada di tabel (kolom yang benar: \`store_name\`, sesuai ERD Final).
-- Sumber: backup pra-rebuild + nama toko dari mock frontend (Warung Sate Pak Ali).
-- =============================================================================

begin;

insert into public.merchants (id, user_id, store_name, store_phone, store_address, latitude, longitude, description, available, delivery_config, tenant_status, deposit_jod, deposit_status)
overriding system value values
  (1, 2, 'Warung Sate Pak Ali', '+962790000002', 'Jl. Kebon Sirih No. 8, Irbid', 32.555, 35.85, 'Sate & masakan rumahan', true, '{"mode":"radius","radiusMeters":2000,"activeZones":["Hijazi","Syimali"]}'::jsonb, 'approved', 8.5, 'held')
on conflict (id) do nothing;

insert into public.couriers (id, user_id, merchant_id, name, availability)
overriding system value values (1, 3, 1, 'Budi Santoso', 'available')
on conflict (id) do nothing;

-- menus
insert into public.menus (id, merchant_id, name, description, price_jod, available, image, stock, category, created_at) overriding system value values (1, 1, 'Nasi Goreng Spesial', 'Nasi goreng dengan telur & ayam', 3.5, true, null, null, null, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
insert into public.menus (id, merchant_id, name, description, price_jod, available, image, stock, category, created_at) overriding system value values (2, 1, 'Gule Kambing', 'Gule kambing santan', 5.5, true, null, null, null, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
insert into public.menus (id, merchant_id, name, description, price_jod, available, image, stock, category, created_at) overriding system value values (3, 1, 'Es Teh Manis', 'Teh manis dingin', 0.75, true, null, null, null, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
insert into public.menus (id, merchant_id, name, description, price_jod, available, image, stock, category, created_at) overriding system value values (4, 1, 'Mie Goreng', 'Mie goreng sayur', 3, true, null, null, null, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
-- menu_variants
insert into public.menu_variants (id, menu_id, name, required, max_select, options, created_at) overriding system value values (1, 1, 'Pedas', false, 1, '[{"id":1,"name":"Tidak pedas","priceDeltaJod":0},{"id":2,"name":"Pedas","priceDeltaJod":0},{"id":3,"name":"Sangat pedas","priceDeltaJod":0.25}]'::jsonb, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
insert into public.menu_variants (id, menu_id, name, required, max_select, options, created_at) overriding system value values (2, 4, 'Pedas', false, 1, '[{"id":1,"name":"Tidak pedas","priceDeltaJod":0},{"id":2,"name":"Pedas","priceDeltaJod":0},{"id":3,"name":"Sangat pedas","priceDeltaJod":0.25}]'::jsonb, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
insert into public.menu_variants (id, menu_id, name, required, max_select, options, created_at) overriding system value values (3, 1, 'Ukuran', true, 1, '[{"id":1,"name":"Regular","priceDeltaJod":0},{"id":2,"name":"Jumbo","priceDeltaJod":1}]'::jsonb, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
-- deposits
insert into public.deposits (id, merchant_id, kind, amount_jod, status, verified_by, verified_at, created_at) overriding system value values (1, 1, 'founding_credit', 5, 'held', null, null, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
insert into public.deposits (id, merchant_id, kind, amount_jod, status, verified_by, verified_at, created_at) overriding system value values (2, 1, 'cod', 3.5, 'held', null, null, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;
-- merchant_credits
insert into public.merchant_credits (id, merchant_id, balance_jod, rebate_tier, rebate_period, rebate_amount_jod, rebate_paid_at, non_withdrawable, updated_at) overriding system value values (1, 1, 5, null, null, null, null, true, '2026-10-09T13:00:48.430667+00:00') on conflict (id) do nothing;

do $$
declare t text;
begin
  foreach t in array array['merchants','couriers','menus','menu_variants','deposits','merchant_credits'] loop
    execute format('select setval(pg_get_serial_sequence(''public.%I'',''id''), (select coalesce(max(id),0) from public.%I))', t, t);
  end loop;
end $$;

commit;
