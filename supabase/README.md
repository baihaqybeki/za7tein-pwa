# supabase/ — skema database (target produk)

> Catatan scope: repo ini front-end (AGENTS.md §1). Folder ini berisi artefak SQL
> siap jalan + salinan dokumen backend. Aplikasi tetap memakai data mock.

Database: project `dwzxtnfesmpobnepilhl`.

## Kondisi sekarang (2026-10-10)

Schema `public` = **ERD Final Irbid MVP (42 tabel)** — pulih kembali setelah
percobaan "align ke draft" yang keliru. Sumber kebenaran schema = **`docs/backend/ERD.md`**.

| Aspek | Nilai |
|---|---|
| Tabel | 42 |
| RLS | aktif, **79 policy** (ops penuh + owner + baca publik katalog) |
| Realtime | 11 tabel (`orders`, `couriers`, `merchants`, `menus`, `chats`, `chat_messages`, `wallets`, `wallet_holds`, `wallet_ledgers`, `disputes`, `batches`) |
| Helper | `app_uid()`, `app_role()`, `app_is_ops()` |
| Append-only | `wallet_ledgers`, `audit_logs` (trigger) |
| Uang | JOD (`*_jod`, display) + IDR (`*_idr`, settlement) |

## Berkas

| Berkas | Isi |
|---|---|
| `03-restore-erd.sql` | Rebuild ke ERD 42 tabel + RLS + realtime + trigger (destruktif). |
| `04-seed-core.sql` | **Seed inti (idempoten)** — `merchants` (+`couriers`,`menus`,`menu_variants`,`deposits`,`merchant_credits`) memakai kolom **`store_name`**. Menutup FK `merchants` yang kosong. |
| `05-seed-merchants.sql` | **Seed banyak merchant + menu** — 8 merchant (total 9) + 23 menu; tiap menu `image = /assets/img/menu/<slug>.webp` sesuai namanya (5 hidangan: nasi goreng, sate ayam/kambing, lontong, es teh). Menu lama dinormalisasi agar nama↔foto cocok. |
| `06-seed-people.sql` | **Seed people** — 6 customer + 5 kurir + 2 admin (cs) + 2 super admin (dengan baris `operators` → `roles`). Total user: 27. |
| `07-features-customer.sql` | **Skema 4 fitur customer** — `merchants.store_status` (open/busy/closed, ganti `available`), `menus.cook_minutes`, `push_subscriptions.sound_enabled`/`sound`, tabel `notifications` (+RLS). |
| `08-payment-methods.sql` | **Definisi semua metode bayar** — tabel `payment_methods` (cod, transfer, xendit_va, xendit_qris, **wallet**), fix CHECK `orders.payment_method`/`payments.method` (tambah wallet), provider `payments` (+wallet), FK ke katalog. |
| `09-merchant-covers.sql` | **Cover toko per merchant** — isi `merchants.photo` dengan SVG lokal (`public/assets/img/merchant/<slug>.svg`, inisial + palet unik per toko). |
| `10-merchant-rating-hours.sql` | **Rating + jam operasional merchant** — `merchants.rating_avg`/`rating_count` (denormalized dari `rating_reviews`) + `open_time`/`close_time`, di-seed per toko. |
| `11-orders-reviews.sql` | **Order + ulasan** — 70 order (status `done`) + 93 `rating_reviews` (merchant & menu), lalu `rating_avg`/`rating_count` **dihitung ulang dari ulasan** (bukan seed statis). |
| `12-incentive.sql` | **Insentif merchant** — `cashback_tiers` diselaraskan ke flow F9 (500/1000/1250 order → 15/40/62,5 JOD) + tabel baru `merchant_credit_events` (grant/fee/rebate) + `merchant_credits`/`deposits` untuk semua 9 merchant. |
| `13-role-permissions.sql` | **Role permission Super Admin** — katalog `permissions` (12 platform + 6 operasi) + set `roles.permissions` kanonik: `sa_owner` (12), `sa_ops` (6), `cs_ops` (6). |
| `14-merchant-record-fields.sql` | **Kolom `MerchantRecord` di `merchants`** — `owner`, `owner_phone`, `city`, `tier`, `is_active_hijazi/syimali`, `cod_issues`, `approved_at`, `status_reason` (FE memakainya, DB belum punya) + seed 9 merchant. |
| `15-address-fields.sql` | **Kolom alamat apartemen di `addresses`** — `name`, `building`, `floor`, `unit`, `notes`, `city`, `full_address` (FE `Address` memakainya) + seed. |
| `02-align-to-doc.sql` | ⚠️ **DIBATALKAN** — rebuild ke draft 17 entitas (menghapus 22 tabel fitur). Jangan dijalankan lagi. |
| `schema.sql` | Lama (schema-draft), superseded. |
| `00-preflight.sql`, `00-introspect.sql`, `reference-schema-drop.sql` | Diagnosa/drop lama (arsip). |

Dokumen backend (salinan dari https://sa7tein-api.vercel.app): `docs/backend/{openapi.yaml,ERD.md,CONSUME.md,M6-ADAPTER.md,MILESTONES.md}`.

## Data yang di-reseed

Dari backup pra-rebuild: `users` (4), `customers` (1), `addresses` (1), `wallets` (3),
`zones` (2), `roles` (3), `platform_switches` (3). Tabel yang butuh induk `merchants`
(`menus`, `menu_variants`, `deposits`, `merchant_credits`) belum bisa di-seed — `merchants`
kosong, jadi isinya tidak dibuat (bukan ditebak). 

Backup: `/var/folders/9_/2vjr42hx0_1267zdj9gyggk00000gn/T/opencode/sa7tein-backup-2026-10-09.json`.

## Cara konsumsi

Lihat `docs/backend/CONSUME.md`. Ringkas: PostgREST `https://dwzxtnfesmpobnepilhl.supabase.co/rest/v1`,
Auth Supabase, helper `app_*` untuk RLS, snake_case ↔ camelCase di frontend.

## Catatan

- Token Supabase sempat terpampang di chat — **rotate** sesudah sesi ini.
