# Milestone: keluar dari kuota Supabase — migrasi Database & Object Storage

Status: PROPOSED (rencana; belum dieksekusi). Pemicu: notifikasi Supabase — organisasi melebihi
kuota siklus tagihan sebelumnya; proyek **dibatasi mulai 21 Okt 2026** bila tetap melebihi kuota.

Ruang lingkup: memindahkan beban yang memicu kuota — **Postgres (DB)**, **REST/PostgREST + Auth (GoTrue)**,
**Realtime**, **Storage (S3)** — dari proyek Supabase `dwzxtnfesmpobnepilhl` ke target yang dipilih.
Repo ini tetap front-end + lapisan `src/api/*`; kontrak (RPC/tabel) dipertahankan agar FE tak berubah
banyak. Tidak mengubah `docs/backend/openapi.yaml`/`ERD.md`/`CONSUME.md`.

Sumber kondisi nyata: `supabase/00`–`47-*.sql`, `src/api/{config,db,reference,auth,push,storage,mvp}.ts`,
`docs/backend/PUSH.md`, `docs/backend/DEPLOY-API-DOCS.md`.

---

## Kenapa migrasi (fakta)
- Fitur Supabase yang dipakai: Postgres + **RLS** (helper `app_uid/app_role/app_is_ops` berbasis
  `auth.uid()`), **PostgREST** (`{url}/rest/v1`), **GoTrue** (`/auth/v1/token`), **Realtime**
  (`wss …realtime/v1`), **Storage** (`/storage/v1/object/...`), **Edge Function** `send-push`,
  **pg_cron**, **pg_net + Vault** (trigger notifikasi → push), publikasi realtime.
- Beban khas yang membuat kuota naik: **egress Realtime/REST**, **storage**, **compute/DB**,
  **invocations Edge Function**. Mitigasi cepat di M-Q0 sebelum migrasi penuh.

## Keputusan yang belum diambil (jangan ditebak)
- **Target DB**: managed Postgres (Neon/Railway/skala kecil) vs self-host (Docker) vs Cloudflare D1+
  (bukan Postgres → tulis ulang). 
- **Apakah pertahankan PostgREST + GoTrue self-host** (kontrak FE nyaris tak berubah) atau tulis
  ulang lapisan API (Node/Edge) dan ganti auth.
- **Storage**: AWS S3 vs Cloudflare R2 vs MinIO (S3-compatible).
- **Realtime**: self-host Supabase Realtime / Centrifugo / kembali ke polling.
- Menyelaraskan dengan ARCH PRD aktif (ARC-01..13 Cloudflare) atau tidak — lihat
  `docs/product/prd/decision-sa7tein-mvp.md` (deviasi Supabase disetujui).

---

## Milestone

| ID | Isi | Dep | Acceptance criteria | Owner | Status |
|---|---|---|---|---|---|
| **M-Q0** | **Mitigasi kuota (cepat, ≤2 hari)** — audit egress; hentikan polling berlebih (`notifications`/`checkpoints` sudah realtime); pindahkan aset statis `public/assets` ke CDN; kompres gambar; matikan Realtime tabel yang tak perlu; turunkan `limit` inbox/chat. | — | Penggunaan kuota turun cukup agar tak dibatasi 21 Okt | BE/FE | proposed |
| **M-Q1** | **Pilih target & putuskan arsitektur** (DB, auth, REST, realtime, storage, edge). Catat keputusan + konsekuensi ke kontrak FE. | M-Q0 | Keputusan tertulis (decision record) + matriks dampak ke `src/api/*` | PO+BE | proposed |
| **M-Q2** | **Migrasi skema DB** ke Postgres target. `pg_dump --schema-only` + data; recreate helper (`app_uid/app_role/app_is_ops`) berbasis klaim JWT; semua migrasi `00`–`47` menghasilkan skema identik; RLS diuji. | M-Q1 | `select count(*) from …` cocok; RPC `price_order/create_order/complete_order/…` jalan; policy RLS lolos `db:verify-consume` yang disesuaikan | BE | proposed |
| **M-Q3** | **Auth**: GoTrue self-host (atau Auth.js). Pertahankan `users.auth_user_id` & mapping peran; magic link (stub) tetap. | M-Q1, M-Q2 | Login/kirim token → PostgREST menerima; demo accounts terhubung | BE | proposed |
| **M-Q4** | **Storage → S3** (bucket menu-images/merchant-photos/avatars). Salin objek; policy via presigned URL; ubah `uploadToBucket`. | M-Q1 | Unggah/baca publik sama seperti sekarang; URL lama diarahkan/di-migrasi | BE+FE | proposed |
| **M-Q5** | **Realtime**: pindah ke self-host/Centrifugo atau setujui polling. Publikasi tabel inti (`orders`, `notifications`, `checkpoints`, `dispatches`). | M-Q1 | Perubahan data sampai <2s; reconnect resync | BE+FE | proposed |
| **M-Q6** | **Edge Function & job**: `send-push`, `pg_cron` (SLA/auto-settle), `pg_net`/Vault → pengganti (cron host / worker + secret env). | M-Q1, M-Q2 | Push terkirim; job `run_cron_jobs` terjadwal | BE | proposed |
| **M-Q7** | **Cutover**: arahkan FE (`VITE_SUPABASE_URL/ANON_KEY` → env target), uji e2e (`scripts/api-e2e.mjs`, `db-verify`), freeze tulis lama, sinkron delta, buka baca/tulis baru. | M-Q2..M-Q6 | e2e 18/18 di target; tidak ada regresi; rollback teruji | BE+FE | proposed |
| **M-Q8** | **Dekomisi & pembersihan**: cabut proyek/limit Supabase (turukan kuota), hapus dependensi mati, arsipkan `supabase/` sebagai referensi. | M-Q7 | Dokumen sukses; kuota tak lagi terlampaui | PO+BE | proposed |

## Risiko & mitigasi
| # | Risiko | Mitigasi |
|---|---|---|
| R1 | **RLS bergantung `auth.uid()`** — pindah PostgREST butuh klaim JWT di-set (`request.jwt.claims`) + helper diganti | Uji RLS di M-Q2 sebelum cutover |
| R2 | **Storage URL hardcoded** di data (`merchants.photo` bisa URL Supabase) | Skrip rewrite kolom URL di M-Q4 |
| R3 | **Realtime** turun ke polling → pengalaman | Uji latensi; centang NFR-05 resync |
| R4 | **Downtime cutover** | Freeze tulis + delta sync + rollback plan (M-Q7) |
| R5 | **Biaya target** | Bandingkan egress/storage provider; mulai kecil |

## Bukan bagian milestone ini
- Perubahan kontrak API (biarkan `docs/backend` apa adanya; hanya implementasi yang pindah).
- Fitur baru PRD aktif; ini murni migrasi infrastruktur.

## Referensi
- Runbook langkah demi langkah: `docs/backend/MIGRATION-quota-exit-runbook.md`
- Skema: `supabase/00`–`47-*.sql` · Kontrak: `docs/backend/{openapi.yaml,ERD.md,CONSUME.md}`
- FE akses: `src/api/{config,db,reference,auth,storage,push,mvp}.ts`
