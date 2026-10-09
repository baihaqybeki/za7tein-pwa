# supabase/ — skema database (target produk)

> Catatan scope: repo `sa7tein-pwa` adalah front-end (AGENTS.md §1). Folder ini
> berisi artefak SQL **siap jalan** — aplikasi tetap memakai data mock.

Database: project `dwzxtnfesmpobnepilhl`.

## Kondisi sekarang (2026-10-09)

Schema `public` sudah **diselaraskan ke `docs/product/schema-draft-v1.md`**
(17 entitas) + `notifications`. **19 tabel**, uang **dua kolom** (`*_idr` + `*_jod`),
RLS aktif dengan policy (`app_is_ops()` full + owner per user + baca publik katalog).

| Tabel | Isi |
|---|---|
| `users` | id, auth_user_id, type, email, phone, verified, status, auth_provider |
| `addresses` | alamat + zone (A/B/C) |
| `customers` | profil customer + risk_flag |
| `merchants` | tenant, delivery_config, deposit (idr/jod), deposit_status |
| `couriers` | karyawan merchant (merchant_id) |
| `fav_merchants` | favorit |
| `menus` / `menu_variants` | menu + modifier |
| `batches` | batch & SLA |
| `orders` / `order_items` | order lifecycle |
| `wallets` / `ledgers` | dompet + mutasi |
| `chats` / `chat_messages` | chat per order |
| `incident_resolutions` | sengketa |
| `marketing` | promo |
| `rating_reviews` | rating & ulasan |
| `notifications` | notifikasi (dipakai UI, tidak ada di dokumen) |

## Berkas

| Berkas | Isi |
|---|---|
| `02-align-to-doc.sql` | **Migrasi yang sudah dijalankan** — rebuild ke dokumen (destruktif), dual-currency. |
| `schema.sql` | Versi lama (schema-draft tanpa `notifications`/dual-currency) — **superseded** oleh `02-align-to-doc.sql`. |
| `reference-schema-drop.sql` | Drop skema referensi lama (tak terpakai lagi). |
| `00-preflight.sql`, `00-introspect.sql` | Diagnosa (baca saja). |

## Backup (sebelum rebuild destruktif)

Data pra-rebuild ada di mesin lokal:
`/var/folders/9_/2vjr42hx0_1267zdj9gyggk00000gn/T/opencode/sa7tein-backup-2026-10-09.json`
Di-reseed ke schema baru: `users` (4), `customers` (1), `addresses` (1),
`menus` (4), `menu_variants` (3), `wallets` (3). Tabel fitur lama
(`payments`, `fees`, `taxes`, `disputes`, `cashouts`, `deposits`,
`merchant_credits`, `zones`, `roles`, `operators`, `audit_logs`,
`platform_*`, `protection_fund`, `exchange_rates`, `push_subscriptions`,
`checkpoints`, `phone_verifications`, `review_replies`, `chat_participants`,
`wallet_holds`, `cashback_tiers`, `dispute_appeals`, `tax_reports`)
**dibuang** sesuai keputusan; datanya hanya ada di backup.

## Catatan

- `menus.merchant_id` di-seed `null` (tabel `merchants` baru, belum ada data).
- `addresses.zone`: `Hijazi`→`A`, `Syimali`→`B`. Kurs JOD→IDR pakai 23.000.
- RLS: tiap tabel punya policy; tak ada lagi tabel "deny-all".
- Token Supabase sempat terpampang di chat — **rotate** sesudah sesi ini.
