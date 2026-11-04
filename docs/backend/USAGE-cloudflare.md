# Cloudflare usage: kenapa cepat kena limit & cara menekan

## Gejala (2026-10-18)
Email limit berulang; hari ini D1 menolak semua baca:
`Your account has exceeded D1's free tier daily row read limit`.

## Angka nyata (7 hari, GraphQL analytics)
| Produk | Terukur | Catatan |
|---|---|---|
| Workers requests | **207.201** (≈29,6k/hari) | di bawah batas harian |
| **D1 rows read** | **63.664.550** (≈9,1 jt/hari) | **penyebab utama** (batas free 5 jt/hari) |
| D1 read queries | 115.627 (≈16,5k/hari) | ±550 baris/query |
| D1 rows written | 19.917 | aman |
| R2 | Get 491 · Put 44 | rendaj |

## Penyebab
1. **GET berulang tanpa cache** → tiap muat beranda/menu/pencarian membaca D1.
2. **Indeks kurang** untuk `audience/created_at`, `rating_reviews.merchant_id`, `orders.status`, dll →
   query memindai banyak baris.
3. **Subquery korelasi** di `browse_merchants` (COUNT orders per merchant) dan `search_merchants` (MIN harga).
4. **/health** dulu query D1 tiap panggilan.
5. Trafik uji/migrasi + kemungkinan polling FE.

## Sudah diperbaiki
- `cloudflare/indexes-performance.sql` (indeks untuk filter/sort yang dipakai).
- **Cache edge** (Cache API):
  - `GET /rest/v1/<tabel>` → `max-age=60, stale-while-revalidate=120`.
  - RPC baca (`fx_rate_latest`, `price_order`, `compute_discounts`, `check_coverage`,
    `browse_merchants`, `search_merchants`) → cache 30s.
  - `/media/...` → `max-age=86400, immutable` (R2 tak dibaca ulang).
  - `/health` → cache 60s (tidak query D1 tiap panggilan).

## Langkah berikut (pilih)
- **Upgrade D1** bila trafik demo nyata memang butuh >5 jt baris/hari, atau tunggu reset **00:00 UTC**.
- FE: `select` kolom seperlunya, pagination, jangan polling (pakai `/ws`), hindari memuat tabel besar.
- Sajikan gambar via **R2 public domain** (bukan proxy Worker) untuk memangkas Worker/R2 per-view.
- Denormalisasi `orders_count` per merchant (hilangkan subquery COUNT).
- Hapus konfigurasi **Hyperdrive** yang sudah tidak dipakai.
- Batasi/rotasi token; pantau pemakaian berkala.

## Cara cek pemakaian
GraphQL `https://api.cloudflare.com/client/v4/graphql`:
`workersInvocationsAdaptive { sum { requests } }`,
`d1AnalyticsAdaptiveGroups { sum { readQueries writeQueries rowsRead rowsWritten } }`,
`r2OperationsAdaptiveGroups { sum { requests } dimensions { actionType } }`.
