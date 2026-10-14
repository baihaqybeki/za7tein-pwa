-- =============================================================================
-- Sa7tein — pencarian merchant (filter nama + rating + harga) untuk beranda
-- =============================================================================

begin;

create or replace function public.search_merchants(
  p_query      text default null,
  p_min_rating numeric default null,
  p_price_min  numeric default null,
  p_price_max  numeric default null
)
returns table (
  id            bigint,
  store_name    text,
  photo         text,
  store_status  text,
  rating_avg    numeric,
  rating_count  integer,
  open_time     time,
  close_time    time,
  min_price_jod numeric
)
language sql stable security definer set search_path = public
as $$
  select m.id, m.store_name, m.photo, m.store_status,
         m.rating_avg, m.rating_count, m.open_time, m.close_time,
         (select min(mn.price_jod) from menus mn where mn.merchant_id = m.id) as min_price_jod
  from merchants m
  where m.tenant_status = 'approved'
    and (p_query is null or btrim(p_query) = '' or m.store_name ilike '%' || btrim(p_query) || '%')
    and (p_min_rating is null or coalesce(m.rating_avg, 0) >= p_min_rating)
    and (p_price_min is null or exists (
          select 1 from menus mn where mn.merchant_id = m.id and mn.price_jod >= p_price_min))
    and (p_price_max is null or exists (
          select 1 from menus mn where mn.merchant_id = m.id and mn.price_jod <= p_price_max))
  order by coalesce(m.rating_avg, 0) desc, m.store_name asc;
$$;

grant execute on function public.search_merchants(text, numeric, numeric, numeric) to anon, authenticated;

commit;
