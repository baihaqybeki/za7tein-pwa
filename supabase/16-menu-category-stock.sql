-- =============================================================================
-- Sa7tein — isi `menus.category` & `menus.stock` yang kosong
-- =============================================================================
-- Kategori mengikuti id FE (CATEGORIES): 'Makanan Utama' | 'Minuman' | 'Camilan'.
-- Stock angka mock deterministik. Aditif & idempoten (hanya mengisi yang null).
-- =============================================================================

begin;

update public.menus set category = case
  when name ilike '%es teh%' or name ilike '%teh%' or name ilike '%kopi%' or name ilike '%jus%' then 'Minuman'
  when name ilike '%kerupuk%' or name ilike '%pisang%' or name ilike '%tahu%' then 'Camilan'
  else 'Makanan Utama'
end
where category is null;

update public.menus set stock = 8 + ((id * 7) % 40)
where stock is null;

commit;
