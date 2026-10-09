# F6 — Cash-out & Payout

Workflow tiga jalur keluar dana via Xendit payout. Milestone **M3** (fee cash-out UNRESOLVED = blocker); PRD aktif `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f6-cashout-payout.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f6-cashout-payout.html` | Artefak jadi |
| `f6-cashout-payout.visual-check.*` | Bukti visual-check |

## Alur

**Lane Customer:** Minta cash-out (nominal + rekening) → Fee cash-out (placeholder) → Ajukan payout (`POST /v3/payouts`) → Menunggu (webhook `v3_payout.*`) → Dana masuk (saldo berkurang).

**Lane Sumber dana lain:** Merchant (kredit settle → withdraw) dan Kurir (tips saja → withdraw) masuk ke node payout yang sama — satu rail Xendit. **Tips kurir tidak bisa ditarik bebas:** payout Rp2.500/penarikan bisa makan tip kecil, jadi withdraw menunggu akumulasi (ambang minimum) atau digabung pola cash-out. **Fee payout ditanggung kurir sendiri** (keputusan PO 2026-09-22) — dipotong dari nilai withdraw, bukan beban platform.

**Lane UNRESOLVED:** Fee & flow tarik taruh sebagai terminal `feeOpen`.

## Mekanisme

- Semua = Xendit payout: `POST /v3/payouts` + webhook `v3_payout.*`.
- `idempotency-key` + `reference_id` wajib (anti duplikat).
- Xendit hanya 2 titik: top-up masuk (F3) + payout keluar (sini).
- **Tips kurir:** 100% ke kurir, tanpa komisi platform; tidak bisa ditarik per tip kecil — withdraw menunggu akumulasi ambang minimum. Kalau tidak diakumulasi, asumsi biaya platform "payout amortized Rp2.500 ÷ ±20 order/withdraw" (`source.md:621`) jebol dan tip jadi titik boncos baru.
- **Fee payout tips ditanggung kurir** (keputusan PO 2026-09-22): dipotong dari nilai withdraw kurir, **bukan** beban platform. Karena itu ambang akumulasi minimum wajib — menarik tip kecil setelah dipotong fee tidak masuk akal bagi kurir.

## Terhubung (lihat `../INDEX.json`)

Dipicu `f7-ledger-liability` (saldo liability cukup); dana masuk dari `f3-wallet-topup` (customer), `f2-cod-hold:held->settled` (merchant kredit), tips (kurir).

## Sumber (jangan dikarang)

- `R-CASHOUT-01`, `R-WALLET-01` — `analysis.md`
- Milestone M3 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** OQ-22 — fee cash-out customer (blocker M3); OQ-16 — flow cash-out ke rekening
- **UNRESOLVED (tips):** angka ambang minimum withdraw tips (`source.md:83` menyebut contoh akumulasi ≥Rp50.000, belum final)
- **RESOLVED (PO 2026-09-22):** fee payout tips ditanggung **kurir** (dipotong dari nilai withdraw), bukan platform — `source.md:84` diperbarui

## Update

```bash
./scripts/flows-gate.sh f6-cashout-payout   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
