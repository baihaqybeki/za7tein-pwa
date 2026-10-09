# F24 — Pembayaran Order (COD & Prepaid)

Flow langkah **pembayaran setelah order dibuat**, dirinci per metode. Turunan dari model reserve (`f2`) + revisi PO 2026-09-25.

| Berkas | Isi |
|---|---|
| `f24-payment-methods.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f24-payment-methods.sequence.json` | **Sequence orkestrasi pembayaran** (prepaid otomatis / COD prompt bayar → settle), scoped ke F24 |
| `f24-payment-methods.html` | Artefak jadi |
| `f24-payment-methods.visual-check.*` | Bukti visual-check |

## Alur

Order dibuat (saldo di-**reserve**) → **pilih metode**:

- **Prepaid:** tanpa prompt — reserve dicairkan otomatis saat order **done** (saldo berkurang).
- **COD:** kurir **tiba** → **customer diminta membayar tagihan** (prompt di pintu) → konfirmasi → **settle** (reserve dicairkan, saldo berkurang) → order done.

Guard: **tidak bayar** → timer auto-settle / dispute (`f8`).

## Aturan keras

- Saldo **tidak** berkurang saat order dibuat — hanya di-reserve; berkurang saat order **done** (PO 2026-09-25).
- COD adalah **prompt bayar saat serah terima**, bukan potong di titik kurir match. Setelah bayar → settle.
- Prepaid tidak punya prompt: reserve langsung dicairkan saat done.
- Node `tiba` (kurir) adalah input hulu (root), bukan terminal.
- **UNRESOLVED (jangan ditebak):** durasi timer auto-settle saat customer tidak bayar · penalti customer lalai (OQ-14).

## Terhubung (lihat `../INDEX.json`)

Drill-down dari `f1-order-lifecycle` (`payMethod`/`order` → `f24:order`). Membaca reserve dari `f2-cod-hold`; top-up `f3-wallet-topup`; fee `f4-fee-tax`; gagal bayar → `f8-dispute`.

## Sumber (jangan dikarang)

- **PO 2026-09-25** — reserve saat order, saldo berkurang saat order done; COD: customer diminta bayar tagihan saat terima lalu settle.
- `R-COD-01` — `analysis.md`; `R-FEE-01`; `R-TOPUP-01`
- Milestone M4 — `milestones.md`

## Update

```bash
./scripts/flows-gate.sh f24-payment-methods   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
