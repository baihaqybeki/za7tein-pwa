# F2 — Wallet Reserve Lifecycle (Prepaid & COD)

State machine saldo yang di-**reserve** untuk order via wallet — prepaid dan COD memakai mekanisme yang sama.
Milestone **M4** (PRD aktif `irbid-mvp-v2-2026-09-21`).

**Revisi PO 2026-09-25:** saldo **tidak** berkurang saat order dibuat — saldo hanya di-reserve; saldo berkurang saat order **done**. Tahap `cut` saat kurir match **dihapus**.

| Berkas | Isi |
|---|---|
| `f2-cod-hold.json` | Spec archify (lifecycle v1) — sumber yang diedit |
| `f2-cod-hold.html` | Artefak jadi |
| `f2-cod-hold.visual-check.*` | Bukti visual-check |

## State & Transisi

**Jalur utama:**
Tanpa reserve → **Reserved** (order dibuat, saldo ditahan) → **Settled** (order done → saldo berkurang).

**Jalur pembatalan (exception):**
- **Reserved → Released** — batal sebelum order done = reserve dilepas, saldo tidak berkurang.

Refund/dispute **setelah** order done bukan state hold — itu reversal ledger (`f7-ledger-liability` / `f8-dispute`). Karena itu state `cut` dan `reversed` dihapus.

Tiap transisi = 1 entry ledger double-entry append-only (R-COD-01).

## Catatan desain

- Lifecycle diagram memakai schema v1 (`meta.viewBox [1000, 640]`) supaya muat di 1440×900 tanpa scroll.
- Tiga lane: Lifecycle reserve + Pembatalan + `terminal` (Hasil akhir — id lane **wajib `terminal`**, kolom 0..2, menaruh `settled` di band 03; tanpa lane ini renderer menampilkan band "03 / Outcomes" **kosong** = diagram terlihat putus).
- Route reserve → settled lintas band: `route drop` + `channelY` (koridor y=200); cancel horizontal di y=110 biar tak nabrak.
- State `settled` memakai sublabel ringkas supaya teks tetap ≥ 6px di viewport 1440px.

## Terhubung (lihat `../INDEX.json`)

Drill-down dari F1: `f1:order → f2:none→held` (`reserve_created`), `f1:otp → f2:held→settled` (`reserve_settled`), `f1:batal → f2:released` (`reserve_released`). Feed ke `f7-ledger-liability`; diinterupsi `f8-dispute`. Kurir match (`f12:assign`) **tidak lagi** memotong saldo.

## Sumber (jangan dikarang)

- `R-COD-01` — `analysis.md` (**direvisi** PO 2026-09-25)
- Milestone M4 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- Fee 0,37 JOD berlaku semua metode, termasuk legacy (OQ-25, PO 2026-09-22)
- **PO 2026-09-25:** reserve saat order → saldo berkurang saat done; `cut` saat kurir match dihapus, menggantikan Update PO #5 (`source.md:47`)

## Update

```bash
./scripts/flows-gate.sh f2-cod-hold   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
