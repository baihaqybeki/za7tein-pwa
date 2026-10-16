# Konsumsi Backend Cloudflare (untuk FE yang punya URL sendiri)

Backend = Cloudflare Worker + **D1 (SQLite)** + **R2**. FE di-deploy terpisah (URL sendiri) sehingga
**cross-origin → CORS diaktifkan**. Dokumen ini kontrak yang FE butuhkan. Rencana: `MIGRATION-cloudflare.md`.

## Base URL
```
https://sa7tein-api-cf.sa7tein-pwa.workers.dev
```
- `GET /health` → `{ ok, backend:"cloudflare", api:"v2", db:"ok" }`
- `GET /version` → `{ api:"v2", backend:"cloudflare", schema:"d1" }`
- Prefix `/v1/...` setara root (mis. `/v1/rest/v1/merchants`).

## CORS
Semua respons ber-`Access-Control-Allow-Origin: *` (diatur `ALLOWED_ORIGIN` di `wrangler.toml`).
Header diizinkan: `content-type, authorization, apikey, x-api-key, prefer`. Preflight `OPTIONS` → `204`.
Untuk produksi, ganti `ALLOWED_ORIGIN` ke URL FE (mis. `https://fe.example`) lalu redeploy.

## Kompatibel PostgREST (drop-in untuk FE)
Worker meniru bentuk Supabase → **FE cukup arahkan base-nya ke Worker**, tanpa ubah pemanggilan:
```
VITE_SUPABASE_URL=https://sa7tein-api-cf.sa7tein-pwa.workers.dev
VITE_SUPABASE_ANON_KEY=worker        # tak dipakai (header diabaikan)
```
FE memanggil `${base}/rest/v1/<tabel>` dan `${base}/rest/v1/rpc/<fn>` — keduanya dilayani.

### REST read — `GET /rest/v1/<tabel>`
Query didukung: `select`, `order=col.asc|desc`, `limit`, `offset`, filter `col=eq.v`, `neq.`, `gte.`, `lte.`, `ilike.`, `in.(a,b)`, `is.null`, `not.is.null`. Contoh:
```
GET /rest/v1/merchants?select=id,store_name,rating_avg&order=rating_avg.desc&limit=10
```
(Tidak seperti PostgREST, `numeric` dikembalikan sebagai **number**, bukan string.)

### RPC — `POST /rest/v1/rpc/<fn>` (JSON body)
Sudah diimplementasikan (port dari `supabase/31-47`):
`fx_rate_latest`, `price_order`, `compute_discounts`, `check_coverage`, `browse_merchants`,
`search_merchants`, `reserve_quota`, `consume_quota`, `release_quota`, `create_order`,
`complete_order`, `cancel_order`, `assign_batch`, `auto_sort_batch`, `close_batch`, `dispatch_partner`,
`respond_assignment`, `create_refund`, `send_chat_message`, `close_stale_chats`, `buy_quota_package`,
`set_courier_status`, `issue_sp`, `submit_review`, `reply_review`, `open_dispute`, `resolve_dispute`,
`appeal_dispute`, `snapshot_dispute_rules`, `emit_notification`, `request_magic_link`,
`consume_magic_link`, `expire_unpaid_orders`, `quota_low_alerts`, `run_cron_jobs`.
Contoh:
```
POST /rest/v1/rpc/price_order
{ "p_merchant":1, "p_items":[{"unit_jod":2.5,"qty":2}], "p_payment_method":"qris" }
→ { "total_jod":6.29, "total_idr":144700, "transaction_fee_jod":0.09, ... }
```
Nama arg = nama `p_*` seperti di `supabase/*.sql`.

### Media (R2) — `/media/<bucket>/<key>`
Bucket: `menu-images`, `merchant-photos`, `avatars`.
- `PUT /media/avatars/<uid>/<file>` (body = file) → `201 { ok,key,bucket }`
- `GET /media/avatars/<uid>/<file>` → isi berkas
FE `uploadToBucket` cukup menembak URL ini (bukan Supabase Storage).

## Auth (C3) — magic link + JWT
```
POST /auth/magic-link { "email":"cs@sa7tein.app", "role":"cs" }   → { ok, token }   # email stub
POST /auth/verify     { "token":"<token>" }                        → { access_token, user }
GET  /auth/me         (Authorization: Bearer <access_token>)       → { id, role, email }
```
JWT HS256, masa 24 jam. Kirim `Authorization: Bearer <access_token>` pada panggilan tulis.
`/auth/v1/*` gaya Supabase **tidak** dilayani.

## Authz (C3)
- **RPC tulis** (create_order, complete_order, cancel_order, quota, batch, dispatch, refund, chat,
  rating, dispute, buy_quota_package, dst.) → **wajib** JWT, selain itu `401`.
- **RPC ops** (`issue_sp`, `ops_set_platform_params`) → peran `cs`/`superadmin`, selain itu `403`.
- **RPC baca** (price_order, browse_merchants, compute_discounts, check_coverage, fx_rate_latest, …)
  dan **REST read** → publik.

## Realtime (C5)
```
ws://sa7tein-api-cf.sa7tein-pwa.workers.dev/ws?topic=orders
```
Durable Object `RealtimeHub` (WebSocket). Setiap RPC tulis sukses → broadcast `{type:'rpc',fn,at}` ke
topic `orders`. Pesan `ping` → `pong`. FE ganti transport `src/api/realtime.ts` ke URL ini.

## Belum ada (FE jangan andalkan dulu)
- **Pagination header** `Range/Content-Range`: pakai `limit`/`offset` saja.
- **Push fan-out & job terjadwal**: `run_cron_jobs` masih manual (C6); push (send-push) belum pindah.

## Data
- D1 = **snapshot** dari Supabase (`scripts/migrate-supabase-to-d1.mjs`, 6434 baris). Untuk cutover,
  jalankan ulang skrip agar sinkron.
- Skema: `cloudflare/schema.sql` · seed: `cloudflare/seed.sql`.

## Deploy backend
```
CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... npm run cf:deploy
```
