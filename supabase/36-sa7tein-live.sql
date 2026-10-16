-- =============================================================================
-- Sa7tein — PRD aktif: auto-sort batch (M5), chat (M11), realtime (M12)
-- =============================================================================
-- auto_sort_batch memakai nearest-neighbor haversine (tanpa Google Routes API —
-- ARC-12 dilewati; OPEN-16 diputuskan: mulai merchant, berakhir order terakhir).
-- =============================================================================

begin;

-- ── M5: auto-sort rute batch (§9.6) — nearest neighbor dari merchant ─────────
create or replace function public.auto_sort_batch(p_batch bigint)
returns jsonb language plpgsql as $$
declare
  v_lat double precision; v_lng double precision;
  v_orders bigint[]; v_lats double precision[]; v_lngs double precision[];
  v_route bigint[] := '{}';
  v_cur_lat double precision; v_cur_lng double precision;
  v_best int; v_best_d double precision; v_d double precision;
  i int; j int; n int;
begin
  select m.latitude, m.longitude into v_lat, v_lng
    from public.batches b join public.merchants m on m.id = b.merchant_id where b.id = p_batch;
  select array_agg(o.id), array_agg(a.latitude), array_agg(a.longitude)
    into v_orders, v_lats, v_lngs
    from public.orders o join public.addresses a on a.id = o.delivery_address_id
    where o.batch_id = p_batch;
  if v_orders is null then return '[]'::jsonb; end if;

  n := array_length(v_orders, 1);
  v_cur_lat := v_lat; v_cur_lng := v_lng;
  for i in 1..n loop
    v_best := null; v_best_d := null;
    for j in 1..n loop
      if v_lats[j] is not null then
        v_d := public.haversine_m(v_cur_lat, v_cur_lng, v_lats[j], v_lngs[j]);
        if v_best_d is null or v_d < v_best_d then v_best_d := v_d; v_best := j; end if;
      end if;
    end loop;
    if v_best is not null then
      v_route := v_route || v_orders[v_best];
      v_cur_lat := v_lats[v_best]; v_cur_lng := v_lngs[v_best];
      v_lats[v_best] := null;
    end if;
  end loop;

  update public.batches set route = to_jsonb(v_route) where id = p_batch;
  return to_jsonb(v_route);
end $$;

-- ── M11: kirim pesan chat (teks/gambar) + auto-close (§20.1) ────────────────
create or replace function public.send_chat_message(
  p_order bigint, p_sender bigint, p_body text, p_image text default null
) returns bigint language plpgsql as $$
declare v_chat bigint; v_channel text; v_id bigint;
begin
  select id into v_chat from public.chats where order_id = p_order order by id limit 1;
  if v_chat is null then raise exception 'chat untuk order % tidak ada', p_order; end if;
  if (select closed_at from public.chats where id = v_chat) is not null then
    raise exception 'chat sudah ditutup';
  end if;
  v_channel := case when p_image is not null then 'image' else 'text' end;
  insert into public.chat_messages (chat_id, sender_id, channel, body)
    values (v_chat, p_sender, v_channel, coalesce(p_body, '')) returning id into v_id;
  update public.chats set last_message = coalesce(p_body, '[gambar]'), last_at = now() where id = v_chat;
  return v_id;
end $$;

create or replace function public.close_stale_chats()
returns integer language plpgsql as $$
declare v_count integer;
begin
  update public.chats set closed_at = now()
    where closed_at is null and auto_close_at is not null and auto_close_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ── M12: realtime untuk tabel PRD aktif (§19) ───────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['dispatch_assignments', 'quota_subscriptions', 'refunds', 'disputes', 'chat_messages']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

commit;
