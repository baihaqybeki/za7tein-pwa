-- =============================================================================
-- Sa7tein — validasi transisi status order + auto-isi cancel_by/reason
-- =============================================================================
-- BEFORE UPDATE on orders: tolak lompatan status yang tidak sah (state-machine),
-- dan isi `cancel_by`/`cancel_reason` saat masuk `canceled`. Ops (cs/superadmin)
-- boleh memaksa (override). Aditif & idempoten.
-- =============================================================================

begin;

create or replace function public.orders_validate_transition()
returns trigger language plpgsql security definer set search_path = public
as $$
declare allowed text[];
begin
  if old.status is not distinct from new.status then
    return new;
  end if;

  allowed := case old.status
    when 'cart'           then array['quotation','prepare','canceled']
    when 'quotation'      then array['prepare','canceled']
    when 'prepare'        then array['waitingCourier','waitingDelivery','delivery','canceled','done']
    when 'waitingCourier' then array['waitingDelivery','delivery','canceled']
    when 'waitingDelivery' then array['delivery','canceled','done']
    when 'delivery'       then array['done','canceled']
    else array[]::text[]
  end;

  -- ops (cs/superadmin) boleh memaksa transisi apa pun.
  if not public.app_is_ops() and not (new.status = any(allowed)) then
    raise exception 'transisi status % -> % tidak diizinkan', old.status, new.status
      using errcode = '23514';
  end if;

  if new.status = 'canceled' then
    if new.cancel_by is null then
      new.cancel_by := case public.app_role()
        when 'customer' then 'customer'
        when 'merchant' then 'merchant'
        else 'system' end;
    end if;
    if new.cancel_reason is null then
      new.cancel_reason := 'dibatalkan';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists orders_validate_transition on public.orders;
create trigger orders_validate_transition before update of status on public.orders
  for each row execute function public.orders_validate_transition();

commit;
