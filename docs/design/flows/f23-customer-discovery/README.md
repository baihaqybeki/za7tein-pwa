# F23 — Customer Discovery (Multi-Merchant)

Flow pembuka customer: **memilih merchant dulu, baru menu**. Marketplace multi-merchant — keputusan PO 2026-09-25 (`DEC-1041`). Requirement PRD **belum ditulis** → status `proposed`, ditandai `UNRESOLVED` di diagram.

| Berkas | Isi |
|---|---|
| `f23-customer-discovery.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f23-customer-discovery.html` | Artefak jadi |
| `f23-customer-discovery.visual-check.*` | Bukti visual-check |

## Alur

Buka app → **daftar merchant** (terdekat + badge buka; ketersediaan dari `f12`) → **pilih merchant** (eligibility dari zona aktif `f20`) → **menu merchant** (katalog + zona) → **lanjut checkout** (`f1-order-lifecycle:browse`).

Guard: warung tutup ditandai di daftar · di luar zona tidak muncul · hasil kosong → ubah filter/zona.

## Aturan keras (jangan dilupakan)

- Ini flow **proposed**: dasar keputusan PO 2026-09-25 (`DEC-1041`) + bentuk layar referensi `repo-sa7tein-schema.md:15` ("Daftar restoran"). **Belum ada requirement `R-*` di PRD aktif** — jangan dicatat seolah sudah decided di PRD.
- Model bisnis = **multi-merchant**: `merchant` pemilik `menu`, `order` merujuk `merchant.id` (schema entri 4/7/9). Kode saat ini masih **single-merchant** (`mockMerchant`) → gap, bukan sekadar diagram.
- Node `status` (merchant) dan `zona` (merchant) adalah **input hulu** (root), bukan terminal.
- Terminal flow = `lanjut` (handoff ke `f1`), `tutup`, `luarzona`, `kosong`.
- Langkah yang belum diputuskan: urutan/format daftar, pencarian & filter, jarak/estimasi, apakah merchant tanpa zona aktif disembunyikan atau ditandai — `UNRESOLVED`.

## Terhubung (lihat `../INDEX.json`)

`f23:lanjut → f1-order-lifecycle:browse` (feeds). `f12-merchant-console` menyetel status buka/tutup; `f20-address-zone` menentukan zona aktif; `f16-merchant-onboarding` menyiapkan `merchant.deliveryConfig`.

## Sumber (jangan dikarang)

- **Keputusan PO 2026-09-25 (`DEC-1041`)** — customer memilih merchant dulu, baru menu (marketplace multi-merchant).
- `repo-sa7tein-schema.md:15` — referensi bentuk layar: Home customer = "Daftar restoran (jarak + badge buka) → menu" (referensi UI/UX, bukan target implementasi).
- Skema: entri 4 (`merchant`), entri 7 (`menu`), entri 9 (`order.merchant`) — **rancangan data, bukan aturan bisnis**.
- **UNRESOLVED (jangan ditebak):** requirement `R-*` untuk discovery belum ditulis di PRD aktif; format daftar/filter; perilaku merchant tutup/di luar zona.

## Update

```bash
./scripts/flows-gate.sh f23-customer-discovery   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
