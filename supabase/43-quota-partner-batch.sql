-- =============================================================================
-- Sa7tein — AP3.2 beli paket kuota, AP6.1 status kurir partner, AP4.2 tutup batch
-- Sumber: api-spec §17.3.5, §17.3.3, §17.3.2 (PRD aktif).
-- =============================================================================

begin;

-- ── AP3.2: beli paket kuota (QRIS kena Ft 1,5%; DANA tidak) ─────────────────
create or replace function public.buy_quota_package(
  p_merchant bigint, p_package bigint, p_method text default 'qris'
) returns bigint language plpgsql as $$
declare pk record; v_ft numeric := 0; v_id bigint;
begin
  select * into pk from public.quota_packages where id = p_package and active;
  if not found then raise exception 'paket tidak ditemukan'; end if;
  if p_method not in ('qris', 'dana_balance') then raise exception 'metode paket tidak valid'; end if;
  if p_method = 'qris' then v_ft := round(0.015 * pk.price_jod, 2); end if;

  insert into public.quota_subscriptions (merchant_id, kind, package_id, quota_total, period_start, period_end, status)
    values (p_merchant, pk.kind, pk.id, pk.quota, now(),
            now() + case pk.period when 'day' then interval '1 day' when 'week' then interval '7 days' else interval '1 month' end,
            'active')
    returning id into v_id;

  insert into public.enterprise_ledger (entry_type, party, amount_jod, amount_idr, idempotency_key, note)
    values ('charge', 'merchant', pk.price_jod + v_ft, 0, 'quota:' || v_id || ':charge',
            'beli paket kuota ' || pk.kind || ' (' || p_method || ')')
    on conflict (idempotency_key) do nothing;

  return v_id;
end $$;

-- ── AP6.1: status kurir partner (peta ke enum availability yang ada) ───────
create or replace function public.set_courier_status(p_courier bigint, p_status text)
returns void language plpgsql as $$
declare v text;
begin
  if p_status not in ('offline', 'available', 'busy', 'reserved') then
    raise exception 'status kurir tidak valid';
  end if;
  v := case p_status when 'offline' then 'unavailable' when 'reserved' then 'busy' else p_status end;
  update public.couriers set availability = v where id = p_courier;
end $$;

-- ── AP4.2: tutup batch lebih awal (§9.6, BR-B) ──────────────────────────────
create or replace function public.close_batch(p_batch bigint)
returns void language plpgsql as $$
begin
  update public.batches set status = 'closed' where id = p_batch and status in ('prepare', 'waitingCourier', 'waitingDelivery', 'delivery');
  if not found then raise exception 'batch % tidak bisa ditutup', p_batch; end if;
end $$;

commit;
