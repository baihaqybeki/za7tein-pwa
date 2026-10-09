# Rencana Diagram Flow Bisnis Sa7tein

Dokumen perencanaan untuk diagram flow bisnis (archify). Peta arsitektur sudah jadi:
`docs/design/app-map/`. **Status: flow F1–F24 terdaftar di `INDEX.json`** — F23 (`f23-customer-discovery`) masih `proposed` karena requirement PRD-nya belum ditulis; F24 (`f24-payment-methods`) baru (PO 2026-09-25) — lihat `INDEX.json` / `index.html`.

Sumber: PRD aktif `irbid-mvp-v2-2026-09-21`
(`docs/product/prd/versions/irbid-mvp-v2-2026-09-21/{source,analysis,milestones}.md`).
Setiap flow wajib merujuk requirement `R-*` dan milestone. Item `UNRESOLVED` tetap
ditandai `UNRESOLVED` di diagram — jangan diisi tebakan.

---

## 1. Konvensi folder (WAJIB, jangan pecah)

Satu flow = satu folder `docs/design/flows/<slug>/`:

| Berkas | Isi |
|---|---|
| `<slug>.json` | Spec archify diagram **utama** — sumber yang diedit |
| `<slug>.sequence.json` | **Opsional** — sequence diagram **orkestrasi sistem**, scoped ke flow ini (event/timer antar-aktor). Artefak `<slug>.sequence.html` |
| `<slug>.html` | Artefak jadi — **generated, di-gitignore** |
| `<slug>.visual-check.*` | Screenshot + receipt + contact sheet — **generated, di-gitignore**; PNG dibuang otomatis setelah lolos |
| `README.md` | Ringkas flow + sumber requirement + cara update |
| `index.html` | **Dashboard terpusat**: pilih flow → stage iframe, tombol Back/Esc, deep-link `#<slug>`, peta koneksi + trace |

Aturan (sama seperti `app-map/`):
- Semua berkas satu flow tinggal dalam satu folder. **Jangan** taruh file lepas di `docs/design/`.
- Nama `<slug>` = `f<n>-<nama-singkat>` (mis. `f1-order-lifecycle`).
- Jangan campur dua flow dalam satu spec.

### Update — SATU perintah, jangan tiga

```bash
./scripts/flows-gate.sh <slug>          # satu flow
./scripts/flows-gate.sh --all           # semua flow (regenerasi artefak)
./scripts/flows-gate.sh <slug> --keep-shots   # simpan PNG (hanya saat debug)
```

Script itu menjalankan `deliver` + `visual-check` untuk **semua spec** di folder flow
(`<slug>.json` + `<slug>.sequence.json`), membaca `diagram_type` tiap spec, membuang PNG
kalau lolos, dan mencetak satu baris per spec. Jangan panggil `archify.mjs` langsung untuk kerja rutin.

### Fitur archify yang dipakai (dan yang tidak)

Perintah yang dipakai: **`deliver`** + **`visual-check`** saja (keduanya di dalam script).

| Fitur | Pakai? | Alasan |
|---|---|---|
| `deliver` | ya | validate 9/9 + freeze spec + render + receipt sha |
| `visual-check` | ya | bukti containment 4 viewport × 2 tema |
| `validate` terpisah | tidak | sudah termasuk di `deliver` |
| `render` | tidak | duplikat `deliver`, tanpa validasi |
| `preview` | tidak | membuka browser, bukan gate |
| `check` / `inspect` | tidak | tidak dipakai |
| `brands` / `brands capture` | **tidak** | badge brand = visual identity; butuh URL + digest pin, tidak perlu untuk flow internal |
| `compare` / `migrate` | tidak | tidak ada kebutuhan diff/schema v1→v2 |
| `guide` / `examples` / `demo` / `doctor` | tidak | hanya untuk belajar skill |
| `meta.animation: trace` | tidak | motion opt-in; menambah kerja authoring |
| `meta.views`, `meta.visual_preset`, `meta.legend`, `meta.engineering_profile`, `meta.locale` | tidak | semua opsional; default `classic` paling murah |
| `via` / `channelX` / `labelAt` | hanya kalau diagnostik minta | geometri manual = kerja ekstra |
| Fitur **export** di HTML (PNG/JPEG/WebP/SVG/WebM) | **tidak pernah dipakai** | tombol bawaan viewer, bukan perintah; tidak ada flag untuk mematikannya. Ukuran HTML (~790 KB) berasal dari runtime viewer (tema, pan/zoom, search, trace, export) dan **sama** untuk `--quality standard` maupun `showcase` |

### Anggaran komposisi (biar tidak iterasi 5 putaran)

- Maksimum **3 kartu**; kartu pertama = kartu bisnis (masalah · aktor/nilai · skenario), maksimum 2 item.
- Maksimum 3 item per kartu, satu baris per item kalau bisa — viewer hanya memberi ~900px tinggi di 1440×900.
- Overflow vertikal 1440×900 = perpendek teks kartu; jangan ubah geometri.

### Gate penerimaan (per flow)

1. `./scripts/flows-gate.sh <slug>` → **9/9 checks, 0 error, 0 warning** (validate sudah termasuk).
2. `deliver` → exit 0, SHA-256 spec + artifact terlaporkan (satu baris script).
3. `visual-check` → pass di 4 viewport (1440×900, 1600×1000, 1920×1080, 2048×1320), light + dark, overflow 0.
4. Konten diagram berbahasa Indonesia; Viewer UI Inggris (renderer hanya `en`/`zh-CN`).
5. Kalau flow menyentuh `UNRESOLVED`: tandai eksplisit di node/label, jangan asumsikan.

---

## 2. Daftar flow

Urutan bangun = urutan milestone (M1 → M11), lalu nilai baca. Status: `todo` / `done`.

### F1 — Order end-to-end ✅ done
- **Slug:** `f1-order-lifecycle` · **Type:** `workflow` · **Milestone:** M2–M5
- **Alur utama:** pilih menu → checkout (ongkir + fee) → order dibuat (reserve saldo) → merchant konfirmasi "Ambil" → masak → kurir match → "Berangkat" → "Tiba" (geo + foto) → OTP 4 digit → order done (saldo berkurang) → rating
- **Cabang:** di luar zona → checkout diblokir; saldo akun baru < 3,5 JOD → gate
- **Sumber:** R-COD-01, R-DELIV-01, R-TOPUP-01, R-FEE-01 (analysis); M2, M4, M5
- **Catatan:** ini flow payung; detail uang ada di F2, detail checkpoint di F5

### F2 — COD via wallet (hold lifecycle) ✅ done
- **Slug:** `f2-cod-hold` · **Type:** `lifecycle` · **Milestone:** M4
- **State:** `none → held → settled`; batal sebelum done `held → released` (saldo tidak berkurang). `cut`/`reversed` dihapus (PO 2026-09-25)
- **Event:** `reserve_created` (order dibuat), `reserve_settled` (order done), `reserve_released` (batal sebelum done) — tiap transisi = 1 entry ledger append-only
- **Sumber:** R-COD-01 (analysis); M4.1

### F3 — Wallet & top-up ✅ done
- **Slug:** `f3-wallet-topup` · **Type:** `workflow` · **Milestone:** M3
- **Alur:** customer top-up (mock Xendit VA/QRIS) → `pending → completed` → saldo; gate top-up minimum 3,5 JOD untuk akun baru
- **Wallet:** customer (top-up), merchant (auto-kredit saat settle), kurir (tips saja)
- **Sumber:** R-WALLET-01, R-TOPUP-01; M0, M2, M3

### F4 — Fee & pajak checkout ✅ done
- **Slug:** `f4-fee-tax` · **Type:** `dataflow` · **Milestone:** M2, M7
- **Masuk:** subtotal, ongkir (100% merchant), fee customer 0,22 JOD, fee merchant 0,15 JOD (platform 0,37 JOD)
- **Pajak 2 lapis:** GST makanan Jordan 16% (merchant setor) + GST/PPh atas fee platform; PPh final 0,5%
- **Berlaku semua metode**, termasuk legacy transfer manual/COD cash (PO 2026-09-22)
- **UNRESOLVED:** tarif GST makanan spesifik, PPN ekspor jasa, status PKP (R-TAX-01; OQ-2/3/4/17/18)
- **Sumber:** R-FEE-01, R-TAX-01; M2, M7

### F21 — Registrasi & masuk akun ✅ done
- **Slug:** `f21-account-auth` · **Type:** `workflow` · **Milestone:** M8
- **Alur customer:** onboarding → login Google → nomor WA wajib (E.164) → verifikasi format → profil & PIN → gate top-up 3,5 JOD sebelum bisa order (`f3`)
- **Alur merchant/kurir:** form toko → nomor WA toko → diserahkan ke `f16` (deposit 3,50 JOD + approval SA)
- **Dasar:** PRD `source.md:760` (nomor WA wajib) + `:727` (E.164) + keputusan PO 2026-09-22 (Google menggantikan sandi, nomor WA wajib Level 1)
- **UNRESOLVED:** apakah merchant/kurir juga boleh Google · sesi/token & PIN belum berdasar PRD · ganti nomor & retensi · verifikasi otomatis (Level 2) ditunda

### F5 — Verifikasi pengiriman (checkpoint + OTP + SLA) ✅ done
- **Slug:** `f5-delivery-verification` · **Type:** `lifecycle` · **Milestone:** M5
- **Checkpoint:** Ambil (merchant) → Berangkat (timer 15m) → Tiba (geolocation + foto, timer 30m) → Selesai (OTP 4 digit, timer 10m); auto-settle 10 menit setelah Tiba
- **Timer:** 15/30/10 dipakai sementara (PO 2026-09-22)
- **UNRESOLVED:** % penalti customer lalai (OQ-14)
- **Sumber:** R-DELIV-01; M5

### F6 — Cash-out & payout ✅ done
- **Slug:** `f6-cashout-payout` · **Type:** `workflow` · **Milestone:** M3, M9
- **Alur:** customer cash-out saldo → rekening; merchant payout; kurir payout (tips)
- **UNRESOLVED:** fee cash-out (OQ-22 — blocker M3), flow cash-out (OQ-16). Tampilkan sebagai placeholder fee.
- **Sumber:** R-CASHOUT-01, R-WALLET-01; M3

### F7 — Ledger & liability ✅ done
- **Slug:** `f7-ledger-liability` · **Type:** `dataflow` · **Milestone:** M9
- **Aturan:** double-entry, append-only, kronologis; reversal hanya lewat entry baru; saldo wallet user = **liability** platform
- **Metrik:** saldo Xendit ≥ total liability wallet, kalau kurang → flag
- **Sumber:** R-LEDGER-01; M9

### F8 — Dispute ✅ done
- **Slug:** `f8-dispute` · **Type:** `workflow` · **Milestone:** M6
- **Alur:** customer/merchant ajukan (kategori + alasan + bukti), 1× per order, window 24 jam → order `disputed`, hold dibekukan, auto-settle pause → queue panel admin (CS) → 4 resolusi (refund penuh / refund sebagian / release ke merchant / tolak) → tiap resolusi = 1 entry ledger; kasus tanpa pihak bersalah dari `protection_fund`
- **UNRESOLVED:** finalisasi window/kategori/SLA (OQ-29), siapa super admin (OQ-30)
- **Sumber:** R-DISPUTE-01; M6

### F9 — Insentif Founding Merchant ✅ done
- **Slug:** `f9-incentive` · **Type:** `workflow` · **Milestone:** M10
- **Alur:** merchant baru dapat kredit 5 JOD (non-withdrawal) → fee 0,15 JOD dipotong dari kredit (~33 order) → ambang tier 500 / 1.000 / 1.250 order per periode → cashback 15 / 40 / 62,5 JOD ke dompet deposit
- **UNRESOLVED:** withdrawability cashback (I-3), periode tier (I-4), kuota Founding (I-5), sisa modal saat berhenti (I-6)
- **Sumber:** R-INCENTIVE-01; M10

### F10 — Kurs IDR↔JOD ✅ done
- **Slug:** `f10-exchange-rate` · **Type:** `sequence` · **Milestone:** M1
- **Alur:** IDR = source of truth → render padanan JOD dari rate → fetch provider 1×24 jam → simpan `exchange_rates` → fallback cache terakhir kalau fetch gagal
- **UNRESOLVED:** provider rate JOD (OQ-26), umur maksimal cache (OQ-28)
- **Sumber:** R-CURR-01; M1

### F11 — Push + fallback WhatsApp ✅ done
- **Slug:** `f11-push-notification` · **Type:** `sequence` · **Milestone:** M8
- **Alur:** registrasi (nomor WA wajib, E.164) → subscribe push → kirim payload (≤4KB, TTL wajib, `userVisibleOnly`) → iOS: install gate 16.4+, force-quit = bisu, ITP 7 hari → fallback deep link `wa.me`
- **UNRESOLVED:** push device test (iOS + Android) (R-PUSH-01). WA Business API L2 TIDAK dipakai di MVP (PO 2026-09-23). Nomor WA OQ-24 sudah RESOLVED (PO 2026-09-22): Level 1, tanpa OTP
- **Sumber:** R-PUSH-01; M8

### F12 — Merchant Console ✅ done
- **Slug:** `f12-merchant-console` · **Type:** `workflow` · **Milestone:** M4/M5/M11 (PRD) + plan-merchant M0–M7
- **Alur:** toggle Buka/Tutup → antrean order → Terima/Tolak → **window prepare (batch)** (`etaPrepare`/`slaPrepareDeadline`) → **close batch** → **assign kurir sendiri** setelah batch ready; guard: batch tanpa kurir → reassign/batal → refund
- **Aturan:** batch = unit prepare (schema entri 11: prepare→closed→waitingCourier→waitingDelivery→delivery); platform TIDAK assign kurir (C-06), assign setelah batch ready; ongkir 100% merchant (C-07); maks 3 kurir
- **UNRESOLVED:** batch & auto-resequence **tidak ada di PRD aktif** (schema-only, proposed) · merchant sbg pihak bersengketa (OQ-30) · nav merchant belum diputuskan
- **Sumber:** plan-merchant.md, C-06/C-07/C-17, R-COD-01, schema entri 11; M4, M5, M11

### F13 — Tampilan Kurir ✅ done
- **Slug:** `f13-courier-view` · **Type:** `workflow` · **Milestone:** M4, M5
- **Alur:** order masuk → Tap "Ambil" (2-way) → "Berangkat" (SLA 15m) → "Tiba" (geo+foto) → OTP 4 digit → `reserve_settled`; guard: customer lalai → "Batal" (total 10m)
- **UNRESOLVED:** % penalti customer lalai (OQ-14), SLA final (OQ-13); lantai/unit + label "Mulai Antar" tak ada di PRD v2 (unresolved-by-absence)
- **Sumber:** R-DELIV-01, R-COD-01, C-06..C-11; M4, M5

### F23 — Customer discovery (multi-merchant) 🟡 proposed
- **Slug:** `f23-customer-discovery` · **Type:** `workflow` · **Milestone:** belum (butuh requirement PRD dulu)
- **Alur utama:** buka app → daftar merchant (terdekat + badge buka) → pilih merchant → menu merchant → lanjut checkout (`f1:browse`)
- **Guard:** warung tutup ditandai · di luar zona tidak muncul · hasil kosong → ubah filter/zona
- **Dasar:** keputusan PO 2026-09-25 (`DEC-1041`) + bentuk layar referensi `repo-sa7tein-schema.md:15`
- **UNRESOLVED:** requirement `R-*` belum ditulis di PRD aktif · format daftar/filter · perilaku merchant tutup/di luar zona
- **Catatan:** kode masih single-merchant (`mockMerchant`) → gap; menambahkan langkah "pilih merchant" ke `f1` tidak bisa (workflow v2 dibatasi `col` 0..5), jadi dibuat flow terpisah yang menyerahkan ke `f1`.

### F24 — Pembayaran order (COD & prepaid) ✅ done
- **Slug:** `f24-payment-methods` · **Type:** `workflow` · **Milestone:** M4
- **Alur utama:** order dibuat (saldo di-reserve) → pilih metode → **COD:** kurir tiba → customer diminta bayar tagihan → konfirmasi → settle; **prepaid:** reserve dicairkan otomatis saat done
- **Guard:** tidak bayar → timer auto-settle / dispute (`f8`)
- **Dasar:** PO 2026-09-25 (reserve→done + prompt bayar COD); R-COD-01, R-FEE-01, R-TOPUP-01
- **UNRESOLVED:** durasi timer auto-settle saat tidak bayar · penalti customer lalai (OQ-14)
- **Catatan:** saldo tidak berkurang saat order; COD bayar saat serah terima (bukan potong saat match).

---

## 3. Urutan pengerjaan (rekomendasi)

| Urut | Flow | Alasan |
|---|---|---|
| 1 | F1 order lifecycle | payung; dipakai semua role |
| 2 | F2 COD hold | money path, paling berisiko |
| 3 | F3 wallet & top-up | pintu masuk dana |
| 4 | F5 verifikasi kirim | melengkapi F1 |
| 5 | F4 fee & pajak | menjelaskan angka |
| 6 | F7 ledger & liability | lanjutan uang |
| 7 | F6 cash-out & payout | keluar dana |
| 8 | F8 dispute | operasional admin |
| 9 | F9 insentif | akuntansi merchant |
| 10 | F10 kurs | lintas potong (bisa kapan saja) |
| 11 | F11 push | lintas potong (bisa kapan saja) |
| 12 | F12 merchant console | role merchant; drill-down F1:dapur |
| 13 | F13 tampilan kurir | role kurir; drill-down F12 → F1:otp |

F1–F3 satu rangkaian cerita uang — kalau tiga ini jadi, sisanya turunan. F12/F13 menutup dua role yang tadinya cuma lane di F1.

## 4. Peta milestone

| Milestone | Flow |
|---|---|
| M0 model domain | (dasar, tanpa flow) |
| M1 kurs | F10 |
| M2 fee | F4 |
| M3 wallet | F3, F6 |
| M4 COD hold | F2 |
| M5 verifikasi kirim | F5 |
| M6 dispute | F8 |
| M7 pajak | F4 |
| M8 push | F11 |
| M9 ledger | F7 |
| M10 insentif | F9 |
| M11 verifikasi lintas role | output F1–F13 (konsistensi) |
