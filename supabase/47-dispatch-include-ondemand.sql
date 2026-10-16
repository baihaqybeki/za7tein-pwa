-- =============================================================================
-- Sa7tein — dispatch partner mencakup partner_ondemand
-- =============================================================================
create or replace function public.dispatch_partner(p_order bigint)
returns bigint language plpgsql as $$
declare v_courier bigint; v_id bigint;
begin
  select c.id into v_courier from public.couriers c
    where c.courier_type in ('partner', 'partner_ondemand') and c.availability = 'available'
    order by c.active_order_count asc, c.id asc limit 1;
  if v_courier is null then return null; end if;
  insert into public.dispatch_assignments (order_id, courier_id, status)
    values (p_order, v_courier, 'reserved') returning id into v_id;
  update public.couriers set active_order_count = active_order_count + 1 where id = v_courier;
  return v_id;
end $$;
