# Pemetaan PRD aktif → Backend Supabase

Revisi aktif: `sa7tein-mvp-2026-10-11` (`docs/product/prd/decision-sa7tein-mvp.md`).
Keputusan platform (2026-10-16, PO): backend **tetap Supabase** — deviasi dari ARC-01..13
(Cloudflare Workers + Durable Objects) ditandai `UNRESOLVED` di sini. Ini **rencana migrasi**
(`milestones.md` M0–M14); skema/seed/OpenAPI saat ini masih Irbid/legacy dan **belum** dipetakan.

Blocker keras sebelum implementasi uang: **OPEN-01 (DANA)**, OPEN-02 (kurs), OPEN-26 (enum status),
OPEN-27 (legal). Jangan tebak.

## Deviasi arsitektur (disetujui, ditandai UNRESOLVED)
| PRD | ARC | Supabase padanan | Status |
|---|---|---|---|
| ARC-01..03 core engine DO(SQLite) | seluruh data di DO | Postgres + PostgREST + Supabase Realtime | UNRESOLVED-deviasi |
| ARC-04/05 1 DO=1 row + Global Index | — | tabel relasional + index GIN (browse/search) | UNRESOLVED (OPEN-25 tidak berlaku) |
| ARC-06/07/08 Workflow+Queue+RPC+WS | — | Postgres function/trigger + Supabase Realtime (broadcast) | UNRESOLVED-deviasi |
| ARC-09 R2 | — | Supabase Storage (bucket) | UNRESOLVED-deviasi |
| ARC-10 Cloudflare Access | ops | RLS + peran ops + audit | UNRESOLVED-deviasi |
| ARC-11 PWA zero-route SSR-arst | — | tetap arah frontend; native pasca-MVP out-of-scope | sebagian |
| ARC-12/13 eksternal async | — | Edge Function (provider kurs, DANA webhook) | UNRESOLVED (OPEN-01) |

## Pemetaan per domain
### Kurs & mata uang (§16, NFR-03)
- **Baru** `exchange_rates(base char(3)='JOD', quote='IDR', rate numeric(18,6), effective_on date, source text, created_at)` — 1 baris/hari; unik (base,quote,effective_on).
- Konvensi: JOD `numeric(12,3)` (3 desimal); IDR `bigint` (rupiah bulat). Tagihan dibulatkan ke atas ke ratusan; payout ke bawah ke rupiah penuh.
- `orders`: `total_jod`, `total_idr`, `rate_locked`, `rounding_up_idr`, `transaction_fee_jod` (1,5% QRIS saja).
- OPEN-02: provider + jam update + fallback → belum.

### Metode bayar & uang (§16)
- `payment_methods` enum → **`qris` | `dana_balance` | `cod`** (ganti `wallet`/`cod`/`dana_va`/`qris` legacy). `cod` hanya bila kuota COD tersedia (MER-19).
- **Baru** `enterprise_ledger` (append-only, NFR-02) + idempotency key per langkah uang (NFR-01).
- **Baru** `refunds`: jalur `dana` atau `bank_bifast` (pending refund, customer isi bank+rekening).
- Payout otomatis saat order selesai: merchant (S−Dm−[Pm]) + kurir (F penuh) + aplikator. Rumus §16.3/16.4.
- OPEN-01/08 terbuka (kapabilitas DANA, penarikan pasca-payout).

### Order, Regular/Quick, batch (§7, §9)
- `orders`: `type` enum `regular|quick`; `status` (OPEN-26).
- **Baru** `batches` (merchant_id, courier_inhouse_id, status, route jsonb, started_at) + `batch_orders` (order_id, seq) — **maks 24** (constraint).
- **Baru** `coverage_zones` (merchant_id, polygon/radius, mode, fee_jod) — ganti zona A/B/C (MER-04, §9.1).
- **Baru** `dispatch_assignments` (order_id, courier_partner_id, status approve/reject, reason, reserved_at) — Quick (§9.3–9.5, COU-18).
- Auto-sort Google Routes (WALK, mulai merchant→order terakhir) → Edge Function; biaya R4 (OPEN-16 sudah diputuskan).

### Role & auth (ACC)
- Auth → **email magic link** (ACC-01) semua role; 1 email 1 role (ACC-02). Akun kurir inhouse dibuat merchant (ACC-03); verifikasi merchant/kurir partner oleh ops (ACC-04); merchant & kurir wajib bind akun DANA (ACC-05, OPEN-01).
- `profiles.role` enum: `customer|merchant|courier_inhouse|courier_partner|ops` (tambah 2 tipe kurir; `admin`=ops).

### Monetisasi (§17, MER-17..19)
- **Baru** `quota_packages` (kind enum `order|order_cod`, quota, period, price_jod) — di-setup ops (OPS-09).
- **Baru** `quota_subscriptions` (merchant_id, kind, quota_total, quota_used, quota_reserved, period_start/end).
- `merchants.accept_without_quota` (boolean, hanya bisa diubah saat tutup). Prioritas: kuota order → kuota COD → tanpa kuota bila setting ya. Reserve saat order, konsumsi saat selesai, kembali saat batal/tolak/gagal.
- OPEN-29 (paket tambahan jenis sama) terbuka.

### Marketing (§15, MER-09, CUS-17)
- **Baru** `marketing_programs` (owner `merchant|applicator`, tipe, scope, `is_stackable`, aktif) + `marketing_rules` + `marketing_rewards` (ala Odoo loyalty). Dm/Da dihitung di checkout. OPEN-23 terbuka.

### Dispute/kompensasi/punishment (§18, MER-22, OPS-06/07/10)
- **Baru** `dispute_rules` (kode, kategori, kondisi, pihak, mitigasi, kompensasi, punishment, versi, aktif) + `merchant_rules` (multi-select) + `incidents` (order, pelapor, kategori, bukti di Storage, rule diterapkan, keputusan) + `punishments` (termasuk **SP kurir partner**). Snapshot rule ke order saat dibuat. OPEN-17/18/19 terbuka.

### Chat, rating, notifikasi (§19, §20)
- `chat_*` sekarang mock → tabel `order_chats`/`chat_messages` (gambar di Storage; auto-close). COU join sesuai jalur. OPEN-20 terbuka.
- Rating: merchant 1–5 + review; rating menu tanpa review; tanpa moderasi (OPEN-21 sudah diputuskan).
- Realtime: matriks audiens §19 → Supabase Realtime channel + web push (sudah ada `send-push`). NFR-05 resync, NFR-06 versi kontrak.

### Ops console (OPS-01..15, §21 ARC-10)
- Verifikasi, moderasi tag, set multiplier Quick/threshold/param dispatch/platform fee flat/paket kuota, kelola rule, SP, analitik, monitoor payout/kurs. Di Supabase: RLS ops + audit trail (NFR-07). OPEN-24 terbuka.

## Urutan implementasi yang disarankan
1. **M0** fondasi: `exchange_rates`, enum metode bayar, tipe kurir, audit ops.
2. **M1** auth magic link + bind DANA (gated OPEN-01).
3. **M2/M3** katalog/discovery + cart/checkout (Regular/Quick) — perbarui OpenAPI + FE `src/api/*`.
4. **M4** ledger + settlement/payout + idempotency.
5. **M5–M13** batch/auto-sort, dispatch Quick, kuota, marketing, COD, dispute/SP, chat/rating, realtime, ops.
6. Perbarui `docs/backend/openapi.yaml` + `src/api/*` + seed + `/documentation` di commit yang sama per slice.

## Yang tidak boleh dilakukan
- Mengaktifkan COD tanpa kuota COD (MER-19).
- Menyimpan saldo di sistem sendiri (§16.1 keputusan).
- Mengaktifkan "Bayar pakai DANA" bila tarif+PPN dikenakan (OPEN-30).
- Mengerjakan ARC Cloudflare/DO di repo ini (deviasi disetujui).
