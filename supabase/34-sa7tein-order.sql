-- =============================================================================
-- Sa7tein — PRD aktif: create_order (M3 capstone) + magic link (M1, stub)
-- =============================================================================
-- Magic link: token dibuat & disimpan; pengiriman email SUNGGUHAN tidak ada
-- (AGENTS.md §1). Endpoint mengembalikan token sebagai state demo.
-- create_order memakai kolom identity (jangan set id eksplisit) dan status
-- awal 'prepare' (order diteruskan ke merchant setelah pembayaran, §7.1).
-- =============================================================================

begin;

-- ── M1: email magic link (ACC-01/02) ────────────────────────────────────────
create table if not exists public.magic_links (
  id bigserial primary key,
  email text not null,
  role text not null check (role in ('customer', 'merchant', 'courier_inhouse', 'courier_partner', 'ops')),
  token text not null unique,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists magic_links_email_idx on public.magic_links (email, role);
alter table public.magic_links enable row level security;
drop policy if exists magic_links_ops on public.magic_links;
create policy magic_links_ops on public.magic_links for all using (public.app_is_ops());

create or replace function public.request_magic_link(p_email text, p_role text default 'customer')
returns text language plpgsql as $$
declare v_token text;
begin
  if p_role not in ('customer', 'merchant', 'courier_inhouse', 'courier_partner', 'ops') then
    raise exception 'role tidak valid';
  end if;
  v_token := md5(random()::text || clock_timestamp()::text);
  insert into public.magic_links (email, role, token) values (lower(p_email), p_role, v_token);
  return v_token; -- state demo: token dikembalikan, bukan dikirim email
end $$;

create or replace function public.consume_magic_link(p_token text)
returns jsonb language plpgsql as $$
declare v record;
begin
  select * into v from public.magic_links where token = p_token;
  if not found then raise exception 'token tidak ditemukan'; end if;
  if v.consumed_at is not null then raise exception 'token sudah dipakai'; end if;
  if v.expires_at < now() then raise exception 'token kedaluwarsa'; end if;
  update public.magic_links set consumed_at = now() where id = v.id;
  return jsonb_build_object('email', v.email, 'role', v.role);
end $$;

-- ── M3 capstone: buat order lengkap (harga + kuota + diskon + snapshot + chat) ─
create or replace function public.create_order(
  p_customer bigint,
  p_merchant bigint,
  p_address bigint,
  p_items jsonb,                -- [{menu_id, qty, unit_jod, name, modifiers?}]
  p_delivery_type text default 'regular',
  p_payment_method text default 'qris',
  p_note text default null
) returns bigint language plpgsql as $$
declare
  v_lat double precision; v_lng double precision;
  v_kind text; v_disc jsonb; v_price jsonb;
  v_id bigint; v_code text; v_chat bigint; v_subtotal numeric;
  v_m_user bigint; v_c_user bigint;
begin
  if p_delivery_type not in ('regular', 'quick') then raise exception 'delivery_type tidak valid'; end if;
  if p_payment_method not in ('qris', 'dana_balance', 'cod') then raise exception 'payment_method tidak valid'; end if;

  select latitude, longitude into v_lat, v_lng from public.addresses where id = p_address;
  if v_lat is null then raise exception 'alamat % tidak ada', p_address; end if;
  if not public.check_coverage(p_merchant, v_lat, v_lng) then raise exception 'alamat di luar coverage merchant'; end if;

  v_kind := public.reserve_quota(p_merchant, p_payment_method = 'cod');
  if v_kind is null then raise exception 'merchant tidak menerima order (kuota habis)'; end if;

  select coalesce(sum((i->>'unit_jod')::numeric * (i->>'qty')::numeric), 0) into v_subtotal
    from jsonb_array_elements(p_items) i;
  v_disc := public.compute_discounts(p_merchant, v_subtotal);
  v_price := public.price_order(p_merchant, p_items, p_delivery_type, p_payment_method,
                                (v_disc->>'discount_merchant_jod')::numeric,
                                (v_disc->>'discount_applicator_jod')::numeric);

  v_code := 'SA-' || upper(substr(md5(random()::text), 1, 8));

  insert into public.orders (
    code, status, customer_id, merchant_id, delivery_address_id,
    sub_total_jod, delivery_fee_jod, platform_fee_jod, total_jod, total_idr,
    payment_method, payment_status, delivery_type, quota_kind_used, rate_locked,
    transaction_fee_jod, transaction_fee_idr, rounding_up_idr,
    platform_fee_customer_jod, platform_fee_merchant_jod,
    discount_merchant_jod, discount_applicator_jod, order_note, refund_status)
  values (
    v_code, 'prepare', p_customer, p_merchant, p_address,
    (v_price->>'subtotal_jod')::numeric, (v_price->>'delivery_fee_jod')::numeric,
    (v_price->>'platform_fee_customer_jod')::numeric + (v_price->>'platform_fee_merchant_jod')::numeric,
    (v_price->>'total_jod')::numeric, (v_price->>'total_idr')::numeric,
    p_payment_method, 'unpaid', p_delivery_type, v_kind, (v_price->>'rate_locked')::numeric,
    coalesce((v_price->>'transaction_fee_jod')::numeric, 0), coalesce((v_price->>'transaction_fee_idr')::bigint, 0),
    coalesce((v_price->>'rounding_up_idr')::bigint, 0),
    (v_price->>'platform_fee_customer_jod')::numeric, (v_price->>'platform_fee_merchant_jod')::numeric,
    (v_price->>'discount_merchant_jod')::numeric, (v_price->>'discount_applicator_jod')::numeric,
    p_note, 'none')
  returning id into v_id;

  insert into public.order_items (order_id, menu_id, name, qty, unit_price_jod, modifiers, line_total_jod)
  select v_id, (i->>'menu_id')::bigint, coalesce(i->>'name', ''), (i->>'qty')::int,
         (i->>'unit_jod')::numeric, coalesce(i->'modifiers', '[]'::jsonb),
         (i->>'unit_jod')::numeric * (i->>'qty')::numeric
  from jsonb_array_elements(p_items) i;

  perform public.snapshot_dispute_rules(v_id);

  insert into public.chats (order_id, auto_close_at) values (v_id, now() + interval '1 day')
    returning id into v_chat;
  select user_id into v_c_user from public.customers where id = p_customer;
  select user_id into v_m_user from public.merchants where id = p_merchant;
  insert into public.chat_participants (chat_id, user_id, role)
    select v_chat, u, 'customer' from (select v_c_user u) s
    where u is not null and not exists (select 1 from public.chat_participants cp where cp.chat_id = v_chat and cp.user_id = u);
  insert into public.chat_participants (chat_id, user_id, role)
    select v_chat, u, 'merchant' from (select v_m_user u) s
    where u is not null and not exists (select 1 from public.chat_participants cp where cp.chat_id = v_chat and cp.user_id = u);

  insert into public.notifications (user_id, kind, title, body, audience, order_id)
    select v_m_user, 'order', 'Order baru', v_code, 'merchant', v_id where v_m_user is not null;

  return v_id;
end $$;

commit;
