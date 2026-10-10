# Push Notification — Pipeline (Webhook → Edge Function → VAPID)

```
notifications INSERT ──(Database Webhook)──▶ Edge Function send-push ──(VAPID)──▶ FCM ──▶ perangkat
```

- **Pemicu:** Database Webhook pada `public.notifications`, event **Insert**. Aplikasi menulis baris `notifications` tiap transisi order, jadi push ikut terkirim — tanpa polling.
- **Pengirim:** Edge Function [`send-push`](../../../supabase/functions/send-push/index.ts). Membaca `push_subscriptions` milik `notifications.user_id`, menandatangani payload (VAPID), mengantar, lalu menghapus langganan kedaluwarsa (404/410).
- **Isi:** `title`/`body` baris `notifications`. URL klik mengikuti `audience` (customer → `/customer/home`, merchant → `/merchant`, courier → `/courier`, cs → `/admin`).

## Berkas

| Berkas | Isi |
|---|---|
| `supabase/functions/send-push/index.ts` | Edge Function (Deno, `npm:web-push@3.6.7`). |
| `scripts/send-push.mjs` | Pengirim lokal dev (baca `.env.local`), uji tanpa deploy. |
| `src/lib/push.ts` | Klien: `requestPushPermission`, `deliverPush`, `subscribePush` (SW subscribe + simpan ke `push_subscriptions`). |

## Deploy (sekali)

```bash
supabase link --project-ref dwzxtnfesmpobnepilhl
supabase secrets set \
  VAPID_PUBLIC_KEY=<public> \
  VAPID_PRIVATE_KEY=<private> \
  VAPID_SUBJECT=mailto:support@sa7tein.app
npm run push:deploy          # supabase functions deploy send-push
```

`SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` disuntik platform otomatis.

Klien butuh env yang sama: `VITE_VAPID_PUBLIC_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (kunci privat **tidak pernah** masuk repo/bundle).

## Webhook (sudah terpasang)

Alih-alih Dashboard, webhook dibuat via SQL ([`supabase/18-webhook-send-push.sql`](../../../supabase/18-webhook-send-push.sql)):
trigger `notifications_send_push` (AFTER INSERT) memanggil `net.http_post` (ekstensi `pg_net`) ke
Edge Function `send-push`. Service-role disimpan **terenkripsi di Supabase Vault**
(`send_push_service_key`), bukan di repo.

Set sekali (manual): `select vault.create_secret('<SERVICE_ROLE_KEY>', 'send_push_service_key', '…');`

> Versi Dashboard juga bisa: *Database Webhooks* → Table `public.notifications`, Event Insert → Edge Function `send-push`, header `Authorization: Bearer <service_role>`.

## Uji

```bash
# jalur produksi: sisipkan notifikasi → webhook memanggil function → push terkirim
# jalur lokal dev:
npm run push:send -- --title "Pesanan siap" --body "Sate Ayam sedang dimasak" --url /customer/orders
npm run push:send -- --user 1 --title "Halo" --body "Untuk user 1 saja"
```

## Status (2026-10-10)

- ✅ Edge Function `send-push` **deployed** (ACTIVE).
- ✅ Secrets VAPID (public/privat/subject) ter-set; klien `VITE_VAPID_PUBLIC_KEY` disamakan.
- ✅ Webhook trigger `notifications_send_push` aktif — uji INSERT → `send-push` balas `200 {"sent":0,"note":"no subscriptions"}`.
- ⏳ **Langganan perangkat belum ada** (`push_subscriptions` kosong). Butuh klien di perangkat nyata menjalankan `subscribePush(userId)`.

## Catatan

- **Scope:** ini backend/edge — deviasi dari AGENTS §1 (repo front-end). Ditambahkan atas permintaan eksplisit; app tetap mock.
- Dependency baru: `web-push@3.6.7` (devDependency, untuk pengirim lokal). Edge Function memakai `npm:web-push@3.6.7` (tanpa entri package.json).
- Bila runtime Edge menolak `crypto` web-push (gejala `Invalid PEM label` / `Argument 2 is not of type CryptoKey`), ganti ke `jsr:@negrel/webpush`.
- Kunci VAPID harus pasangan yang sama dengan `VITE_VAPID_PUBLIC_KEY` di klien. Jangan commit kunci privat.
