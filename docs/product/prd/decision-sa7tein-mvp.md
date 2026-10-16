# Keputusan sumber produk: sa7tein MVP (2026-10-11)

- ID: `sa7tein-mvp-2026-10-11`
- Sumber: `versions/sa7tein-mvp-2026-10-11/source.pdf` (47 halaman, bertanggal 11 Oktober 2026).
- Analisis: `versions/sa7tein-mvp-2026-10-11/analysis.md` (REVIEWED). Milestone: `versions/sa7tein-mvp-2026-10-11/milestones.md` (D0–M14, proposed).
- Menggantikan: `irbid-mvp-v2-2026-09-21` (kini `superseded`), yang sebelumnya menggantikan `irbid-mvp-2026-09-12` dan `radius-mvp-legacy`.
- Alasan: dokumen ini memuat keputusan produk terbaru yang **mengganti model inti** — dari radius/geofence
  (Indonesia, IDR, zona A/B/C) ke **marketplace** di Yordania (harga JOD, transaksi in-app IDR): discovery
  multi-merchant, **Regular (kurir inhouse, batch ≤24, auto-sort Google Routes)** + **Quick (kurir partner,
  1 order)**; pembayaran **DANA/QRIS** dengan dana ditahan di akun enterprise lalu payout otomatis; **COD
  hanya dengan kuota order COD**; **langganan kuota order & kuota order COD**; platform fee customer &
  merchant flat per order; transaction fee QRIS 1,5%; kurs JOD→IDR harian; refund via DANA atau BI-FAST;
  **program marketing ala Odoo** (`isStackable`); rule dispute/kompensasi/punishment oleh ops + **SP kurir
  partner**; group chat per order (gambar di R2); rating bintang 1–5 merchant + menu; auth **email magic
  link**; arsitektur **Cloudflare Workers + Durable Objects** (ARC-01..13).

## Keputusan aktivasi — 2026-10-16 (keputusan PO)

- **Diaktifkan sebagai `activeRevision`.** `irbid-mvp-v2-2026-09-21` → `superseded`.
- **Deviasi platform yang disetujui:** backend **tetap Supabase** (Postgres/PostgREST/Edge Functions),
  **bukan** Cloudflare Workers + Durable Objects (ARC-01..13). Konsekuensi:
  - ARC-01..13, R3, dan OPEN-25 (Global Index DO) **tidak diberlakukan** pada repo ini; skema dan query
    lintas entitas memakai Postgres/RLS. Tandai `UNRESOLVED` pada tiap tempat ARC disebut.
  - ARC-11 (PWA zero-route berarsitektur SSR) tetap sebagai arah frontend; native pasca-MVP di luar scope.
- **Alasan deviasi:** repo ini front-end showcase + Supabase (AGENTS.md §1 dan §2); menulis ulang ke
  Cloudflare/DO adalah proyek terpisah dan menambah dependensi tanpa manfaat demo. Model produk, uang, dan
  aturan bisnis PRD tetap dipetakan ke atas Supabase.
- **Blocker yang tetap berlaku (jangan ditebak):** OPEN-01 (kapabilitas DANA) paling kritis; OPEN-02 kurs;
  OPEN-24/25/26; OPEN-27 legal; OPEN-08/10/17/18/19/20/23/29/30 terbuka. Lihat `analysis.md`.
- **Status kode:** **belum dimigrasikan.** Skema/seed/OpenAPI sekarang masih mencerminkan Irbid/legacy
  (COD umum, transfer manual, zona). Migrasi mengikuti milestone `M0–M14` pada `milestones.md`.
- **Governance:** aktivasi ini men-supersede Irbid; flow di `docs/design/flows/` masih menggambarkan aturan
  lama dan ditandai untuk migrasi bertahap (INDEX.json/PLAN.md sudah di-bind ke revisi aktif baru).

Jika pemilik produk menyatakan dokumen lain lebih otoritatif, ubah manifest dan catat keputusan pengganti.
Jangan menimpa dokumen keputusan ini tanpa jejak.
