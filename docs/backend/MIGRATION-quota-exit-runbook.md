# Runbook: migrasi keluar dari kuota Supabase (Database + S3)

Pasangan dari `MIGRATION-quota-exit-milestones.md`. Perintah di bawah **contoh**; sesuaikan host/secret.
Prinsip: **jaga kontrak** (`rest/v1/<tabel>` + RPC) agar FE (`src/api/*`) nyaris tak berubah.

Deadline: proyek dibatasi **21 Okt 2026** bila tetap melebihi kuota.

---

## 0. Inventaris sebelum mulai
```bash
# Skema & data saat ini (butuh kredensial DB)
pg_dump "$OLD_DB_URL" --schema-only > /tmp/schema.sql
pg_dump "$OLD_DB_URL" --schema-only --section=pre-data > /tmp/pre.sql
# daftar tabel/fungsi/policy
psql "$OLD_DB_URL" -c "\dt"
psql "$OLD_DB_URL" -c "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public';"
psql "$OLD_DB_URL" -c "select tablename,policyname,cmd from pg_policies where schemaname='public';"
# objek storage
# (Supabase Dashboard → Storage, atau Storage API list per bucket)
```
Dependensi FE yang wajib dipetakan: `src/api/config.ts` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`VITE_VAPID_PUBLIC_KEY`, `VITE_API_SPEC_URL`), `db.ts`, `auth.ts`, `storage.ts`, `push.ts`, `realtime`.

---

## 1. (M-Q0) Mitigasi kuota cepat — sebelum migrasi penuh
- Matikan polling; pastikan FE langganan Realtime untuk `orders`, `notifications`, `checkpoints` (sudah
  dipublikasikan via `42`), bukan `setInterval` fetch.
- Turunkan `limit` inbox/chat; hindari `select=*` (mis. pakai kolom eksplisit; `orders.otp` sudah dibatasi).
- Pindahkan aset statis ke CDN; aktifkan cache header untuk objek publik storage.
- Hentikan job yang berisik; jalankan `run_cron_jobs` sesuai jadwal (bukan tiap detik).
Verifikasi: pantau Dashboard → Usage (egress/database/storage) menurun.

---

## 2. (M-Q1) Pilih target
Isi tabel keputusan (decision record terpisah):
| Komponen | Kandidat | Pilihan | Catatan |
|---|---|---|---|
| Postgres | Neon / Railway / self-host Docker | | Postgres 15+ , ekstensi `pgcrypto`, `pg_cron`, `pg_net` |
| REST | PostgREST self-host | | Pertahankan `/rest/v1`; set klaim JWT |
| Auth | GoTrue self-host / Auth.js | | `users.auth_user_id` tetap |
| Storage | AWS S3 / Cloudflare R2 / MinIO | | S3-compatible |
| Realtime | Supabase Realtime self-host / Centrifugo / polling | | |
| Edge + cron | Vercel/CF/Node + cron | | `send-push`, SLA/auto-settle |

---

## 3. (M-Q2) Migrasi skema + data ke Postgres target

### 3a. Restore skema
```bash
psql "$NEW_DB_URL" -c 'create extension if not exists pgcrypto; create extension if not exists pg_cron; create extension if not exists pg_net;'
psql "$NEW_DB_URL" -f /tmp/pre.sql            # tabel, tipe, fungsi non-auth
# lalu jalankan migrasi repo berurutan (sumber kebenaran):
for f in supabase/00-*.sql supabase/0*.sql supabase/1*.sql supabase/2*.sql supabase/3*.sql supabase/4*.sql; do
  echo "-- $f"; psql "$NEW_DB_URL" -f "$f";
done
```
> Catatan: `supabase/*.sql` memakai RLS + helper `app_uid()/app_role()/app_is_ops()` yang mengandalkan
> `auth.uid()`. Di target non-Supabase, ganti sumber klaim:
```sql
-- contoh: PostgREST mengisi request.jwt.claims (GUC) dari JWT
create or replace function public.app_uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb->>'sub', '')::uuid
$$;
```
`app_role()`/`app_is_ops()` disesuaikan membaca klaim peran (`users.role` via join `auth_user_id`).

### 3b. Pindahkan data (per tabel, urut FK)
```bash
# opsi cepat: dump data saja, restore tanpa owner/privileges
pg_dump "$OLD_DB_URL" --data-only --disable-triggers --no-owner --no-privileges > /tmp/data.sql
psql "$NEW_DB_URL" -f /tmp/data.sql
# tabel identity: jangan set id manual; pastikan sequence disetel:
psql "$NEW_DB_URL" -c "select setval(pg_get_serial_sequence('orders','id'), (select max(id) from orders));"
```
Ulangi `setval` untuk tiap tabel ber-identity.

### 3c. Verifikasi
```bash
npm run db:remote-check   # (arahkan env ke NEW_DB_URL) — tabel ada + seed
npm run db:verify-consume # 12 cek RLS + tulis
npm run db:e2e            # reserve->settle
```

---

## 4. (M-Q3) Auth
- **GoTrue self-host**: jalan sebagai service; set `GOTRUE_JWT_SECRET`, `GOTRUE_DB_DATABASE_URL`,
  `GOTRUE_SITE_URL`. Buat ulang akun demo (`customer@/merchant@/courier@/cs@sa7tein.app`), sambungkan
  ke `users.auth_user_id`.
- **Alternatif Auth.js**: terbitkan JWT ber-klaim `sub` (uuid) + peran; PostgREST memverifikasi lewat
  `PGRST_JWT_SECRET`.
Ubah FE: `src/api/auth.ts` (endpoint token) — sisanya tetap (`/auth/me` → endpoint baru).

---

## 5. (M-Q4) Storage → S3
### 5a. Bucket & policy
```bash
aws s3 mb s3://sa7tein-menu-images --endpoint-url "$S3_ENDPOINT"
aws s3 mb s3://sa7tein-merchant-photos --endpoint-url "$S3_ENDPOINT"
aws s3 mb s3://sa7tein-avatars --endpoint-url "$S3_ENDPOINT"
```
Policy publik-baca untuk objek (sama seperti bucket Supabase `public=true`); tulis hanya folder
`<uid>/…` via klien ber-presign (atau policy IAM). 

### 5b. Salin objek
```bash
rclone sync supats:menu-images        s3remote:sa7tein-menu-images
rclone sync supats:merchant-photos    s3remote:sa7tein-merchant-photos
rclone sync supats:avatars            s3remote:sa7tein-avatars
```

### 5c. Rewrite URL di data
```sql
-- ganti host lama → host S3/CDN pada kolom URL
update merchants set photo = replace(photo, 'https://dwzxtnfesmpobnepilhl.supabase.co/storage/v1/object/public/merchant-photos', 'https://cdn.example/merchant-photos') where photo like '%supabase.co%';
update menus set image = replace(image, 'https://dwzxtnfesmpobnepilhl.supabase.co/storage/v1/object/public/menu-images', 'https://cdn.example/menu-images') where image like '%supabase.co%';
-- ulangi untuk users.avatar / customers.avatar
```

### 5d. Ubah FE `src/api/storage.ts`
Ganti `POST {SUPABASE_URL}/storage/v1/object/<bucket>/<path>` menjadi **presigned PUT**:
```ts
// 1) minta URL presign dari backend kecil (atau generate di klien bila kredensial aman)
const presign = await fetch(`${API_BASE}/storage/presign`, { method:'POST', headers, body: JSON.stringify({ bucket, path }) }).then(r=>r.json())
// 2) unggah langsung ke S3
await fetch(presign.url, { method:'PUT', headers:{ 'Content-Type': file.type }, body: file })
// 3) simpan URL publik hasil
return presign.publicUrl
```
Tanda tangan `uploadToBucket(bucket,file,userId)` **dipertahankan** agar pemanggil tak berubah.

---

## 6. (M-Q5) Realtime
- Opsi A: self-host Supabase Realtime (tetap kontrak `postgres_changes`).
- Opsi B: Centrifugo/WS sendiri → FE `src/api/realtime.ts` ganti transport; resync saat reconnect (NFR-05).
Publikasi tabel inti: `orders`, `notifications`, `checkpoints`, `dispatch_assignments`, `quota_subscriptions`.
Verifikasi: latensi <2s; reconnect memuat state terlewat.

---

## 7. (M-Q6) Edge Function & job
- Pindahkan `supabase/functions/send-push` → layanan (Vercel/CF/Node). Simpan VAPID private di env host.
- Ganti trigger `pg_net`+Vault: panggil endpoint push dari **outbox** ringan (tabel `notifications` +
  cron) bila `pg_net` tak tersedia.
- Jadwalkan `run_cron_jobs` (expire + close_stale_chats + quota alert) via cron host/pg_cron.
Verifikasi: push terkirim; job berjalan sesuai jadwal.

---

## 8. (M-Q7) Cutover & rollback
### Pra-cutover
1. Freeze tulis di lama (maintenance flag / cabut kredensial tulis).
2. Sinkron delta terakhir (`pg_dump --data-only` delta atau logical replication).
3. Set env target di FE + `vercel env add` (URL/KEY/API spec), deploy pratinjau.
4. Uji: `scripts/api-e2e.mjs`, `db:verify-consume`, `db:e2e`, smoke rute kunci (home/checkout/merchant/courier).

### Go / No-go
- e2e 18/18; RLS lolos; storage unggah/baca; realtime <2s; push OK.

### Rollback
- Arahkan env FE kembali ke Supabase lama (masih hidup), cabut freeze, umumkan.
- Simpan snapshot target; jangan hapus sampai stabil ≥1 minggu.

---

## 9. (M-Q8) Dekomposisi
- Turunkan kuota proyek Supabase lama / cabut.
- Hapus dependensi mati di `package.json` (`web-push` tetap bila dipakai host baru).
- Arsipkan `supabase/` sebagai referensi skema; catat pelajaran di atlas.
- Perbarui `docs/backend/CONSUME.md` **hanya bila** koneksi/panduan berubah (ini dokumentasi baru,
  bukan mengubah kontrak).

---

## Checklist ringkas (tempel di PR migrasi)
- [ ] M-Q0 mitigasi kuota (usage turun)
- [ ] M-Q1 decision record target
- [ ] M-Q2 skema+data pindah, helper auth diganti, `db:verify-consume` hijau
- [ ] M-Q3 auth (GoTrue/Auth.js) + demo accounts
- [ ] M-Q4 storage pindah, URL di-rewrite, `uploadToBucket` → presign
- [ ] M-Q5 realtime berjalan + resync
- [ ] M-Q6 push + cron di host baru
- [ ] M-Q7 cutover + rollback teruji (`api-e2e` 18/18)
- [ ] M-Q8 dekomisi Supabase lama

## Jangan dilakukan
- Mengubah `docs/backend/openapi.yaml`/`ERD.md` (kontrak) saat migrasi — hanya implementasi yang pindah.
- Menghapus snapshot lama sebelum stabil.
- Menyimpan VAPID/secret di repo.
