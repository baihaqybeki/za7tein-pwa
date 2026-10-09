# F12 — Merchant Console (sisi dapur)

Workflow sisi merchant: toggle toko, antrean order, terima/tolak, kurir sendiri. **Belum di-develop sebagai flow backend** — sumber gambaran: `docs/plan-merchant.md` (FE showcase M0–M7) + PRD `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f12-merchant-console.json` | Spec archify (workflow v2) — sumber yang diedit |
| `f12-merchant-console.sequence.json` | **Sequence mekanik batch** (existing/new batch → prepare timer → close → empty batch → assign → notify), scoped ke F12 |
| `f12-merchant-console.html` | Artefak jadi |
| `f12-merchant-console.visual-check.*` | Bukti visual-check |

## Alur

**Lane Toko & Batch order:** Buka/Tutup (`isActive`) → Antrean order (kode · total · zona ≤2 km) → Terima/Tolak (tolak → `canceled`, f18) → **Window prepare (batch)** (`etaPrepare` / `slaPrepareDeadline`) → **Close batch** (`batch.status = closed`).

**Lane Kurir milik merchant:** Kelola kurir (maks 3 · mock) → **Assign kurir sendiri** **setelah** batch ready (`waitingCourier` → `waitingDelivery`, C-06).

**Lane Guard:** Batch tanpa kurir → `escalatedToAdmin` / reassign sendiri / batal → refund.

## Aturan keras (jangan dilupakan)

- **Batch = unit prepare** (schema entri 11): `prepare → closed → waitingCourier → waitingDelivery → delivery`. Order dikumpulkan selama window prepare sampai `slaPrepareDeadline`/`etaPrepare` habis, lalu batch ditutup.
- **Platform TIDAK assign kurir** (C-06) — courier = karyawan merchant, digaji merchant, ongkir 100% merchant (C-07). Assign terjadi **setelah** batch ready (selaras `f18`: `merchant_ready` → `waitingCourier` → `courier_matched`). Maks `MAX_COURIERS_PER_MERCHANT` (3).
- Detail order reuse `JourneyLine` (`OrderStageScreen`) — jangan gambar ulang.
- Kuota `7 / 10` = state tampilan, bukan counter.
- **UNRESOLVED:** batch & `autoResequence` **tidak ada di PRD aktif** — hanya di `schema-draft-v1.md` entri 11 (rancangan data). Status `proposed`; jangan dianggap requirement.

## Terhubung (lihat `../INDEX.json`)

`f1:dapur → f12` (drill-down antrean); `f12:assign → f13` (tugas kurir; tak lagi `hold_cut` — PO 2026-09-25); `f12 → f13` (tugas kurir); macet → `f8` (dispute) / refund.

## Sumber (jangan dikarang)

- `docs/plan-merchant.md` M0–M7 (FE showcase, `merchantSlice`: `isActive`, `todayOrderCount`, `queue[]`)
- `C-06`, `C-07`, `C-17` — `analysis.md` · `R-COD-01` events `reserve_*` · `schema-draft-v1.md` entri 11 (`batch`: `status`, `etaPrepare`, `etaDelivery`, `slaPrepareDeadline`, `escalatedToAdmin`) · Milestone M4/M5/M11 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** batch/`autoResequence`/route optimization **tidak ada di PRD aktif** (hanya schema draft → `proposed`) · OQ-30 — merchant sbg pihak bersengketa · nav merchant (bottom/top) belum diputuskan

## Update

```bash
./scripts/flows-gate.sh f12-merchant-console   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
