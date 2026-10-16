# Milestones: sa7tein-mvp-2026-10-11

Status: PROPOSED — jangan dijadwalkan sebelum keputusan aktivasi tertulis dan OPEN kritis dikunci.
Rencana ini disusun dari requirement bersumber (`analysis.md`) + dependensi, bukan daftar layar.
Gate keras: **OPEN-01 (DANA)**, **OPEN-24/25/26** (ops path, Global Index, enum status), dan keputusan
platform backend (Cloudflare Workers/DO vs tetap Supabase).

| ID | Requirement IDs | Dependencies | Owner | Acceptance criteria | Mock state | BE contract | Status |
|---|---|---|---|---|---|---|---|
| D0 | keputusan produk | — | PO | Keputusan tertulis: aktifkan/supersede irbid; setujui platform Cloudflare; tunjuk pemutus OPEN | — | — | blocking |
| D1 | — | D0 | PO + legal | OPEN-01 (DANA) dijawab; OPEN-02 kurs; OPEN-27 legal dipetakan | — | — | blocked-by-D0 |
| M0 Fondasi Worker | ARC-01/02/03, NFR-04 | D0 | BE | Satu Worker middleware; 1 DO berjalan; UTC→Asia/Amman | — | kontrak Worker v1 | blocked-by-analysis |
| M1 Akun | ACC-01..05 | M0, OPEN-01 | BE+FE | Magic link semua role; 1 email 1 role; bind akun DANA merchant/kurir | Sign-in mock→nyata | Auth + DANA bind | blocked |
| M2 Katalog & discovery | CUS-04..13, MER-01..08 | M1, OPEN-25 | BE+FE | Browse/search/sort/filter lintas instance; detail merchant & menu | Katalog mock→DB | Search/Global Index | blocked (OPEN-25) |
| M3 Cart & checkout | CUS-14..20, 31, 32 | M2 | BE+FE | Cart per merchant; Regular/Quick; QRIS/DANA; QR 30 menit | Cart mock→DB | Order + payment intent | blocked (OPEN-01) |
| M4 Uang & kurs | §16, NFR-01/02/03 | M3, OPEN-02/03/04/05 | BE | JOD↔IDR, pembulatan, Ft 1,5%, ledger idempotent, settlement/payout | Kalkulasi mock | Ledger + payout | blocked |
| M5 Regular + batch + auto-sort | CUS-18, MER-11/13/14, COU-11..14, §9.6 | M3, ARC-12 | BE+FE | Batch ≤24; auto-sort Google Routes (mulai merchant→order terakhir); toggle | Batch mock (F12) | Batch + Routes | blocked (biaya R4) |
| M6 Quick + dispatch partner | CUS-18, MER-12, COU-15/18, §9.3/9.4/9.5 | M3, OPEN-11/12/13/14 | BE+FE | Dispatch, reserve sejak assignment, approve/reject, SP tidak-respons | Dispatch mock | Dispatch + SP | blocked |
| M7 Monetisasi | MER-17..19, §17, OPEN-29 | M4 | BE+FE | Langganan kuota order & COD; setting "tanpa kuota"; prioritas & reserve kuota | Kuota statis | Ledger langganan | blocked |
| M8 Marketing | MER-09, CUS-17, §15, OPEN-23 | M3 | BE+FE | Program merchant/aplikator, Dm/Da, `isStackable` | Promo mock | Rule engine diskon | blocked |
| M9 COD | §16.5, MER-19, OPEN-06 | M7 | BE+FE | COD hanya dengan kuota COD; Regular & Quick; talangan kurir partner | COD mock | COD ledger | blocked |
| M10 Dispute/SP | MER-22, COU-08/17, OPS-06/07/10, §18, OPEN-17/18/19 | M5/M6 | BE+FE | Rule ops, multi-select merchant, snapshot order, eksekusi + SP | Dispute mock (f8) | Rule + ledger | blocked |
| M11 Chat & rating | CUS-26..28, COU-07, MER-21, §20 | M3, OPEN-20 | BE+FE | Group chat order (R2), auto-close; rating merchant/menu | Chat mock | R2 + WS | blocked |
| M12 Realtime & notifikasi | §19, §20.3, NFR-05/06 | M0 | BE+FE | Matriks audiens WS + web push; versi kontrak; resync | Notif mock | WS fan-out | blocked |
| M13 Ops console | OPS-01..15, ARC-10, NFR-07, OPEN-24 | M0/M2/M7/M10 | FE+BE | Verifikasi, moderasi tag, set semua parameter, analitik; di balik Access | Admin mock | Internal app | blocked (OPEN-24) |
| M14 PWA/native | ARC-11, L1/L2 | M3 | FE | React PWA zero-route; native pasca-MVP; kontrak identik | — | — | blocked |

## Catatan rencana
- Urutan M0→M4 adalah tulang punggung; M5/M6/M7/M8/M9 bisa paralel setelah M4 tapi semuanya bergantung DANA.
- Rencana ini memakai ulang komponen UI/design system yang ada (AGENTS §12); yang diganti adalah kontrak backend.
- Aktivasi mengubah `activeRevision`; wajib re-bind flow di `docs/design/flows/INDEX.json` pada commit yang sama.
