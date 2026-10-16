# Analysis: api-spec-2026-10-16

Status: REVIEWED (proposed — belum mengubah `activeRevision`). Baseline aktif: `sa7tein-mvp-2026-10-11`.

## Source inventory
- Berkas: `versions/api-spec-2026-10-16/source.md` (dari `inbox/API-SPEC (1).md`), 1556 baris / 95.124 byte.
- Sifat dokumen: **spesifikasi kontrak API** (pelengkap/BRS), bukan PRD produk. Dipakai sebagai bahan milestone BE.
- Bagian: **A (§1–§16)** kontrak backend **live Supabase** + flow (revisi lama `irbid-mvp-v2`, `superseded`); **B (§17–§18)** **delta revisi aktif** `sa7tein-mvp-2026-10-11` (marketplace + delivery, target Cloudflare).
- Dibaca seluruh: §0 dua lapisan, §1 konvensi, §2 skema nyata (probe 2026-10-12), §3 authz, §4 delta wajib (G1–G16) + target RLS, §5 endpoint per domain, §5.5.1 OTP, §6 matriks event→penerima, §7 katalog event, §8 job, §9 transport, §10 cakupan per flow, §10b lubang mapping, §11 enum, §12 checklist, §13 urutan, §14 UNRESOLVED, §15 referensi, §16 diagram, §17 delta, §18 diagram delta.
- SHA-256: lihat `manifest.json` (intake mencatatnya).
- Rujukan harga spec: `openapi.yaml` (DRAFT 0.1.0) di `sa7tein-api.vercel.app`; verifikasi E2E spec: `docs/design/flows/API-SPEC-VERIFICATION.md` (**126 OK · 0 FAIL**, alat `scripts/api-spec-check.mjs`).

## Isi inti (bersumber)
- **Dua lapisan kontrak (§0):** Lapisan 1 = Supabase PostgREST live (yang klien panggil); Lapisan 2 = kontrak target, pada revisi aktif = **Cloudflare Worker/DO/Queue/Workflow/RPC/WS/R2 (ARC-01..13)**. Penandaan per item `[ADA]/[SEBAGIAN]/[BELUM]/[USULAN]/[UNRESOLVED]` (§17).
- **Aktor berubah (§17.1):** customer/merchant login **email magic link**; merchant wajib akun DANA; **kurir partner** baru (offline/available/reserved/busy); ops = **PWA terpisah di balik Cloudflare Access**. Constraint: **1 email = 1 role**.
- **Model uang baru (§17.4):** `total = S − Dm − Da + F + Pc + Ft`; `Ft = 1,5% × (…)` **hanya QRIS**; F Regular=fee merchant, Quick=F×1,2; Pc 0,2 JOD (termasuk COD); Pm 0,25 JOD (hanya online tanpa kuota); settlement 3 kolom selalu = total; pembulatan **tagihan ke atas ke ratusan / payout ke bawah ke rupiah penuh**; kurs JOD→IDR harian (OPEN-02); ledger append-only; idempotency.
- **Entitas baru (§17.2):** batch+status, kurir partner+reservasi, assignment+SP, langganan kuota+paket, program marketing Odoo (program/rule/reward/card, owner, isStackable), refunds, coverage per merchant, order_status_history, incident_resolutions, ops analytics, R2.
- **Enam belas gap wajib (§4 G1–G16):** RLS chat peserta, SLA/escalation, emit notif per langkah + audience cs, ledger append-only+hold lifecycle, dispute lifecycle, OTP server (generate/expiry/verify), order_items diisi, incident_resolutions, realtime notifications/checkpoints, geofence server, webhook DANA, auth phone/E.164, notifications.order_id, order_status_history, tabel promo (G15 `[ADA]`), ulasan terpetakan (G16 `[SEBAGIAN]`).
- **Matriks event→penerima (§6):** 12 baris; baris 9–12 (CS/SA) **tak pernah dipancarkan** klien; `audience:'cs'` valid tapi 0 pemanggil; recipient harus dari relasi order, bukan id demo.
- **OTP bocor (§5.5.1):** pola `otp = 1000 + 7*id`, `otp_verified` tak pernah true, kurir/merchant bisa baca `orders.otp`.

## Requirement delta ringkas vs backend repo ini (dengan bukti)
Spec (probe 2026-10-12) menandai banyak `[BELUM]`. Sejak itu repo ini sudah menambah backend Supabase (migrasi `supabase/31`–`38`). Rekonsiliasi:

| Domain | Spec status | Kondisi backend repo sekarang | Bukti |
|---|---|---|---|
| Kuota langganan | `[BELUM]` | **ada** (Supabase): `quota_packages`/`quota_subscriptions` + RPC reserve/consume/release | `31`, `32` |
| Batch + cap 24 | `[BELUM]` | **ada (superset)**: `batches`, `assign_batch` cap 24 + trigger + `auto_sort_batch` (nearest-neighbor, bukan Google Routes) | `31`,`32`,`36` |
| Dispatch partner + SP | `[BELUM]/[USULAN]` | **sebagian**: `dispatch_assignments`, `dispatch_partner`, `respond_assignment`; SP (punishment) tabel ada | `31`,`32` |
| Refund | `[BELUM]` | **ada (state)**: `refunds` (DANA/BI-FAST) + `create_refund` | `31`,`32` |
| Uang S..Ft + settlement | `[BELUM]` | **ada**: `price_order` (§16.3), `settle_order` (§16.4), `enterprise_ledger` idempotent, `platform_params` | `32`,`35` |
| Coverage per merchant | `[SEBAGIAN]` | **ada (Supabase)**: `coverage_zones` + `check_coverage`+`haversine`; **rute WALK Google belum** | `31`,`32` |
| Master zona (definisi) | — | **ada**: policy tulis ops + `ops_upsert_zone` + editor Leaflet | `38` |
| Dispute rule + snapshot | `[BELUM]` | **sebagian**: `dispute_rules`/`merchant_dispute_rules`/`punishments`, `snapshot_dispute_rules` | `31`,`33` |
| Magic link (acc) | `[BELUM]` | **sebagian (stub)**: `magic_links` + request/consume (email nyata belum) | `34` |
| Marketing program Odoo | `[SEBAGIAN]` | **sebagian**: `marketing_programs/_rules/_rewards` + `compute_discounts`; `cards`/reward shipping belum | `31`,`33` |
| OTP server | `[BELUM]` | **diperbaiki**: OTP acak, `verify_order_otp`, kolom disembunyikan | migrasi lama `24` |
| order_status_history | `[BELUM]` | **ada**: tabel + trigger | migrasi lama `27` |
| notifications.order_id | `[BELUM]` | **ada** | migrasi lama `25`, dipakai `34` |
| chat participants RLS | `[BELUM]` | **ada** (peserta + RLS), `send_chat_message` | migrasi lama + `36` |
| incident_resolutions | `[BELUM]` | **ada** | migrasi lama `25` |
| R2 / Cloudflare ARC | `[BELUM]` | **tidak ada** (deviasi disetujui: Supabase Storage + Postgres; ARC ditandai UNRESOLVED) | `decision-sa7tein-mvp.md` |
| Ops PWA + Cloudflare Access + analytics | `[BELUM]` | **tidak ada** (deviasi) | — |

## Conflicts and open questions
- **Enum status order mismatch** (§11): klien menulis `diterima/tiba` yang tak ada di BE; OST-1 `[UNRESOLVED]`; enum kanonik `cart→quotation→prepare→waitingCourier→waitingDelivery→delivery→done (+canceled, disputed)`.
- **`orders.payment_method`**: spec §17.5 usul `cod|qris|dana_balance`; DB lama masih menyebut `xendit_*` di dokumen ini. Repo sudah migrasi ke `qris|dana_balance|cod` (migrasi `31`) — **spec ini belum diperbarui**; catat sebagai drift, bukan menimpa spec.
- **Platform**: spec target Cloudflare (ARC); repo tetap Supabase (keputusan aktif). Semua `[BELUM]` berbau ARC (Global Index, DO, Workflow, R2, Access) tetap `UNRESOLVED-deviasi`.
- **Blocker uang**: OPEN-01 DANA (kapabilitas), OPEN-02 kurs, OPEN-08 penarikan pasca-payout, OPEN-30 tarif "Bayar pakai DANA".
- **Terbuka lain (§17.9 & §14):** OPEN-10/11/17/18/19/20/23/24/25/26/27/28/29; retensi chat, window cancel, tarif pajak, dll.
- **M8 (spec):** daftar tabel/RPC/Edge Function/bucket penuh tak terbaca dari luar — jangan klaim lengkap.

## Repo impact and evidence
- **FE (mock) status per §17.7:** M0 `[ADA]`, M4 `[ADA]`, M1/M2/M3/M5/M6/M7 `[SEBAGIAN]`, M8–M11 `[USULAN]`. Ini status mock FE, bukan BE.
- **BE repo ini:** migrasi `31`–`38` sudah menutup **sebagian** delta Bagian B pada Supabase (lihat tabel). Yang **belum**: Cloudflare ARC, rute WALK, tracking lokasi, ops PWA/Access, R2, webhook DANA, magic-link email nyata, kartu/reward shipping, enum final (OPEN-26).
- **Governance:** revisi tetap `proposed`; aktivasi tidak diusulkan (dokumen ini pelengkap, mengacu ke PRD aktif). Tidak mengubah `activeRevision`.

## Rekomendasi
Jadikan dokumen ini **milestone BE–FE handoff** yang terikat ke `sa7tein-mvp-2026-10-11` (lihat `milestones.md`), **tanpa** mengaktifkannya sebagai `activeRevision`. Milestone dipecah berurutan berdasar dependensi (model domain → uang → kuota/marketing → batch/dispatch → coverage → realtime/notif/chat → rating → dispute → ops → verifikasi), tiap item menunjuk status spec (`[ADA]/[SEBAGIAN]/[BELUM]`) + status backend repo + kriteria terima. Item ARC/Cloudflare tetap `UNRESOLVED-deviasi` sampai PO memutuskan.
