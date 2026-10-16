-- =============================================================================
-- Sa7tein — AP2.5 kadaluarsa pembayaran (30 mnt), AP10.5 job, AP3.4 alert kuota
-- Sumber: api-spec §17.3.1/§17.3.5, §17.6, §8.
-- =============================================================================

begin;

-- ── AP2.5: order dibayar online saat dibuat, batas 30 menit (§16.2) ─────────
alter table public.orders add column if not exists payment_expires_at timestamptz default (now() + interval '30 minutes');

create or replace function public.expire_unpaid_orders()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select id, merchant_id, quota_kind_used from public.orders
    where payment_status = 'unpaid'
      and status not in ('done', 'canceled')
      and payment_method <> 'cod'
      and coalesce(payment_expires_at, created_at + interval '30 minutes') < now()
  loop
    perform public.release_quota(r.merchant_id, r.quota_kind_used);
    update public.orders set status = 'canceled', cancel_by = 'system', cancel_reason = 'kadaluarsa'
      where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── AP3.4: alert kuota menipis/habis ke merchant (§17.3.5) ──────────────────
create or replace function public.quota_low_alerts()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; v_user bigint;
begin
  for r in
    select qs.id, qs.merchant_id, qs.kind, (qs.quota_total - qs.quota_used - qs.quota_reserved) as avail, m.user_id
    from public.quota_subscriptions qs join public.merchants m on m.id = qs.merchant_id
    where qs.status = 'active' and (qs.period_end is null or qs.period_end > now())
      and (qs.quota_total - qs.quota_used - qs.quota_reserved) <= 2
  loop
    v_user := r.user_id;
    if v_user is not null then
      insert into public.notifications (user_id, kind, title, body, audience)
        values (v_user, 'system', 'Kuota menipis',
                'Kuota ' || r.kind || ' tinggal ' || greatest(r.avail, 0) || '. Beli paket untuk lanjut menerima order.',
                'merchant');
      n := n + 1;
    end if;
  end loop;
  return n;
end $$;

-- ── AP10.5: satu pintu job cron ─────────────────────────────────────────────
create or replace function public.run_cron_jobs()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  return jsonb_build_object(
    'expired_orders', public.expire_unpaid_orders(),
    'stale_chats', public.close_stale_chats(),
    'quota_alerts', public.quota_low_alerts()
  );
end $$;

commit;
