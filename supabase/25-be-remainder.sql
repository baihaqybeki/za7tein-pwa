-- =============================================================================
-- Sa7tein — sisa delta BE (bagian 1): SLA/auto-settle, coverage, items, promo, hold
-- Xendit & Google login dilewati. Aditif & idempoten.
-- =============================================================================

begin;

-- ── promo: hubungkan orders.promo_id -> marketing + seed ────────────────────
do $$
begin
  if not exists (select 1 from pg_constraint where conname='orders_promo_id_fkey') then
    alter table public.orders add constraint orders_promo_id_fkey
      foreign key (promo_id) references public.marketing (id) on delete set null;
  end if;
end $$;
insert into public.marketing (type, value, code, active_from, active_to, max_uses, used_count)
select 'discount_pct', 10, 'HEMAT10', now(), now() + interval '30 days', 100, 0
where not exists (select 1 from public.marketing);

-- ── G7: isi order_items (tabel ada, kosong) ─────────────────────────────────
insert into public.order_items (order_id, menu_id, name, qty, unit_price_jod, line_total_jod)
select o.id, m.id, m.name, 1 + (o.id % 3), m.price_jod, (1 + (o.id % 3)) * m.price_jod
from public.orders o
join lateral (
  select id, name, price_jod from public.menus
  where merchant_id = o.merchant_id order by (o.id + id) limit 1
) m on true
where not exists (select 1 from public.order_items oi where oi.order_id = o.id);

-- ── G10: coverage resolve (geofence) ────────────────────────────────────────
create or replace function public._haversine_m(p_lat1 double precision, p_lng1 double precision,
                                                p_lat2 double precision, p_lng2 double precision)
returns double precision language sql immutable as $$
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2) +
    cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  ));
$$;

create or replace function public._point_in_poly(p_lat double precision, p_lng double precision, poly jsonb)
returns boolean language plpgsql immutable as $$
declare
  n int; i int; j int; xi double precision; yi double precision; xj double precision; yj double precision; inside boolean := false;
begin
  if poly is null then return false; end if;
  n := jsonb_array_length(poly);
  if n < 3 then return false; end if;
  j := n - 1;
  for i in 0..n-1 loop
    xi := (poly->i->>0)::double precision; yi := (poly->i->>1)::double precision;
    xj := (poly->j->>0)::double precision; yj := (poly->j->>1)::double precision;
    if ((yi > p_lng) <> (yj > p_lng)) and
       (p_lat < (xj - xi) * (p_lng - yi) / (yj - yi) + xi) then
      inside := not inside;
    end if;
    j := i;
  end loop;
  return inside;
end $$;

create or replace function public.resolve_coverage(p_lat double precision, p_lng double precision, p_merchant_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  z record; m record; dist double precision; radius integer := 2000; covered boolean := false; zone_code text;
begin
  select id, code, polygon into z from zones
    where public._point_in_poly(p_lat, p_lng, polygon) limit 1;
  select latitude, longitude, delivery_config, is_active_hijazi, is_active_syimali, store_name
    into m from merchants where id = p_merchant_id;
  if m is null then return jsonb_build_object('covered', false, 'reason', 'merchant_not_found'); end if;
  dist := public._haversine_m(p_lat, p_lng, m.latitude, m.longitude);
  radius := coalesce((m.delivery_config->>'radiusMeters')::int, 2000);
  zone_code := z.code;
  covered := z.id is not null and dist <= radius
    and ( (z.code ilike 'hijazi' and m.is_active_hijazi) or (z.code ilike 'syimali' and m.is_active_syimali) or (z.code not ilike 'hijazi' and z.code not ilike 'syimali') );
  return jsonb_build_object(
    'covered', covered, 'zone', to_jsonb(z.code), 'distanceMeters', round(dist), 'radiusMeters', radius,
    'merchant', m.store_name
  );
end $$;
grant execute on function public.resolve_coverage(double precision, double precision, bigint) to anon, authenticated;

-- ── G2: SLA watcher + auto-settle (pg_cron) ─────────────────────────────────
create extension if not exists pg_cron;

create or replace function public.sla_watch()
returns void language plpgsql security definer set search_path = public as $$
declare r record; late_min int;
begin
  /* order aktif lewat ambang → notifikasi CS (dan merchant/kurir). */
  for r in
    select o.id, o.code, o.merchant_id, o.courier_id, o.status,
           floor(extract(epoch from (now() - o.placed_at)) / 60) as mins
    from orders o
    where o.status in ('prepare','waitingCourier','waitingDelivery','delivery')
      and o.placed_at is not null
  loop
    late_min := case when r.status='prepare' then r.mins - 15
                     when r.status='delivery' then r.mins - 30
                     else r.mins - 10 end;
    if late_min > 0 and not exists (
      select 1 from notifications n
      where n.order_id = r.id and n.audience = 'cs' and n.kind = 'system'
        and n.created_at > now() - interval '10 minutes'
    ) then
      insert into notifications (user_id, kind, title, body, sound, audience, order_id)
      select u.id, 'system', 'SLA terlewat ' || r.code,
             'Order ' || r.code || ' lewat ' || late_min || ' menit di tahap ' || r.status,
             'system', 'cs', r.id
      from users u
      where u.role in ('cs','superadmin')
        and not exists (select 1 from notifications n2 where n2.order_id = r.id and n2.user_id = u.id and n2.audience='cs' and n2.created_at > now() - interval '10 minutes');
    end if;
  end loop;
end $$;

create or replace function public.auto_settle_orders()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  /* order 'delivery' menggantung > 30 menit → settle tanpa OTP (F5). */
  for r in
    select id, customer_id from orders
    where status = 'delivery' and otp_verified = false
      and placed_at is not null and now() - placed_at > interval '30 minutes'
  loop
    update orders set otp_verified = true, hold_status = 'settled' where id = r.id;
    insert into checkpoints (order_id, kind, at) values (r.id, 'otp_verified', now());
    insert into wallet_ledgers (user_id, type, reference, amount_jod, order_id)
      select cu.user_id, 'db', 'order', coalesce(o.total_jod, 0), o.id
      from orders o join customers cu on cu.id = o.customer_id where o.id = r.id;
  end loop;
end $$;

do $$
begin
  if not exists (select 1 from cron.job where jobname='sa7tein-sla-watch') then
    perform cron.schedule('sa7tein-sla-watch', '* * * * *', 'select public.sla_watch();');
  end if;
  if not exists (select 1 from cron.job where jobname='sa7tein-auto-settle') then
    perform cron.schedule('sa7tein-auto-settle', '* * * * *', 'select public.auto_settle_orders();');
  end if;
end $$;

commit;
