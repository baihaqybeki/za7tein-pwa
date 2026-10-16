# Rencana migrasi ke Cloudflare (dari Supabase)

Status: IN PROGRESS (C0 sebagian + C1 awal selesai; lihat cloudflare/README.md). Pemicu: kuota Supabase (proyek dibatasi 21 Okt 2026). Target: **Cloudflare**
(selaras ARC-01..13 PRD aktif). Pasangan: `MIGRATION-quota-exit-milestones.md`.

> Migrasi Postgres → Cloudflare **bukan lift-and-shift**: Cloudflare tak punya Postgres/RLS/PostgREST.
> Perlu tulis ulang lapisan data + authz ke Worker. Rencana dipecah fase; eksekusi butuh kredensial.

## Pemetaan Supabase → Cloudflare
| Supabase | Cloudflare | Catatan |
|---|---|---|
| Postgres | **D1** (SQLite) untuk relasional + **Durable Objects** untuk koordinasi realtime/batch (ARC-03/04) | SQLite: tanpa RLS/plpgsql; authz & logika pindah ke Worker |
| RLS (app_uid/app_role/app_is_ops) | **Authz di Worker** (cek JWT claim + peran) | RLS tak ada di D1 |
| PostgREST `/rest/v1` | **Router Worker** (mis. Hono) dengan route setara | Kontrak `docs/backend/openapi.yaml` dipertahankan |
| GoTrue (auth) | **Cloudflare Access** + JWT, atau Auth.js di Workers; magic link via Email Routing/Resend | |
| Storage | **R2** (S3-compatible) | FE `uploadToBucket` → presign |
| Realtime WS | **Durable Object WebSocket** | `/ws` per-channel; resync (NFR-05) |
| pg_cron | **Cron Triggers** | `run_cron_jobs` |
| Edge Function send-push | **Worker** + **Queues** | VAPID secret via Wrangler secret |
| pg_net + Vault | **Queues** (outbox `notifications`) | |
| Ops panel | **Cloudflare Access/Zero Trust** | ARC-10 |

## Fase (butuh kredensial)
- **C0 Provision** ✅: akun `2f05…0f66`; D1 `sa7tein` + KV dibuat; Worker live `sa7tein-api-cf.sa7tein-pwa.workers.dev`. R2 ⏳ (aktifkan di dashboard).
- **C0 Provision (asli)**: `npx wrangler login`; buat D1, R2 buckets (menu-images/merchant-photos/avatars),
  KV, Queue; catat id ke `cloudflare/wrangler.toml`.
- **C1 Skema → D1**: konversi `supabase/*.sql` ke SQLite (DROP policy/RLS & plpgsql; ganti `bigserial`→`integer primary key autoincrement`;
  `timestamptz`→`text`/ISO; `numeric`→`real`; `json` tetap). Fungsi → JS di Worker.
- **C2 API Worker**: route setara `/rest/v1/<tabel>` + `/rpc/<fn>` (authz per peran di Worker).
- **C3 Auth**: magic link (Email Routing/Resend) → JWT; peran dari `users.role`.
- **C4 Storage → R2**: presign PUT/GET; FE ganti `src/api/storage.ts`.
- **C5 Realtime**: Durable Object WebSocket; FE `src/api/realtime.ts` ganti transport.
- **C6 Jobs**: Cron Triggers (`run_cron_jobs`) + Queue untuk push fan-out.
- **C7 Ops**: Cloudflare Access di depan panel ops.
- **C8 Cutover**: FE env → endpoint Worker; uji `scripts/api-e2e.mjs`; rollback ke Supabase.

## Perintah acuan (setelah kredensial ada)
```bash
npx wrangler login
npx wrangler d1 create sa7tein
npx wrangler r2 bucket create sa7tein-menu-images
npx wrangler r2 bucket create sa7tein-merchant-photos
npx wrangler r2 bucket create sa7tein-avatars
npx wrangler d1 execute sa7tein --file=cloudflare/schema.sql --remote
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler deploy
```

## Yang TIDAK diubah
- `docs/backend/openapi.yaml`/`ERD.md`/`CONSUME.md` (kontrak) — hanya implementasi yang pindah.
- Front-end tetap memanggil kontrak yang sama (via router Worker), jadi `src/` minim perubahan.

## Prasyarat yang dibutuhkan dari pemilik
1. `npx wrangler login` (OAuth) **atau** `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
2. Nama akun/zone (bila pakai custom domain + Access).
3. Konfirmasi target data layer: **D1** vs **Durable Objects** (ARC-04) — keputusan belum diambil.
