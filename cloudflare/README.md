# cloudflare/ — API Worker (target migrasi)

Scaffold Worker untuk menggantikan Supabase (DB + REST + auth + realtime + storage).
Rencana lengkap: `docs/backend/MIGRATION-cloudflare.md`.

## Setup (butuh kredensial Cloudflare)
```bash
npx wrangler login                       # atau set CLOUDFLARE_API_TOKEN
npx wrangler d1 create sa7tein
npx wrangler r2 bucket create sa7tein-menu-images
npx wrangler r2 bucket create sa7tein-merchant-photos
npx wrangler r2 bucket create sa7tein-avatars
```
Lalu isi `database_id`/`id` di `wrangler.toml` (bagian yang dikomentari).

## Jalankan
```bash
npm run cf:dev        # wrangler dev
npm run cf:deploy     # wrangler deploy
curl http://127.0.0.1:8787/health   # { ok, db }
```

## Status
- ✅ Scaffold + `/health` (uji binding D1/R2/KV).
- ⏳ C1 skema → D1, C2 route `/rest/v1`+`/rpc`, C3 auth, C4 R2 presign, C5 realtime, C6 cron/queue.
