-- Bersihkan sisa uji + rapikan relasi order_items -> menus.
DELETE FROM order_items WHERE name='x' AND order_id IN (842,843,844);
DELETE FROM orders WHERE id IN (842,843,844);
DELETE FROM order_otps WHERE order_id NOT IN (SELECT id FROM orders);
DELETE FROM order_items WHERE order_id NOT IN (SELECT id FROM orders);
DELETE FROM menus WHERE name='Tes';
-- remap menu_id berdasarkan (merchant, nama menu)
UPDATE order_items SET menu_id = (
  SELECT m.id FROM menus m JOIN orders o ON o.id=order_items.order_id
  WHERE m.merchant_id=o.merchant_id AND m.name=order_items.name LIMIT 1
) WHERE menu_id IS NULL OR NOT EXISTS (SELECT 1 FROM menus m WHERE m.id=order_items.menu_id);
UPDATE order_items SET menu_id=NULL WHERE menu_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM menus m WHERE m.id=order_items.menu_id);
-- order canceled tanpa item = sisa uji; hapus
DELETE FROM orders WHERE status='canceled' AND NOT EXISTS (SELECT 1 FROM order_items i WHERE i.order_id=orders.id);
