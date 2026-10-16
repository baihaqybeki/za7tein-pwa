# Versioning migrasi Supabase → Cloudflare (paralel run)

Selama backend pindah ke Cloudflare, **front-end tetap konsumsi Supabase** sampai cutover. Dokumen ini
menetapkan cara menjalankan keduanya **paralel tanpa memutus FE**.

## Prinsip
1. **Kontrak stabil.** `docs/backend/openapi.yaml` (target) tidak berubah. Endpoint & nama field sama di
   kedua backend, sehingga FE tak perlu tulis ulang.
2. **Sumber data = flag, bukan fork.** FE memilih backend lewat env, bukan cabang kode.
3. **Nol downtime.** Supabase jalan sebagai `v1` (aktif), Cloudflare sebagai `v2` (paralel); cutover =
   ganti flag + uji.

## Env FE (Vite)
| Env | Nilai | Fungsi |
|---|---|---|
| `VITE_DATA_SOURCE` | `supabase` (default) \| `cloudflare` | Pilih backend |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | (ada) | Backend v1 |
| `VITE_CF_API_URL` | `https://sa7tein-api-cf.sa7tein-pwa.workers.dev` | Backend v2 (Worker) |

Kode: `src/api/config.ts` → `DATA_SOURCE`, `isCloudflareConfigured`, `cfBase()`.
Default `supabase` → perilaku FE **tidak berubah** sampai Anda membalik flag.

## Kontrak versi API
- Worker menerima `/` dan `/v1/…` sebagai setara (`relPath` di `cloudflare/src/index.ts`).
- `GET /version` → `{ api, backend, schema }` (mis. `v2`, `cloudflare`, `d1`) untuk memverifikasi endpoint mana yang hidup.
- `GET /health` → `{ ok, backend, api, db }`.

## Jalur paralel (selama migrasi)
```
FE ──(VITE_DATA_SOURCE=supabase)──▶ Supabase PostgREST  (v1, aktif)
FE ──(VITE_DATA_SOURCE=cloudflare)─▶ Worker Cloudflare  (v2, uji)
        ▲ (dua environment Vercel: preview v2, prod v1)
```

## Cutover
1. Sinkron data terakhir Supabase → D1 (fase C1 penuh) + objek → R2 (C4).
2. Deploy preview Vercel dengan `VITE_DATA_SOURCE=cloudflare` + `VITE_CF_API_URL`.
3. Jalankan `scripts/api-e2e.mjs` (arahkan ke Worker) + smoke rute kunci.
4. Bila hijau: set `VITE_DATA_SOURCE=cloudflare` di **production**.
5. Rollback: balikkan flag ke `supabase` (v1 masih hidup).

## Status
- ✅ Worker `v2` live + `/version` + `/health` + media R2 (`/media/<bucket>/<key>`).
- ✅ Flag FE disiapkan (default `supabase`, non-breaking).
- ⏳ C1 penuh (data + fungsi), C2 `/rest/v1`+`/rpc`, C3 auth, C5 realtime, C6 cron/queue.
