-- =============================================================================
-- Sa7tein — PRD aktif: orkestrasi selesai/batal (M4/M7) + ops params (M13)
-- =============================================================================

begin;

-- ── Order selesai: consume quota + settlement + notifikasi (§16.4, §17) ──────
create or replace function public.complete_order(p_order bigint)
returns void language plpgsql as $$
declare o record; v_customer_user bigint;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order % tidak ada', p_order; end if;

  update public.orders set status = 'done', payment_status = 'paid' where id = p_order;

  perform public.consume_quota(o.merchant_id, o.quota_kind_used);
  perform public.settle_order(p_order);

  select user_id into v_customer_user from public.customers where id = o.customer_id;
  if v_customer_user is not null then
    insert into public.notifications (user_id, kind, title, body, audience, order_id)
      values (v_customer_user, 'order', 'Pesanan selesai', o.code, 'customer', p_order);
  end if;
end $$;

-- ── Order batal/tolak: release quota + refund bila sudah dibayar (§7.4, §16.6) ─
create or replace function public.cancel_order(p_order bigint, p_by text, p_reason text default 'dibatalkan')
returns void language plpgsql as $$
declare o record;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order % tidak ada', p_order; end if;

  perform public.release_quota(o.merchant_id, o.quota_kind_used);

  update public.orders set status = 'canceled', cancel_by = coalesce(p_by, 'system'),
         cancel_reason = coalesce(p_reason, 'dibatalkan') where id = p_order;

  if o.payment_status = 'paid' and coalesce(o.total_idr, 0) > 0 then
    perform public.create_refund(p_order, 'dana', o.total_idr::bigint);
  end if;
end $$;

-- ── OPS: atur parameter platform (OPS-03/08, NFR-07) ────────────────────────
create or replace function public.ops_set_platform_params(
  p_fee_customer numeric default null,
  p_fee_merchant numeric default null,
  p_quick_multiplier numeric default null,
  p_transaction_fee_rate numeric default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.app_is_ops() then raise exception 'hanya ops yang boleh mengubah parameter'; end if;
  update public.platform_params set
    platform_fee_customer_jod = coalesce(p_fee_customer, platform_fee_customer_jod),
    platform_fee_merchant_jod = coalesce(p_fee_merchant, platform_fee_merchant_jod),
    quick_multiplier = coalesce(p_quick_multiplier, quick_multiplier),
    transaction_fee_rate = coalesce(p_transaction_fee_rate, transaction_fee_rate),
    updated_at = now()
  where id;
end $$;

-- ── OPS: KPI ringkas (OPS-11) ───────────────────────────────────────────────
create or replace view public.ops_kpis as
select
  count(*) filter (where status in ('prepare', 'waitingCourier', 'waitingDelivery', 'delivery')) as orders_active,
  count(*) filter (where status = 'done') as orders_done,
  count(*) filter (where status = 'canceled') as orders_canceled,
  coalesce(sum(total_jod) filter (where status = 'done'), 0) as gmv_jod,
  coalesce(sum(transaction_fee_jod) filter (where status = 'done'), 0) as transaction_fee_jod,
  (select count(*) from public.merchants where tenant_status = 'approved') as merchants_approved,
  (select count(*) from public.couriers) as couriers,
  (select count(*) from public.refunds where status = 'pending') as refunds_pending
from public.orders;

commit;
