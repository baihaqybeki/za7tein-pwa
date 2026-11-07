# Live Location Kurir

Fitur: kurir mengirim posisi bergerak; peserta order (customer/merchant/kurir terkait/ops) membaca
lokasi kurir untuk satu order. Backend: Cloudflare Worker + D1. Batasan PRD **L1**: lokasi hanya
andal saat app kurir terbuka & layar menyala (bukan background tracking).

- **Base URL**: `https://sa7tein-api-cf.sa7tein-pwa.workers.dev`
- **Auth**: JWT dari `/auth/verify`, header `Authorization: Bearer <token>` (masa 24 jam).
- **CORS**: terbuka (boleh dipanggil dari domain FE mana pun).
- **Realtime**: update lokasi memicu broadcast `{type:'rpc',fn:'update_courier_location'}` ke topic `orders`.

## Data
`couriers.latitude`, `couriers.longitude`, `couriers.last_seen_at`.
`stale` ditentukan server: `true` bila `last_seen_at` > **120 detik** yang lalu.

---

## 1. Autentikasi (magic-link, stub)

```bash
BASE=https://sa7tein-api-cf.sa7tein-pwa.workers.dev

curl -s -X POST "$BASE/auth/magic-link" -H 'content-type: application/json' \
  -d '{"email":"courier@sa7tein.app","role":"courier"}'
# → {"ok":true,"token":"<ML_TOKEN>","note":"email stub"}

curl -s -X POST "$BASE/auth/verify" -H 'content-type: application/json' \
  -d '{"token":"<ML_TOKEN>"}'
# → {"access_token":"<JWT>","token_type":"bearer","user":{...}}

curl -s "$BASE/auth/me" -H "authorization: Bearer <JWT>"
```

Akun demo pemilik merchant (untuk uji peserta): `merchant@` → Warung Sate Pak Ali (id 1),
`merchant5@` → Bangjak (id 11), `merchant6@` → Warung Langit (id 12).

---

## 2. Kurir mengirim lokasi

`POST /rest/v1/rpc/update_courier_location`

| Field | Tipe | Wajib |
|---|---|---|
| `p_lat` | number | ya |
| `p_lng` | number | ya |

```bash
curl -s -X POST "$BASE/rest/v1/rpc/update_courier_location" \
  -H "authorization: Bearer <JWT_KURIR>" -H 'content-type: application/json' \
  -d '{"p_lat":32.5561,"p_lng":35.8512}'
```

Sukses `200`:
```json
{"courier_id":1,"latitude":32.5561,"longitude":35.8512,"last_seen_at":"2026-11-07T12:39:58.560Z"}
```
Error: tanpa token `401`; akun bukan kurir `400` (`bukan kurir`); `lat/lng` kosong `400`.

---

## 3. Peserta order membaca lokasi kurir

`POST /rest/v1/rpc/courier_location`

| Field | Tipe | Wajib |
|---|---|---|
| `p_order_id` | number | ya |

```bash
curl -s -X POST "$BASE/rest/v1/rpc/courier_location" \
  -H "authorization: Bearer <JWT_PESERTA>" -H 'content-type: application/json' \
  -d '{"p_order_id":796}'
```

Sukses `200`:
```json
{"id":1,"name":"Budi Santoso","latitude":32.5561,"longitude":35.8512,
 "last_seen_at":"2026-11-07T12:39:58.560Z","age_ms":1168,"stale":false}
```
- `null` bila order tidak punya kurir / kurir tak ditemukan.
- `401` tanpa token; `403` bila bukan peserta order (customer/merchant/kurir terkait/ops).

---

## 4. Kontrak FE (helper sudah ada)

`src/api/liveLocation.ts`
```ts
pushCourierLocation(lat: number, lng: number): Promise<boolean>
fetchOrderCourierLocation(orderId: number): Promise<OrderCourierLocation | null>
startCourierLocationWatch(onUpdate?, onError?): () => void  // geolocation.watchPosition
```

`src/hooks/useOrderCourierLocation.ts`
```ts
useOrderCourierLocation(orderId: number | null, intervalMs = 10000): OrderCourierLocation | null
```

Pemakaian:
- **Kurir** (saat pengantaran aktif): `const stop = startCourierLocationWatch(); ... stop()`.
- **Customer/merchant**: `const loc = useOrderCourierLocation(order.id)` lalu tampilkan peta;
  `loc?.stale` untuk indikator "lokasi tertunda".

---

## 5. Uji cepat (repro)

```bash
BASE=https://sa7tein-api-cf.sa7tein-pwa.workers.dev

# token kurir
ML=$(curl -s -X POST "$BASE/auth/magic-link" -H 'content-type: application/json' \
  -d '{"email":"courier@sa7tein.app","role":"courier"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')
JWT=$(curl -s -X POST "$BASE/auth/verify" -H 'content-type: application/json' \
  -d "{\"token\":\"$ML\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin)["access_token"])')

# kirim + baca
curl -s -X POST "$BASE/rest/v1/rpc/update_courier_location" -H "authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"p_lat":32.5561,"p_lng":35.8512}'; echo
curl -s -X POST "$BASE/rest/v1/rpc/courier_location" -H "authorization: Bearer $JWT" \
  -H 'content-type: application/json' -d '{"p_order_id":796}'; echo
```

Hasil uji terakhir: update `200`; baca peserta `200` (`age_ms`,`stale`); tanpa token `401`;
non-peserta `403`.

---

## 6. Catatan
- Lokasi disimpan di baris `couriers` (satu posisi terakhir), bukan riwayat.
- `stale` >120 dtk; FE sebaiknya menampilkan status "menunggu sinyal" alih-alih pin usang.
- Untuk realtime penuh (tanpa polling), ganti `useOrderCourierLocation` dengan langganan `/ws?topic=orders`
  lalu refetch saat event `update_courier_location` diterima.
- Background tracking tidak didukung (batasan **L1**).
