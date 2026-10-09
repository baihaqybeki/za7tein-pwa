# F9 — Insentif Merchant (Modal 5 JOD + Cashback Tier)

Workflow insentif merchant baru. Milestone **M10** (deps M0, M3, M9); PRD aktif `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f9-incentive.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f9-incentive.html` | Artefak jadi |
| `f9-incentive.visual-check.*` | Bukti visual-check |

## Alur

**Lane Modal:** Kredit 5 JOD (non-withdrawal, otomatis saat daftar) → Fee 0,15 dipotong dari credit (≈33 order pertama) → Credit habis, fee normal kembali.

**Lane Cashback:** Volume settled (order/bulan) → Cek tier (500 / 1.000 / 1.250) → Cashback bulanan (15/40/62,5 JOD, arus kas keluar platform) → Dompet deposit merchant.

**Lane UNRESOLVED:** guard dari Cek tier — periode & kuota (I-4/I-5).

## Angka

| Tier | Volume/bulan | Cashback | Fee efektif |
|---|---|---|---|
| 1 | 500 order | 15 JOD | 0,12/porsi |
| 2 | 1.000 | 40 JOD | 0,11/porsi |
| 3 | 1.250+ | 62,5 JOD | 0,10/porsi |

Modal 5 JOD = kredit sistem non-tunai, **terpisah** dari deposit COD 3,50 JOD (I-2 RESOLVED, PO 2026-09-22). Akun ledger `merchant_credit`, bukan saldo withdrawable.

## Terhubung (lihat `../INDEX.json`)

Volume dari `f2-cod-hold:held->settled`; fee 0,15 ditahan mengikuti `f4-fee-tax`; kredit tercatat di `f7-ledger-liability`.

## Sumber (jangan dikarang)

- `R-INCENTIVE-01` — `analysis.md` · Milestone M10 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** I-3 cashback withdrawable? · I-4 periode tier & naik di tengah bulan · I-5 kuota Founding · I-6 sisa modal saat merchant berhenti

## Update

```bash
./scripts/flows-gate.sh f9-incentive   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
