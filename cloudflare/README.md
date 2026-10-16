# cloudflare/ — API Worker (target migrasi)

Ganti Supabase (DB + REST + auth + realtime + storage). Rencana: `docs/backend/MIGRATION-cloudflare.md`.

## Status (terpasang)
- D1 `sa7tein` = `323b5ff6-c7c2-443e-8f99-42b43effbe3d` (skema `schema.sql` + seed `seed.sql` sudah diterapkan).
- KV `sa7tein` = `877bbe8a851142a6ae4b0fbeb1158ad6`.
- Akun = `2f0537d984cb5f631c32505e08fa0f66`.
- Worker live: **https://sa7tein-api-cf.sa7tein-pwa.workers.dev** (`/health` → `{ok:true,db:"ok"}`).
- ⏳ **R2 belum diaktifkan** di akun (error: "Please enable R2 through the Cloudflare Dashboard"); S3 endpoint + Access/Secret sudah disimpan di `.dev.vars` (gitignored).

> **DB via Hyperdrive.** Worker menyambung ke Postgres Supabase yang sama lewat Cloudflare Hyperdrive
> (`HYPERDRIVE`, id `5f12b6b4ac0b4f8e961b6ec7158d2fbd`). **Penting:** origin harus koneksi **langsung**
> (`db.<ref>.supabase.co:5432`), bukan pooler `:6543` — pooler membuat Hyperdrive menggantung.
> Endpoint: `/rest/v1/<tabel>` (read) + `/rest/v1/rpc/<fn>` (memanggil fungsi Postgres `supabase/31-47`).

## Jalankan / deploy
```bash
npm run cf:dev        # wrangler dev (butuh CLOUDFLARE_API_TOKEN)
npm run cf:deploy     # wrangler deploy
```

## Berikutnya (C1–C8)
- C1 lanjut: konversi **seluruh** `supabase/*.sql` → `schema.sql` (fungsi → JS).
- C2 route `/rest/v1/*` + `/rpc/*` (authz per peran di Worker), C3 auth, C4 R2 presign, C5 DO WebSocket, C6 Cron/Queue, C7 Access.
