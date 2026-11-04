-- Pulihkan "Warung Sate Pak Ali" (1) agar demo FE (mockMerchant) punya padanan backend.
DELETE FROM menus WHERE merchant_id = 1;
DELETE FROM merchants WHERE id = 1;
INSERT INTO merchants (id,user_id,store_name,store_phone,store_address,latitude,longitude,description,photo,delivery_config,tenant_status,store_status,rating_avg,rating_count,open_time,close_time,city,tier,is_active_hijazi,is_active_syimali,accept_without_quota)
VALUES (1,2,'Warung Sate Pak Ali','+962790000002','Jl. Kebon Sirih No. 8, Irbid',32.555,35.85,'Sate & masakan rumahan','/assets/img/merchant/warung-sate-pak-ali.svg','{"mode":"radius","activeZones":["Hijazi","Syimali"],"radiusMeters":2000}','approved','open',4.81,68,'08:00','23:30','Irbid','pro',1,1,0);
INSERT INTO menus (merchant_id,name,description,price_jod,available,image,category,cook_minutes,is_popular) VALUES
 (1,'Nasi Goreng Spesial','Nasi goreng dengan telur & ayam',3.5,1,'/assets/img/menu/nasi-goreng.webp','Makanan Utama',15,0),
 (1,'Sate Kambing (10 tusuk)','Sate kambing muda',5.5,1,'/assets/img/menu/sate-kambing.webp','Makanan Utama',20,0),
 (1,'Lontong Sayur','Lontong dengan sayur santan',3.0,1,'/assets/img/menu/lontong.webp','Makanan Utama',10,1),
 (1,'Es Teh Manis','Teh manis dingin',0.75,1,'/assets/img/menu/es-teh-manis.webp','Minuman',3,0);
