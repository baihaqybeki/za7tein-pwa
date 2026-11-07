# Order Journey — data end-to-end (untuk konsumsi FE)

Backend Cloudflare Worker + D1. Semua RPC tulis butuh `Authorization: Bearer <JWT>`.
Status order: `quotation → prepare → waitingCourier → delivery → done` (atau `canceled`).

## RPC lifecycle
| RPC | Body | Efek |
|---|---|---|
| `create_order` | `p_customer,p_merchant,p_address,p_items,p_delivery_type,p_payment_method,p_note` | order `quotation`, `placed_at`, `order_items`, OTP (tabel `order_otps`), chat, `order_status_history(null→quotation)`, notif merchant |
| `pay_order` | `p_order,p_method?` | `payment_status=paid`,`paid_at`,`payments` row, notif customer+merchant |
| `accept_order` | `p_order,p_cook_minutes?` | `quotation→prepare`, `cook_minutes`, history, notif customer |
| `reject_order` | `p_order,p_reason?` | `→canceled`, release kuota, history, notif customer |
| `assign_batch` / `start_batch` | batch Regular | `prepare→waitingCourier` / `→delivery`, history, notif |
| `dispatch_partner` / `respond_assignment` | Quick | assignment partner |
| `pickup_order` | `p_order,p_lat?,p_lng?` | checkpoint `picked_up`, `→delivery` |
| `arrive_order` | `p_order,p_lat?,p_lng?` | checkpoint `arrived`, notif customer |
| `my_order_otp` | `p_order_id` | kode OTP (customer/ops) |
| `verify_order_otp` | `p_order_id,p_code` | cek OTP → checkpoint `otp_verified` → `complete_order` |
| `complete_order` | `p_order` | `→done`, `paid`, ledger 3 entri, history, notif |
| `cancel_order` | `p_order,p_by,p_reason?` | `→canceled`, release kuota, refund bila paid |
| `order_journey` | `p_order_id` | **semua detail** (lihat bawah) |

## `order_journey` (khusus FE)
Auth: peserta order (customer/merchant/kurir terkait) atau ops. Respons:
```json
{
  "order": { "...semua kolom orders..." },
  "items": [ { "menu_id","name","qty","unit_price_jod","line_total_jod","modifiers","note" } ],
  "history": [ { "from_status","to_status","actor_id","at" } ],
  "checkpoints": [ { "kind":"picked_up|arrived|otp_verified","latitude","longitude","proof_photo","at" } ],
  "notifications": [ { "audience","kind","title","body","read","created_at" } ],
  "payments": [ { "method","provider","amount_jod","status","created_at" } ],
  "courier": { "id","name","latitude","longitude","last_seen_at" },
  "chat": { "id","last_message","last_at" }
}
```
Contoh: `POST /rest/v1/rpc/order_journey {"p_order_id":874}`.

## Data yang tercatat per tahap
- **Order dibuat**: header snapshot (harga/fee/rate_locked/zone/quota), items, OTP, chat, history, notif merchant.
- **Bayar**: `payments`, `paid_at`, `payment_status`, notif.
- **Accept/reject**: status, `cook_minutes`, history, notif.
- **Batch/Quick**: `batches`/`dispatch_assignments`, history, notif.
- **Pickup/arrive**: `checkpoints`, lokasi kurir, history/notif.
- **OTP/selesai**: `otp_verified`, checkpoint, `done`, `payments`, ledger, history, notif.
- **Batal/refund**: `canceled`, refund, ledger (bila relevan).
- **Lokasi live**: `update_courier_location` / `courier_location` (stale >120s).

## Catatan data lama (bukan buatan RPC baru)
- Item pesanan lama = **snapshot** (`name/qty/harga`); 92 item berhasil dipetakan ulang ke menu sekarang, sisanya `menu_id=null` (menu lama sudah dihapus).
- **18 order lama tanpa `order_items`** (tidak bisa direkonstruksi). Order baru selalu punya item.
- Sisa uji (menu `Tes`, item `x`) sudah dibersihkan (`cloudflare/repair-order-data.sql`).
