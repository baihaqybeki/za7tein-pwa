# F18 — Order State Machine

Diagram lifecycle tunggal untuk `order.status` (8 state sesuai skema) — selama ini potongannya tersebar di F1 (alur payung), F2 (hold), F5 (OTP), dan F8 (dispute); F18 menyatukannya jadi satu state machine. Sumber: `docs/product/schema-draft-v1.md` entri 9, PRD aktif `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f18-order-state.json` | Spec archify (lifecycle v1) — sumber yang diedit |
| `f18-order-state.html` | Artefak jadi |
| `f18-order-state.visual-check.*` | Bukti visual-check |

## Alur

**Jalur utama (event snake_case):** `cart` → `quotation` (`checkout_submitted` — draft harga final sebelum bayar) → `prepare` (`payment_confirmed`: paid | cod | transfer verified, `placedAt` mulai SLA) → `waitingCourier` (`merchant_ready`: masak selesai / batch `etaPrepare` habis) → `waitingDelivery` (`courier_matched` dari F12 → F13, C-06 merchant pilih sendiri) → `delivery` (`courier_picked_up`, `etaDelivery` berjalan) → `done` (`otp_verified` dari F5, hold settle → F2).

**Jalur pembatalan (semua bawa `cancelBy` customer|merchant|system + `cancelReason`):** `quotation → canceled` (jendela cancel), `prepare → canceled` (merchant tolak — feeds F2 release/reverse hold), `waitingCourier → canceled`, `waitingDelivery → canceled`. **Tidak ada `delivery → canceled`** di skema — batal di jalan = incident, edge catatan ke `f8-dispute`, bukan state baru.

**Sinkronisasi `paymentStatus` (bukan `order.status`):** `unpaid` (cart/quotation) → `pending` → `paid` (prepare+); `failed` → boleh retry kembali ke `quotation`; `refunded` (post-done dispute, F22) = catatan saja, jangan dijadikan state.

Root = `cart`; terminal = `done`, `canceled`.

## Aturan keras (jangan dilupakan)

- **8 state sesuai skema, jangan ditambah.** `cart | quotation | canceled | prepare | waitingCourier | waitingDelivery | delivery | done` — nilai persis dari `schema-draft-v1.md` entri 9.
- `quotation` = draft harga final sebelum bayar; istilah ini **baru** dan belum ada di F1 (F1 memakai `cart → placed → prepare`) — konfirmasi bahasa masih UNRESOLVED.
- Semua transisi cancel wajib membawa `cancelBy` + `cancelReason`; `prepare → canceled` (merchant tolak) wajib feeds `f2-cod-hold` release/reverse hold.
- `payment_confirmed` adalah gerbang SLA: `placedAt` terisi di `prepare`, angka SLA mengikuti DEC-1037 (sementara).
- **Batch** (schema entri 11) berjalan paralel: `prepare → closed → waitingCourier → waitingDelivery → delivery`. Order `prepare` dikumpulkan di window batch (`etaPrepare`/`slaPrepareDeadline`); `merchant_ready` = batch ditutup / timer habis → order `waitingCourier`; merchant assign kurir (`courier_matched`) → `waitingDelivery`. Batch `escalatedToAdmin` kalau tanpa kurir.
- `delivery` hanya bisa berakhir `done` (OTP 4-digit, `f5-delivery-verification`) — tidak ada cabang cancel; batal di jalan = incident ke `f8-dispute`.
- `paymentStatus` (unpaid/pending/paid/failed/refunded) disinkronkan dengan `order.status`, bukan menjadi state-nya; `refunded` jangan dimasukkan ke diagram.

## Terhubung (lihat ../INDEX.json)

`f1-order-lifecycle` (payung end-to-end; selisih bahasa `quotation` vs `placed` UNRESOLVED) · `f2-cod-hold` (drill-down hold: cancel `prepare` → release, OTP → `reserve_settled`) · `f5-delivery-verification` (event `otp_verified`) · `f8-dispute` (batal di jalan, bukan state) · `f12-merchant-console` (`merchant_ready`, antrean masuk) · `f13-courier-view` (`courier_matched` C-06, `courier_picked_up`) · `f17-payment-xendit` (`payment_confirmed` paid|cod|transfer) · `f22-refund` (`refunded`, akan datang).

## Sumber (jangan dikarang)

- `docs/product/schema-draft-v1.md` — entri 9 (`order.status` 8 nilai, `paymentStatus`, `cancelBy`/`cancelReason`, `placedAt`) + entri 11 (`batch`: `etaPrepare`/`etaDelivery`, `slaPrepareDeadline`)
- Catatan skema entri 9: "`quotation` = istilah dari draft BE, belum ada di flow F1 (`cart → placed → prepare …`). Perlu disamakan bahasa sebelum ERD final."
- **Dasar: `C-17`** — enum 9 status dipertahankan + `hold_status` sub-state + state dispute; `DEC-1037` — SLA sementara. Tidak ada `R-ORD-*`/`R-STATE-*` — **jangan dikarang**; schema draft entri 9 hanya dipakai untuk nama status
- SLA `15/30/10 s` sementara — DEC-1037 (dipakai F1, M5)
- **UNRESOLVED (jangan ditebak):** `quotation` vs `placed` — bahasa F1 vs draft BE belum disamakan · jendela cancel 10 menit belum final · SLA prepare/delivery `15/30/10 s` masih sementara (DEC-1037) · `paymentStatus` di-map otomatis dari transisi vs diset manual

## Update

```bash
./scripts/flows-gate.sh f18-order-state   # deliver + visual-check + buang PNG, satu baris output
```

( jalankan dari dalam folder ini )

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).

Terakhir diperbarui: 2026-09-22 — label `R-STATE-01 synthetic` diganti dasar **`C-17`** (enum 9 status + `hold_status` + state dispute) + `DEC-1037` (SLA sementara). Validate 9/9 pass, deliver exit 0 (spec `65d63d3a`, artifact `85b41cb7`), visual-check pass (1440x900, 2048x1320 light + dark, overflow 0).
