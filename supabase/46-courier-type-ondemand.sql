-- =============================================================================
-- Sa7tein — tambah nilai courier_type: partner_ondemand (picklist ops)
-- =============================================================================
insert into public.courier_types (code, label, sort_order, is_active)
  values ('partner_ondemand', 'Kurir partner on-demand', 3, true)
on conflict (code) do update set label = excluded.label, sort_order = excluded.sort_order, is_active = excluded.is_active;
