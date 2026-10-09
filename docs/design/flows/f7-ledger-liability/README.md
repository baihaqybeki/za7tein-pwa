# F7 — Ledger & Liability

Dataflow double-entry append-only + cek solvabilitas. Milestone **M9** (M0 BE contract: ledger = backend only); PRD aktif `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f7-ledger-liability.json` | Spec archify (dataflow v1) — sumber yang diedit |
| `f7-ledger-liability.html` | Artefak jadi |
| `f7-ledger-liability.visual-check.*` | Bukti visual-check |

## Alur data

**Peristiwa uang** → **Entri double-entry** (1 peristiwa ≥ 2 baris) → **`wallet_ledgers`** (append-only, kronologis) → **Liability wallet** (saldo user = utang platform) → **Cek Xendit** (saldo ≥ total liability?) → **Flag** kalau kurang.

Masukan: `top_up_completed` (F3), `reserve/settle` (F2), fee (F4). Reversal/batal = **entry baru, bukan edit baris** (dashed).

## Aturan (R-LEDGER-01)

- Double-entry, append-only, kronologis.
- Reversal hanya lewat entry baru.
- Saldo wallet user = **liability** platform, bukan pendapatan.
- Metrik: saldo Xendit ≥ total liability; kurang → flag dashboard Super Admin.

## Terhubung (lihat `../INDEX.json`)

Dipicu `f2-cod-hold:held->settled` + `f3-wallet-topup`; feed `f6-cashout-payout`.

## Sumber (jangan dikarang)

- `R-LEDGER-01` — `analysis.md`
- Milestone M9 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- Ledger = backend only (M0 BE contract) — repo ini mock tampilan saja

## Catatan desain

- `viewBox [1085, 507]` — pola sama F4 (deliver check `availableDiagramWidth 930`).
- Label edge diberi `labelAt` eksplisit supaya tidak menabrak node/rute lain (validator menyarankan koordinat persis).

## Update

```bash
./scripts/flows-gate.sh f7-ledger-liability   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
