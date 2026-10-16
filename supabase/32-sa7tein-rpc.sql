-- =============================================================================
-- Sa7tein — RPC logika bisnis PRD aktif `sa7tein-mvp-2026-10-11` (M3–M9)
-- =============================================================================
-- Blocker eksternal DILEWATI sebagai state (OPEN-01 DANA, OPEN-02 kurs provider,
-- ARC-12 Google/DANA): RPC menghitung & mencatat, tanpa memanggil layanan luar.
--
-- Isi: parameter platform, kurs, harga (§16.3), kuota (§17), settlement (§16.4),
-- batch cap (§9.6), dispatch partner (§9.3-9.5), refund (§16.6), coverage (§9.1).
-- =============================================================================

begin;

-- ── Parameter platform (OPS-03/08; angka contoh hingga ops mengisi) ──────────
create table if not exists public.platform_params (
  id boolean primary key default true check (id),
  platform_fee_customer_jod numeric(12, 3) not null default 0.200,
  platform_fee_merchant_jod numeric(12, 3) not null default 0.250,
  quick_multiplier numeric(5, 2) not null default 1.50,
  transaction_fee_rate numeric(5, 4) not null default 0.0150,
  updated_at timestamptz not null default now()
);
insert into public.platform_params (id) values (true) on conflict (id) do nothing;
alter table public.platform_params enable row level security;
drop policy if exists platform_params_public_read on public.platform_params;
create policy platform_params_public_read on public.platform_params for select using (true);
drop policy if exists platform_params_ops on public.platform_params;
create policy platform_params_ops on public.platform_params for all using (public.app_is_ops());

-- ── Kurs (OPEN-02: provider belum dipilih; memakai baris terbaru) ────────────
create or replace function public.fx_rate_latest()
returns numeric language sql stable as $$
  select rate from public.exchange_rates where base = 'JOD' and quote = 'IDR'
  order by fetched_at desc nulls last limit 1
$$;

-- ── Harga order (§16.3). Mengembalikan rincian + settlement. ─────────────────
-- p_items: [{"unit_jod": 2.5, "qty": 2}, ...]
create or replace function public.price_order(
  p_merchant bigint,
  p_items jsonb,
  p_delivery_type text default 'regular',
  p_payment_method text default 'qris',
  p_discount_merchant_jod numeric default 0,
  p_discount_applicator_jod numeric default 0
) returns jsonb language plpgsql stable as $$
declare
  v_s numeric := 0;
  v_f numeric := 0;
  v_mult numeric;
  pc numeric; pm numeric; ft_rate numeric;
  v_ft numeric := 0;
  v_total_jod numeric;
  v_rate numeric;
  v_raw_idr numeric;
  v_total_idr bigint;
  v_rounding bigint;
begin
  select coalesce(sum((i->>'unit_jod')::numeric * (i->>'qty')::numeric), 0)
    into v_s from jsonb_array_elements(p_items) i;

  select coalesce(delivery_fee_jod, 0) into v_f
    from public.coverage_zones where merchant_id = p_merchant and active
    order by id limit 1;
  v_f := coalesce(v_f, 0);

  select quick_multiplier, platform_fee_customer_jod, platform_fee_merchant_jod, transaction_fee_rate
    into v_mult, pc, pm, ft_rate from public.platform_params where id;

  if p_delivery_type = 'quick' then v_f := v_f * v_mult; end if;

  if p_payment_method = 'qris' then
    v_ft := round(ft_rate * (v_s - p_discount_merchant_jod - p_discount_applicator_jod + v_f + pc), 2);
  end if;

  v_total_jod := v_s - p_discount_merchant_jod - p_discount_applicator_jod + v_f + pc + v_ft;
  v_rate := public.fx_rate_latest();
  v_raw_idr := v_total_jod * coalesce(v_rate, 0);
  v_total_idr := (ceil(v_raw_idr / 100) * 100)::bigint;
  v_rounding := v_total_idr - trunc(v_raw_idr)::bigint;

  return jsonb_build_object(
    'subtotal_jod', v_s,
    'discount_merchant_jod', p_discount_merchant_jod,
    'discount_applicator_jod', p_discount_applicator_jod,
    'delivery_fee_jod', v_f,
    'platform_fee_customer_jod', pc,
    'platform_fee_merchant_jod', pm,
    'transaction_fee_jod', v_ft,
    'total_jod', v_total_jod,
    'rate_locked', v_rate,
    'total_idr', v_total_idr,
    'rounding_up_idr', v_rounding,
    'payment_method', p_payment_method,
    'delivery_type', p_delivery_type
  );
end $$;

-- ── Kuota (§17): reserve -> consume/release. Prioritas order lalu order_cod. ──
create or replace function public.reserve_quota(p_merchant bigint, p_is_cod boolean default false)
returns text language plpgsql as $$
declare v_kind text; v_sub record;
begin
  for v_kind in
    select k from unnest(
      case when p_is_cod then array['order_cod'] else array['order', 'order_cod'] end
    ) k
  loop
    select id into v_sub from public.quota_subscriptions
      where merchant_id = p_merchant and kind = v_kind and status = 'active'
        and (period_end is null or period_end > now())
        and (quota_total - quota_used - quota_reserved) > 0
      order by id limit 1;
    if found then
      update public.quota_subscriptions set quota_reserved = quota_reserved + 1 where id = v_sub.id;
      return v_kind;
    end if;
  end loop;

  if not p_is_cod then
    if (select accept_without_quota from public.merchants where id = p_merchant) then
      return 'none';
    end if;
  end if;
  return null; -- tidak ada kuota; order tidak boleh dibuat
end $$;

create or replace function public.consume_quota(p_merchant bigint, p_kind text)
returns void language plpgsql as $$
begin
  if p_kind is null or p_kind = 'none' then return; end if;
  update public.quota_subscriptions
    set quota_reserved = greatest(quota_reserved - 1, 0), quota_used = quota_used + 1
    where id = (select id from public.quota_subscriptions
                where merchant_id = p_merchant and kind = p_kind and status = 'active'
                order by id limit 1);
end $$;

create or replace function public.release_quota(p_merchant bigint, p_kind text)
returns void language plpgsql as $$
begin
  if p_kind is null or p_kind = 'none' then return; end if;
  update public.quota_subscriptions
    set quota_reserved = greatest(quota_reserved - 1, 0)
    where id = (select id from public.quota_subscriptions
                where merchant_id = p_merchant and kind = p_kind and status = 'active'
                order by id limit 1);
end $$;

-- ── Settlement saat order selesai (§16.4) + ledger idempotent (NFR-01) ───────
create or replace function public.settle_order(p_order bigint)
returns void language plpgsql as $$
declare
  o record; pc numeric; pm numeric;
  merchant_amt numeric; courier_amt numeric; app_amt numeric;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order % tidak ada', p_order; end if;
  select platform_fee_customer_jod, platform_fee_merchant_jod into pc, pm from public.platform_params where id;

  merchant_amt := o.sub_total_jod - o.discount_merchant_jod;
  app_amt := pc - o.discount_applicator_jod;
  courier_amt := o.delivery_fee_jod;

  if o.quota_kind_used = 'order' then
    merchant_amt := merchant_amt; -- tanpa platform fee merchant
    app_amt := pc - o.discount_applicator_jod;
  elsif o.quota_kind_used = 'order_cod' then
    merchant_amt := merchant_amt + pc; -- Pc jadi hak merchant
    app_amt := -o.discount_applicator_jod;
  else
    merchant_amt := merchant_amt - coalesce(pm, 0);
    app_amt := pc + coalesce(pm, 0) - o.discount_applicator_jod;
  end if;

  insert into public.enterprise_ledger (order_id, entry_type, party, amount_jod, amount_idr, idempotency_key)
  values
    (p_order, 'payout', 'merchant', merchant_amt, 0, 'settle:' || p_order || ':merchant'),
    (p_order, 'payout', 'courier', courier_amt, 0, 'settle:' || p_order || ':courier'),
    (p_order, 'fee', 'applicator', app_amt, 0, 'settle:' || p_order || ':applicator')
  on conflict (idempotency_key) do nothing;
end $$;

-- ── Batch (§9.6, maks 24) + auto-sort rute ───────────────────────────────────
create or replace function public.assign_batch(p_order bigint, p_courier bigint)
returns bigint language plpgsql as $$
declare v_merchant bigint; v_batch bigint; v_cnt int;
begin
  select merchant_id into v_merchant from public.orders where id = p_order;
  select id into v_batch from public.batches
    where merchant_id = v_merchant and courier_id = p_courier and status in ('prepare', 'waitingCourier', 'waitingDelivery', 'delivery')
    order by id desc limit 1;
  if v_batch is null then
    insert into public.batches (merchant_id, courier_id, status) values (v_merchant, p_courier, 'prepare')
    returning id into v_batch;
  end if;
  select count(*) into v_cnt from public.orders where batch_id = v_batch;
  if v_cnt >= 24 then raise exception 'batch % penuh (24 order)', v_batch; end if;
  update public.orders set batch_id = v_batch, courier_id = p_courier where id = p_order;
  update public.batches b set order_count = (select count(*) from public.orders where batch_id = b.id) where b.id = v_batch;
  return v_batch;
end $$;

-- ── Dispatch kurir partner Quick (§9.3-9.5) ─────────────────────────────────
create or replace function public.dispatch_partner(p_order bigint)
returns bigint language plpgsql as $$
declare v_courier bigint; v_id bigint;
begin
  select c.id into v_courier from public.couriers c
    where c.courier_type = 'partner' and c.availability = 'available'
    order by c.active_order_count asc, c.id asc limit 1;
  if v_courier is null then return null; end if; -- menunggu (OPEN-14 diputuskan: sistem menunggu)
  insert into public.dispatch_assignments (order_id, courier_id, status)
    values (p_order, v_courier, 'reserved') returning id into v_id;
  update public.couriers set active_order_count = active_order_count + 1 where id = v_courier;
  return v_id;
end $$;

create or replace function public.respond_assignment(p_id bigint, p_status text, p_reason text default null)
returns void language plpgsql as $$
declare v_courier bigint;
begin
  if p_status not in ('approved', 'rejected') then raise exception 'status harus approved/rejected'; end if;
  if p_status = 'rejected' and coalesce(p_reason, '') = '' then raise exception 'reject wajib alasan (COU-18)'; end if;
  update public.dispatch_assignments
    set status = p_status, reject_reason = p_reason, responded_at = now()
    where id = p_id returning courier_id into v_courier;
  if p_status = 'rejected' then
    update public.couriers set active_order_count = greatest(active_order_count - 1, 0) where id = v_courier;
  end if;
end $$;

-- ── Refund (§16.6) ───────────────────────────────────────────────────────────
create or replace function public.create_refund(
  p_order bigint, p_method text, p_amount_idr bigint,
  p_bank text default null, p_account text default null
) returns bigint language plpgsql as $$
declare v_id bigint;
begin
  if p_method not in ('dana', 'bank_bifast') then raise exception 'metode refund tidak valid'; end if;
  if p_method = 'bank_bifast' and (coalesce(p_bank,'') = '' or coalesce(p_account,'') = '') then
    raise exception 'refund bank butuh nama bank + nomor rekening';
  end if;
  insert into public.refunds (order_id, method, amount_idr, bank_name, account_number, status, idempotency_key)
    values (p_order, p_method, p_amount_idr, p_bank, p_account, 'pending', 'refund:' || p_order)
    on conflict (idempotency_key) do nothing
    returning id into v_id;
  update public.orders set refund_status = 'pending' where id = p_order;
  return v_id;
end $$;

-- ── Coverage (§9.1): garis lurus untuk radius, polygon untuk mode polygon ────
create or replace function public.haversine_m(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable as $$
  select 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.check_coverage(p_merchant bigint, p_lat double precision, p_lng double precision)
returns boolean language plpgsql stable as $$
declare z record;
begin
  select * into z from public.coverage_zones where merchant_id = p_merchant and active order by id limit 1;
  if not found then return false; end if;
  if z.mode = 'radius' and z.center_lat is not null then
    return public.haversine_m(z.center_lat, z.center_lng, p_lat, p_lng) <= coalesce(z.radius_m, 2000);
  end if;
  return true; -- polygon: validasi presisi di desain teknis (OPEN-15 sudah diputuskan: coverage garis lurus)
end $$;

commit;
