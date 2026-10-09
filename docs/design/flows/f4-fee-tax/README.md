# F4 — Fee & Pajak Checkout

Dataflow fee flat 0,37 JOD + pajak 2 lapis. Milestone **M2** (fee) & **M7** (pajak); PRD aktif `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f4-fee-tax.json` | Spec archify (dataflow v1) — sumber yang diedit |
| `f4-fee-tax.html` | Artefak jadi |
| `f4-fee-tax.visual-check.*` | Bukti visual-check |

## Alur data

**Input:** Subtotal & ongkir (ongkir 100% merchant, bukan pendapatan platform) + **Tip kurir (opsional & sukarela)** — dipilih saat checkout **atau setelah terima** (dua titik masuk; yang "setelah terima" = prompt pasca-order `f19-rating-review`, keputusan PO 2026-09-22), 100% ke kurir via internal ledger, **tanpa edge ke platform** (tip bukan pendapatan platform — R-WALLET-01). Tip diambil dari saldo wallet customer; batal order tidak menghapus tip yang sudah terkirim — UNRESOLVED.

**Komponen tagihan:** Fee customer **0,22 JOD** (per order, semua metode) + tip (opsional) → masuk Total customer (subtotal + ongkir + fee, ditampilkan di checkout).

**Fee platform:** Fee merchant **0,15 JOD** (saat settle — lihat F2) + fee customer → **Platform 0,37 JOD**.

**Pajak 2 lapis:**
- GST makanan 16% — merchant setor atas penjualan (edge GST digambar via channel atas karena melintasi 3 stage).
- GST/PPh atas fee platform (objek = 0,37) + PPh final 0,5%.

**Berlaku semua metode**, termasuk transfer manual & COD cash (OQ-25, PO 2026-09-22).

## Terhubung (lihat `../INDEX.json`)

Drill-down dari `f1:checkout`; feed `f2-cod-hold` (fee merchant dipotong saat settle), `f3-wallet-topup` (fee customer saat order done), `f9-incentive` (fee 0,15 ditahan dari kredit merchant).

## Sumber (jangan dikarang)

- `R-FEE-01`, `R-TAX-01`, `R-WALLET-01` — `analysis.md`
- Milestone M2, M7 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** OQ-2/3/4 — tarif GST makanan spesifik, PPN ekspor jasa, status PKP; OQ-17/18 (R-TAX-01)

## Catatan desain

- Input `metode` dihapus dari node → info "berlaku semua metode" cukup di sublabel + kartu; edge `metode→…` menyilang 2 stage.
- Node `tip` di stage 0 **row 2** (row 1 beda tinggi 7px antar stage → micro-segment kalau dipaksa); edge masuk `totalCustomer` dari bawah: `fromSide top → via [[100,328],[315,328]] → toSide bottom`, label di `[207,328]` (bebas dari route `hitung`).
- `viewBox [1085, 507]`: deliver check memakai `availableDiagramWidth 930` → W ≤ 1085 (teks ≥6px); H 507 agar containment 1440×900 pass.

## Update

```bash
./scripts/flows-gate.sh f4-fee-tax   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
