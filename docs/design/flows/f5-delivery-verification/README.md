# F5 — Verifikasi Pengiriman (Checkpoint + OTP + SLA)

Lifecycle checkpoint kurir + OTP + timer. Milestone **M5** (PRD aktif `irbid-mvp-v2-2026-09-21`).

| Berkas | Isi |
|---|---|
| `f5-delivery-verification.json` | Spec archify (lifecycle v1) — sumber yang diedit |
| `f5-delivery-verification.html` | Artefak jadi |
| `f5-delivery-verification.visual-check.*` | Bukti visual-check |

## State & Transisi

**Checkpoint utama:** Ambil (merchant konfirmasi) → **Berangkat** (timer 15m) → **Tiba** (geolocation + foto, timer 30m) → **OTP 4 digit** (timer 10m) → **Settled**.

**Timeout:** OTP tidak dimasukkan dalam 10m → *Customer lalai* → **auto-settle** tetap jalan (order tidak boleh menggantung `pending` selamanya — neg. scenario #7: saldo beku). Komplain customer setelah settle → **dispute 24 jam (rujuk F8)** — ditandai di kartu.

**Lane (3 band):** `main` (Checkpoint utama) · `timeout` (Timeout & Auto-settle) · `terminal` (Hasil akhir — id wajib `terminal`, kolom 0..2, menaruh `settled` di band 03; tanpa lane ini renderer menampilkan band "03 / Outcomes" **kosong** = diagram terlihat putus).

Timer 15/30/10 = keputusan sementara PO 2026-09-22 (OQ-13).

## Terhubung (lihat `../INDEX.json`)

Drill-down dari `f1:dapur | f1:tiba | f1:otp`; settled-nya → `f2-cod-hold:held->settled`.

## Sumber (jangan dikarang)

- `R-DELIV-01` — `analysis.md`
- Milestone M5 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** OQ-14 — % penalti customer lalai

## Catatan desain

- `viewBox [1080, 640]` → teks proyeksi minimum 6.03px di 1440×900 (ambang batas 6px).
- Band `event` (lane selain `main`/`terminal`) **dan** band `outcome` (`terminal`) hanya boleh kolom 0..2 — batas schema lifecycle. Route otp/noOtp → settled lintas band: pakai `route drop` + `channelY`, labelAt wajib di zona bebas (validator kasih koordinat saran).

## Update

```bash
./scripts/flows-gate.sh f5-delivery-verification   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
