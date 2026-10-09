# F10 — Kurs IDR ↔ JOD

Sequence sinkronisasi rate. Milestone **M1** (deps M0); PRD aktif `irbid-mvp-v2-2026-09-21`.

| Berkas | Isi |
|---|---|
| `f10-exchange-rate.json` | Spec archify (sequence v1) — sumber yang diedit |
| `f10-exchange-rate.html` | Artefak jadi |
| `f10-exchange-rate.visual-check.*` | Bukti visual-check |

## Alur

**Scheduler** → `rate_fetch` (1×24 jam) → API kurs → `rate_fetched` → INSERT ke `exchange_rates`. Gagal → `rate_fetch_failed` (dashed) → **fallback: rate terakhir, jangan blokir transaksi**.

**Kalkulasi uang (server)** = semua IDR, baca rate terakhir → **Render UI** konversi IDR→JOD, bulat 2 desimal hanya di layer tampilan.

## Aturan (R-CURR-01, DECIDED)

- Semua settlement = IDR lewat Xendit; **tidak ada uang menyentuh JOD**.
- JOD display-only — harga/ongkir/fee/saldo disimpan IDR (source of truth).
- Jangan simpan nominal JOD sebagai nilai transaksi (sumber drift & bug pembulatan).
- Ledger tetap IDR utuh. Disclaimer wajib: *"kurs estimasi, mengikuti kurs harian"*.
- Wise dibatalkan.

## Terhubung (lihat `../INDEX.json`)

Dipakai `f4-fee-tax` (semua nominal) dan seluruh tampilan saldo (`f3`, `f6`, `f7`).

## Sumber (jangan dikarang)

- `R-CURR-01` — `analysis.md` (DECIDED) · Milestone M1 — `versions/irbid-mvp-v2-2026-09-21/milestones.md`
- **UNRESOLVED (jangan ditebak):** OQ-26 — provider IDR>JOD (bukan ECB-only); OQ-28 — umur maksimal fallback rate

## Kartu konversi Home customer (client daily cache) — UNRESOLVED

Sejak 2026-10-09, Home customer (`/customer/home`) memuat kartu **CurrencyConverter**
(`src/components/ui/CurrencyConverter.tsx`) dua arah (IDR↔JOD) dengan tombol tukar.
Rate diambil dari hook `useDailyExchangeRate` (`src/hooks/useDailyExchangeRate.ts`):
satu "hit" per hari kalender, di-cache di `localStorage` (`sa7tein:exchange-rate`);
hari berikutnya hit lagi.

**Divergensi yang harus dicatat:** flow ini menaruh sinkron rate di **backend 1×24 jam**
(`rate_fetch` → `exchange_rates`); hit sisi client ini adalah kompromi showcase karena
repo tanpa backend (AGENTS §1). Saat backend ada, hook ini diganti pembacaan
`exchange_rates` dan `fetchDailyRate()` mock dibuang.

- **UNRESOLVED:** kebijakan cache client (per-device vs server), penandaan umur rate
  (OQ-28), dan apakah kartu konversi tetap ada saat rate nyata tersedia.

## Catatan desain

- `column_fit: "spread"` — label participant ("exchange_rates", "Kalkulasi uang") lewat 86px box fixed.
- `viewBox [1080, 480]` — sequence min 480; timeline y maks = H − 83 (413); deliver check `availableDiagramWidth 930` → teks ≥6px.
- Message dikompres 6 → 4 (rate_fetch_failed & response digabung jadi `note`); detail OQ-26/OQ-28 tetap di sublabel + note (UNRESOLVED tetap ditandai eksplisit).

## Update

```bash
./scripts/flows-gate.sh f10-exchange-rate   # deliver + visual-check + buang PNG, satu baris output
```

Wajib: validate **9/9, 0 error, 0 warning**; deliver exit 0; visual-check pass 4 viewport (light + dark).
