INSERT OR IGNORE INTO courier_types (code,label,sort_order,is_active) VALUES
 ('inhouse','Kurir inhouse (karyawan merchant)',1,1),
 ('partner','Kurir partner (aplikator)',2,1),
 ('partner_ondemand','Kurir partner on-demand',3,1);
INSERT OR IGNORE INTO menu_categories (label,slug,sort_order,is_active) VALUES
 ('Makanan Utama','makanan-utama',1,1),('Minuman','minuman',2,1),('Camilan','camilan',3,1);
INSERT OR IGNORE INTO platform_params (id,platform_fee_customer_jod,platform_fee_merchant_jod,quick_multiplier,transaction_fee_rate) VALUES (1,0.2,0.25,1.5,0.015);
INSERT OR IGNORE INTO platform_switches (key,enabled) VALUES ('cod_enabled',1),('payout_enabled',1),('maintenance_mode',0);
INSERT INTO exchange_rates (base,quote,rate,source,effective_on) SELECT 'JOD','IDR',23000,'seed',date('now') WHERE NOT EXISTS (SELECT 1 FROM exchange_rates);
