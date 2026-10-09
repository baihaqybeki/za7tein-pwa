# F1 — Order End-to-End

Flow payung satu pesanan: Customer → Merchant & Kurir → selesai.
Milestone **M2–M5** (PRD aktif `irbid-mvp-v2-2026-09-21`).

| Berkas | Isi |
|---|---|
| `f1-order-lifecycle.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f1-order-lifecycle.sequence.json` | **Sequence orkestrasi sistem** (intake → reserve → batch → assign kurir), scoped ke F1; delivery→settle ada di `f13` sequence |
| `f1-order-lifecycle.html` | Artefak jadi |
| `f1-order-lifecycle.visual-check.*` | Bukti visual-check |

## Alur

Pilih menu → Checkout (ongkir + fee 0,22 JOD) → **Keputusan metode bayar** (prepaid / COD / transfer):

- **Prepaid & COD (via wallet):** saldo di-**reserve** saat order dibuat (belum berkurang) → gate saldo minimum 3,5 JOD untuk akun baru → saldo berkurang saat order **done** (settle). Tidak ada potong saat kurir match — revisi PO 2026-09-25.
- **Transfer manual:** fee flat 0,37 JOD tetap berlaku (semua metode, PO 2026-09-22).
- **Tip kurir:** opsional & sukarela, 100% ke kurir, tanpa komisi platform — dipilih saat checkout **atau setelah terima** → dipotong dari wallet customer → kredit wallet kurir via internal ledger (R-WALLET-01). Titik masuk "setelah terima" = **prompt pasca-order `f19-rating-review`** (nilai + tip dalam satu layar, keputusan PO 2026-09-22); layar tip terpisah tidak dibuat. Withdraw tips ada di `f6-cashout-payout`.

Setelah order dibuat → **Dapur** (batch prepare → assign kurir, C-06) → Berangkat / Tiba (timer 15m/30m, geo + foto) → OTP 4 digit → settle (saldo berkurang). Detail batch di `f12`.

Lane **Guard** (exception):
- **Di luar zona** → checkout diblokir sebelum payment.
- **Saldo kurang** → gate top-up kalau prepaid dan akun baru < 3,5 JOD.
- **Batal sebelum order done** → reserve dilepas (`released`); saldo tidak berkurang. Refund/dispute setelah `done` = ledger (`f7`/`f8`), bukan reversal hold.

## Catatan desain

- Kurir digabung ke lane **Merchant & Kurir** karena PRD v2: kurir = pegawai merchant.
- Langkah merchant (Ambil / Masak / Kurir Match) dikompres jadi satu node **"Dapur"** supaya muat di 6 kolom tanpa kehilangan inti cerita.
- Keputusan metode bayar pakai node tipe `security` → ada dua edge ke node yang sama (prepaid vs COD), bukan dua jalur paralel — menjaga diagram tetap satu jalur utama (`mainPath`) dengan edge `role: branch`.
- Top-up gate jadi node terpisah di lane exception, terhubung dari node keputusan, supaya kejelas bahwa gate hanya berlaku untuk jalur prepaid akun baru.

## Terhubung (lihat `../INDEX.json`)

F1 = flow **payung**. Drill-down: `order → f2-cod-hold` (reserve lifecycle), `payMethod → f24-payment-methods` (langkah bayar COD/prepaid), `topUpGate → f3-wallet-topup`, `checkout → f4-fee-tax`, `dapur|tiba|otp → f5-delivery-verification`.

## Sumber (jangan dikarang)

- `R-COD-01`, `R-DELIV-01`, `R-TOPUP-01`, `R-FEE-01`, `R-WALLET-01` — `analysis.md`
- Milestone M2, M4, M5 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- SLA 15/30/10 = keputusan sementara PO 2026-09-22 (OQ-13)
- Fee flat 0,37 JOD berlaku semua metode, termasuk legacy (OQ-25, PO 2026-09-22)
- **Revisi PO 2026-09-25:** model uang disatukan — saldo di-**reserve** saat order, berkurang saat order **done** (prepaid & COD); `cut` saat kurir match dihapus. Menggantikan Update PO #5 (`source.md:47`, COD potong saat match).
- UNRESOLVED yang menyentuh flow ini (jangan diisi tebakan): % penalti customer lalai (OQ-14), fee cash-out (OQ-22)

## Update

```bash
./scripts/flows-gate.sh f1-order-lifecycle   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
