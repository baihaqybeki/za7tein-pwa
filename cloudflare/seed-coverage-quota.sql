-- Perbaikan data pasca-prune: coverage + kuota untuk merchant yang tersisa.
INSERT INTO coverage_zones (merchant_id,mode,center_lat,center_lng,radius_m,delivery_fee_jod,active)
SELECT m.id,'radius',m.latitude,m.longitude,2000,1.0,1 FROM merchants m
WHERE m.latitude IS NOT NULL AND NOT EXISTS (SELECT 1 FROM coverage_zones z WHERE z.merchant_id=m.id);
INSERT INTO quota_subscriptions (merchant_id,kind,package_id,quota_total,quota_used,quota_reserved,period_start,period_end,status)
SELECT m.id,'order',(select id from quota_packages where kind='order' order by id limit 1),20,0,0,datetime('now'),datetime('now','+1 day'),'active'
FROM merchants m WHERE NOT EXISTS (SELECT 1 FROM quota_subscriptions q WHERE q.merchant_id=m.id AND q.kind='order');
INSERT INTO quota_subscriptions (merchant_id,kind,package_id,quota_total,quota_used,quota_reserved,period_start,period_end,status)
SELECT m.id,'order_cod',(select id from quota_packages where kind='order_cod' order by id limit 1),10,0,0,datetime('now'),datetime('now','+1 day'),'active'
FROM merchants m WHERE NOT EXISTS (SELECT 1 FROM quota_subscriptions q WHERE q.merchant_id=m.id AND q.kind='order_cod');
