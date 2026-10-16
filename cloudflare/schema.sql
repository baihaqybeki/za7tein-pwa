-- =============================================================================
-- Sa7tein — skema D1 (SQLite) hasil konversi dari supabase/*.sql (C1)
-- =============================================================================
-- Konversi: bigserial -> INTEGER PRIMARY KEY AUTOINCREMENT; timestamptz -> TEXT (ISO);
-- numeric -> REAL (uang JOD) / INTEGER (IDR); boolean -> INTEGER (0/1); jsonb -> TEXT.
-- RLS dan plpgsql TIDAK ada di D1: authz & logika bisnis pindah ke Worker (C2).
-- Perilaku RPC (supabase/31-47) jadi acuan implementasi JS, bukan disalin.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- Identitas
CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, auth_user_id TEXT, role TEXT, email TEXT, phone TEXT, verified INTEGER DEFAULT 0, status TEXT DEFAULT 'active', auth_provider TEXT, name TEXT, dob TEXT, gender TEXT, avatar TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, name TEXT, risk_flag INTEGER DEFAULT 0, status TEXT DEFAULT 'active', avatar TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS customer_risk_flags (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER, reason TEXT, by_operator_id INTEGER, at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS addresses (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, label TEXT, address TEXT, latitude REAL, longitude REAL, is_default INTEGER DEFAULT 0, zone_id INTEGER, zone_code TEXT, name TEXT, building TEXT, floor TEXT, unit TEXT, notes TEXT, city TEXT, full_address TEXT, created_at TEXT DEFAULT (datetime('now')));

-- Merchant & katalog
CREATE TABLE IF NOT EXISTS merchants (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, store_name TEXT, store_phone TEXT, store_address TEXT, latitude REAL, longitude REAL, description TEXT, photo TEXT, delivery_config TEXT, tenant_status TEXT DEFAULT 'pending', deposit_jod REAL DEFAULT 0, deposit_status TEXT, store_status TEXT DEFAULT 'closed', rating_avg REAL DEFAULT 0, rating_count INTEGER DEFAULT 0, open_time TEXT, close_time TEXT, owner TEXT, owner_phone TEXT, city TEXT, tier TEXT, is_active_hijazi INTEGER DEFAULT 0, is_active_syimali INTEGER DEFAULT 0, cod_issues INTEGER DEFAULT 0, accept_without_quota INTEGER DEFAULT 0, approved_at TEXT, status_reason TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS menu_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, label TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, icon TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS menus (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, name TEXT NOT NULL, description TEXT, price_jod REAL DEFAULT 0, available INTEGER DEFAULT 1, image TEXT, stock INTEGER, category TEXT, category_id INTEGER, cook_minutes INTEGER, discount_percent INTEGER, is_popular INTEGER DEFAULT 0, calories INTEGER, note_enabled INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS menu_variants (id INTEGER PRIMARY KEY AUTOINCREMENT, menu_id INTEGER, name TEXT, required INTEGER DEFAULT 0, max_select INTEGER, options TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS product_attributes (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, display_type TEXT DEFAULT 'pills', create_variant TEXT DEFAULT 'always', sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS product_attribute_values (id INTEGER PRIMARY KEY AUTOINCREMENT, attribute_id INTEGER, name TEXT NOT NULL, html_color TEXT, price_extra REAL DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS menu_attribute_lines (id INTEGER PRIMARY KEY AUTOINCREMENT, menu_id INTEGER, attribute_id INTEGER, required INTEGER DEFAULT 0, exclude_for TEXT DEFAULT '[]', sort_order INTEGER DEFAULT 0, UNIQUE (menu_id, attribute_id));

-- Kurir
CREATE TABLE IF NOT EXISTS courier_types (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, label TEXT NOT NULL, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS couriers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, merchant_id INTEGER, name TEXT, availability TEXT DEFAULT 'unavailable', latitude REAL, longitude REAL, last_seen_at TEXT, photo TEXT, vehicle TEXT, phone TEXT, phone_verified INTEGER DEFAULT 0, active_order_count INTEGER DEFAULT 0, courier_type TEXT DEFAULT 'inhouse', created_at TEXT DEFAULT (datetime('now')));

-- Zona & order
CREATE TABLE IF NOT EXISTS zones (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, polygon TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT, status TEXT DEFAULT 'cart', customer_id INTEGER, merchant_id INTEGER, delivery_address_id INTEGER, batch_id INTEGER, courier_id INTEGER, sub_total_jod REAL, delivery_fee_jod REAL, platform_fee_jod REAL, tip_jod REAL, promo_amount_jod REAL, total_jod REAL, total_idr INTEGER, zone_id INTEGER, zone_code TEXT, promo_id INTEGER, payment_method TEXT, payment_status TEXT DEFAULT 'unpaid', paid_at TEXT, hold_status TEXT DEFAULT 'none', cancel_reason TEXT, cancel_by TEXT, order_note TEXT, otp TEXT, otp_verified INTEGER DEFAULT 0, cook_minutes INTEGER, delivery_type TEXT DEFAULT 'regular', quota_kind_used TEXT, rate_locked REAL, transaction_fee_jod REAL DEFAULT 0, transaction_fee_idr INTEGER DEFAULT 0, rounding_up_idr INTEGER DEFAULT 0, platform_fee_customer_jod REAL DEFAULT 0, platform_fee_merchant_jod REAL DEFAULT 0, discount_merchant_jod REAL DEFAULT 0, discount_applicator_jod REAL DEFAULT 0, refund_status TEXT, dispute_rule_ids TEXT DEFAULT '[]', payment_expires_at TEXT, placed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, menu_id INTEGER, name TEXT, qty INTEGER, unit_price_jod REAL, modifiers TEXT DEFAULT '[]', line_total_jod REAL, note TEXT);
CREATE TABLE IF NOT EXISTS batches (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, courier_id INTEGER, status TEXT DEFAULT 'prepare', eta_prepare_seconds INTEGER, eta_delivery_seconds INTEGER, sla_prepare_deadline TEXT, sla_delivery_deadline TEXT, escalated_to_admin INTEGER DEFAULT 0, route TEXT, order_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS checkpoints (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, kind TEXT, latitude REAL, longitude REAL, proof_photo TEXT, note TEXT, at TEXT DEFAULT (datetime('now')));

-- Uang
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, method TEXT, provider TEXT, amount_jod REAL, status TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, balance_jod REAL DEFAULT 0, reserved_balance_jod REAL DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS wallet_ledgers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, ref_type TEXT, ref_id INTEGER, direction TEXT, amount_jod REAL, balance_after_jod REAL, note TEXT, at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS wallet_holds (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, customer_id INTEGER, amount_jod REAL, status TEXT, created_at TEXT DEFAULT (datetime('now')), settled_at TEXT);
CREATE TABLE IF NOT EXISTS topups (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount_jod REAL, method TEXT, status TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS cashouts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, amount_jod REAL, status TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS enterprise_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, entry_type TEXT, party TEXT, amount_jod REAL DEFAULT 0, amount_idr INTEGER DEFAULT 0, idempotency_key TEXT UNIQUE, note TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS refunds (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, method TEXT, amount_idr INTEGER, bank_name TEXT, account_number TEXT, status TEXT DEFAULT 'pending', idempotency_key TEXT UNIQUE, created_at TEXT DEFAULT (datetime('now')), completed_at TEXT);
CREATE TABLE IF NOT EXISTS platform_params (id INTEGER PRIMARY KEY CHECK (id = 1), platform_fee_customer_jod REAL DEFAULT 0.2, platform_fee_merchant_jod REAL DEFAULT 0.25, quick_multiplier REAL DEFAULT 1.5, transaction_fee_rate REAL DEFAULT 0.015, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS exchange_rates (id INTEGER PRIMARY KEY AUTOINCREMENT, base TEXT, quote TEXT, rate REAL, source TEXT, effective_on TEXT, fetched_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS deposits (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, kind TEXT, amount_jod REAL, status TEXT, verified_by INTEGER, verified_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS merchant_credits (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, balance_jod REAL DEFAULT 0, rebate_tier TEXT, rebate_period TEXT, rebate_amount_jod REAL, rebate_paid_at TEXT, non_withdrawable INTEGER DEFAULT 0, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS merchant_credit_events (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, event TEXT, amount_jod REAL, at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS cashback_tiers (id INTEGER PRIMARY KEY AUTOINCREMENT, tier TEXT, min_volume_jod REAL, pct REAL, threshold_orders INTEGER, amount_jod REAL);
CREATE TABLE IF NOT EXISTS protection_fund (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, amount_jod REAL, at TEXT DEFAULT (datetime('now')));

-- Monetisasi & marketing
CREATE TABLE IF NOT EXISTS quota_packages (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, label TEXT, quota INTEGER, period TEXT DEFAULT 'day', price_jod REAL, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS quota_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, kind TEXT, package_id INTEGER, quota_total INTEGER DEFAULT 0, quota_used INTEGER DEFAULT 0, quota_reserved INTEGER DEFAULT 0, period_start TEXT, period_end TEXT, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS coverage_zones (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, mode TEXT DEFAULT 'radius', center_lat REAL, center_lng REAL, radius_m INTEGER, polygon TEXT, delivery_fee_jod REAL DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS marketing (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, value REAL, code TEXT, active_from TEXT, active_to TEXT, max_uses INTEGER, used_count INTEGER DEFAULT 0, merchant_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS marketing_programs (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT DEFAULT 'merchant', merchant_id INTEGER, name TEXT, program_type TEXT DEFAULT 'discount', scope TEXT DEFAULT 'order', is_stackable INTEGER DEFAULT 0, active INTEGER DEFAULT 1, active_from TEXT, active_to TEXT, max_uses INTEGER, used_count INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS marketing_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER, rule_type TEXT, threshold REAL, min_qty INTEGER, min_amount_jod REAL, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS marketing_rewards (id INTEGER PRIMARY KEY AUTOINCREMENT, program_id INTEGER, reward_type TEXT DEFAULT 'discount', value_jod REAL DEFAULT 0, percent REAL, created_at TEXT DEFAULT (datetime('now')));

-- Dispatch & dispute
CREATE TABLE IF NOT EXISTS dispatch_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, courier_id INTEGER, status TEXT DEFAULT 'reserved', reject_reason TEXT, reserved_at TEXT DEFAULT (datetime('now')), responded_at TEXT);
CREATE TABLE IF NOT EXISTS dispute_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT NOT NULL UNIQUE, name TEXT, category TEXT, trigger_condition TEXT, responsible_party TEXT, mitigation TEXT, compensation TEXT, punishment TEXT, version INTEGER DEFAULT 1, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS merchant_dispute_rules (id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER, rule_id INTEGER, effective_from TEXT DEFAULT (datetime('now')), UNIQUE (merchant_id, rule_id));
CREATE TABLE IF NOT EXISTS punishments (id INTEGER PRIMARY KEY AUTOINCREMENT, subject_type TEXT, subject_id INTEGER, kind TEXT DEFAULT 'sp', level INTEGER DEFAULT 1, reason TEXT, dispute_id INTEGER, issued_by INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS disputes (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, opened_by INTEGER, filed_role TEXT, category TEXT, type TEXT, status TEXT DEFAULT 'open', resolution TEXT, refund_amount_jod REAL, resolution_note TEXT, photos TEXT DEFAULT '[]', resolved_by INTEGER, resolved_at TEXT, window_closes_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS incident_resolutions (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, dispute_id INTEGER, kind TEXT, actor_id INTEGER, action TEXT, note TEXT, ledger_ref INTEGER, created_at TEXT DEFAULT (datetime('now')));

-- Rating & chat & notifikasi
CREATE TABLE IF NOT EXISTS rating_reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, customer_id INTEGER, merchant_id INTEGER, menu_id INTEGER, rating INTEGER, review TEXT, window_closes_at TEXT, edited_at TEXT, deleted_at TEXT, created_at TEXT DEFAULT (datetime('now')), CHECK ((merchant_id IS NOT NULL) <> (menu_id IS NOT NULL)));
CREATE TABLE IF NOT EXISTS review_replies (id INTEGER PRIMARY KEY AUTOINCREMENT, review_id INTEGER, merchant_id INTEGER, body TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS chats (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, last_message TEXT, last_at TEXT, auto_close_at TEXT, closed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, chat_id INTEGER, sender_id INTEGER, channel TEXT, body TEXT, at TEXT DEFAULT (datetime('now')), read_at TEXT);
CREATE TABLE IF NOT EXISTS chat_participants (chat_id INTEGER, user_id INTEGER, role TEXT, joined_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (chat_id, user_id));
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, kind TEXT, title TEXT, body TEXT, sound TEXT DEFAULT 'default', read INTEGER DEFAULT 0, audience TEXT, order_id INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, endpoint TEXT, p256dh TEXT, auth TEXT, created_at TEXT DEFAULT (datetime('now')));

-- Platform & misc
CREATE TABLE IF NOT EXISTS platform_switches (key TEXT PRIMARY KEY, enabled INTEGER DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')), updated_by INTEGER);
CREATE TABLE IF NOT EXISTS roles (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, name TEXT, permissions TEXT);
CREATE TABLE IF NOT EXISTS operators (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, role_id INTEGER, active INTEGER DEFAULT 1, created_by INTEGER, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id INTEGER, actor_role TEXT, action TEXT, target TEXT, target_id INTEGER, at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS magic_links (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT, role TEXT, token TEXT NOT NULL UNIQUE, expires_at TEXT, consumed_at TEXT, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS order_status_history (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, from_status TEXT, to_status TEXT, actor_id INTEGER, at TEXT DEFAULT (datetime('now')));

-- Index
CREATE INDEX IF NOT EXISTS idx_orders_merchant ON orders (merchant_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier ON orders (courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_batch ON orders (batch_id);
CREATE INDEX IF NOT EXISTS idx_menus_merchant ON menus (merchant_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_ledger_order ON enterprise_ledger (order_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages (chat_id);
