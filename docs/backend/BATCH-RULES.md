# Batching (batch lifecycle) — aturan & kontrak

Backend Cloudflare Worker + D1. Batch = gabungan order **Regular** untuk **satu kurir inhouse**.

## Endpoint
| RPC | Body | Hasil |
|---|---|---|
| `assign_batch` | `{p_order, p_courier}` | `batch_id` |
| `auto_sort_batch` | `{p_batch}` | `[order_id...]` (rute) |
| `start_batch` | `{p_batch}` | `{batch, orders}` |
| `close_batch` | `{p_batch}` | `null` |

Semua butuh JWT merchant (pemilik) atau ops. RPC tulis → broadcast realtime.

## Aturan yang ditegakkan (assign_batch)
1. Order harus **Regular** (`delivery_type='regular'`) → selain itu `400`.
2. Order **belum** di batch (`batch_id IS NULL`) → selain itu `400`.
3. Kurir harus **inhouse** → partner `400` (BR-B07).
4. Kurir harus **milik merchant** order (jika `couriers.merchant_id` terisi).
5. Order harus sudah **accepted** (`status='prepare'`) → selain itu `400`.
6. Authz pemilik merchant / ops → selain itu `403` (atau `401` tanpa token).
7. **Maks 24 order/batch** (BR-B04) → order ke-25 `400`.
8. Batch dikelompokkan per `(merchant, courier)`; kurir sama → batch aktif yang sama.

## Efek
- `orders.status → waitingCourier`; `orders.batch_id`, `orders.courier_id` diisi.
- `batches.order_count` diperbarui; `eta_prepare_seconds=600`, `eta_delivery_seconds=300+120×n`.
- `start_batch`: `batches.status → delivery`, semua order batch `status → delivery`.
- `close_batch`: `status → closed`; ditolak bila batch sedang `delivery` (selesaikan order dulu).
- `auto_sort_batch`: nearest-neighbor **mulai dari merchant, berakhir order terakhir**, maks 25 titik;
  **deviasi**: memakai haversine, bukan Google Routes WALK (biaya R4).

## Catatan
- Countdown batch real-time (timer) belum dijalankan sebagai job; `eta_*` hanya nilai perkiraan.
- Menutup lebih awal / mulai lebih awal (BR-B08/09) = `close_batch` / `start_batch`.
