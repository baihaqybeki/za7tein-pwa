# Milestones: api-spec-2026-10-16

Status: PROPOSED. Baseline aktif: `sa7tein-mvp-2026-10-11`. Dokumen ini pelengkap (kontrak API) —
**tidak** mengubah `activeRevision`. Sumber: `versions/api-spec-2026-10-16/source.md` (§4 G1–G16,
§5, §6–§8, §17–§18). Item `UNRESOLVED` tidak diisi tebakan.

Legenda status: `[ADA]` sudah jalan · `[SEBAGIAN]` sebagian · `[BELUM]` belum · `[USULAN]` usulan PRD ·
`[UNRESOLVED]` belum diputuskan. Kolom **Repo** = kondisi backend repo ini (Supabase, migrasi `31`–`38`)
+ FE mock; kolom **Spec** = penandaan dokumen sumber.

Dependensi arah (§17.7): `AP0 domain → AP1 discovery/katalog → AP2 uang → AP3 kuota/marketing →
AP4 merchant+batch → AP5 kurir inhouse+auto-sort → AP6 partner+dispatch → AP7 realtime/track/notif/chat →
AP8 rating → AP9 dispute → AP10 ops → AP11 verifikasi lintas role`. Paralel sejak AP0: G1 (RLS chat),
G3 (emit notif), G9 (realtime), G14 (order_status_history).

---

## AP0 — Model domain, enum, RLS dasar (M0)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP0.1 | Enum status order final (OPEN-26) | `[UNRESOLVED]` | `[SEBAGIAN]` (subset live) | Enum kanonik diputuskan PO + CHECK constraint + mapping klien §11 disamakan | — |
| AP0.2 | `orders.payment_method` = `cod\|qris\|dana_balance` | `[UNRESOLVED]`(§17.5) | `[ADA]` (`31`) | Nilai live = 3 itu; tidak ada `xendit_*`/`transfer` di constraint | — |
| AP0.3 | `courier_partner.status` offline/available/reserved/busy | `[BELUM]` | `[ADA]` (`31` `courier_type` + `availability`) | Kolom + CHECK; assignment mengubah status | — |
| AP0.4 | `order_status_history` (G14) | `[BELUM]` | `[ADA]` (migrasi `27`) | Tiap UPDATE status menulis baris; event `order_status_changed` punya muatan §7 | — |
| AP0.5 | `notifications.order_id`/`ref` (G13) | `[BELUM]` | `[ADA]` (migrasi `25`) | Tap notifikasi deep-link ke order | — |
| AP0.6 | Target RLS per tabel (§4) | `[BELUM]` | `[SEBAGIAN]` | `orders.otp` **tidak** terbaca kurir/merchant; tiap tabel sesuai §4 | — |
| AP0.7 | `orders.dispute_rule_ids` snapshot (§18) | `[BELUM]` | `[ADA]` (`31`,`33`) | Order menyimpan rule saat dibuat | — |

## AP1 — Discovery & katalog (M1, f23/f12)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP1.1 | `GET /merchants` tag/sort/filter lintas instance | `[BELUM]` (OPEN-25) | `[ADA]` `browse_merchants` (`33`) | Merchan sembunyi bila tak punya kuota & setting "tidak" | AP0 |
| AP1.2 | Kategori menu sebagai taksonomi ops (DEC-88104) | `[BELUM]` | `[BELUM]` | `menu_categories` + `menus.category_id`; merchant memilih, ops mengelola | AP0 |
| AP1.3 | Katalog atribut/variant/exclusion (§14) | `[SEBAGIAN]` | `[ADA]` (`40`) | `create_variant` + `display_type` + toggle 3 level | AP0 |
| AP1.4 | `menu_variants` binding flow | `[SEBAGIAN]` | — | Variant terpakai di checkout | AP1.3 |

## AP2 — Uang: model S..Ft + pembayaran + refund (M2, f1/f17)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP2.1 | Rumus §16.3 (`price_order`) | `[BELUM]` | `[ADA]` (`32`) | S−Dm−Da+F+Pc+Ft; Ft 1,5% hanya QRIS; Quick F×multiplier | AP0 |
| AP2.2 | Settlement 3 kolom (§16.4) | `[BELUM]` | `[ADA]` (`32`,`35`) | merchant+kurir+aplikator = total; ledger idempotent | AP2.1 |
| AP2.3 | Pembulatan dua arah | `[BELUM]` | `[ADA]` (`32`) | Tagihan ke atas ke ratusan; payout ke bawah rupiah | AP2.1 |
| AP2.4 | Kurs harian JOD→IDR | `[BELUM]` (OPEN-02) | `[SEBAGIAN]` (`fx_rate_latest`, seed) | Provider dipilih + fallback; kolom `effective_on` | — |
| AP2.5 | `POST /orders/{id}/payments` + timer 30 mnt | `[BELUM]` | `[SEBAGIAN]` (`create_order`) | Bayar saat order dibuat; QRIS/DANA/COD; expire → batal | AP2.1 |
| AP2.6 | `POST /webhooks/dana` + idempotency | `[BELUM]` (WEB-1) | `[BELUM]` | Idempotency key, retry, VA expiry | OPEN-01 |
| AP2.7 | `POST /orders/{id}/refund` (DANA/BI-FAST) | `[BELUM]` | `[ADA]` `create_refund` (`32`) | QRIS tanpa DANA → pending refund + rekening; DANA otomatis | AP2.2 |
| AP2.8 | COD = tunai offline (bukan hold), hanya kuota COD | `[BELUM]` | `[ADA]` (`reserve_quota` COD) | COD nonaktif tanpa kuota COD (MER-19) | AP3.1 |

## AP3 — Kuota langganan & marketing Odoo (M3, §15/§17)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP3.1 | `quota_packages` + `quota_subscriptions` (order & COD) | `[BELUM]` | `[ADA]` (`31`,`32`) | tersedia = paket − terpakai − reserve; prioritas order→COD→none | AP2 |
| AP3.2 | `GET/POST /merchants/{id}/subscriptions` (beli paket) | `[BELUM]` | `[SEBAGIAN]` | QRIS kena Ft 1,5%, DANA tidak; OPEN-29 | AP3.1, AP2.5 |
| AP3.3 | `PATCH merchants.accept_without_quota` (hanya saat tutup) | `[BELUM]` | `[ADA]` (`31`) | Setting berubah hanya bila `store_status='closed'` | AP3.1 |
| AP3.4 | Event `quota_reserved/consumed/returned` | `[BELUM]` | `[SEBAGIAN]` | Dipancarkan saat reserve/konsumsi/kembali | AP3.1 |
| AP3.5 | Program/rule/reward/card marketing (owner, isStackable) | `[SEBAGIAN]` | `[SEBAGIAN]` (`31`,`33`) | `compute_discounts` Dm/Da; reward shipping; OPEN-23 | AP2 |
| AP3.6 | `POST /promo/validate` | `[ADA]` | `[ADA]` (`validate_promo`) | Kode divalidasi jalur promo | — |

## AP4 — Merchant console, batch & coverage editor (M4, f12/f25/f28)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP4.1 | `POST /batches` (Regular accept), maks 24 (BR-B04) | `[BELUM]` | `[ADA]` (`assign_batch`+trigger) | Batch lahir hanya dari Regular; >24 ditolak | AP0 |
| AP4.2 | `GET/PATCH /batches/{id}` (assign 1 kurir, tutup, mulai lebih awal) | `[BELUM]` | `[SEBAGIAN]` | 1 kurir inhouse/batch (BR-B07/08/09) | AP4.1 |
| AP4.3 | `GET/PUT /merchants/{id}/coverage` (area/radius, non-overlap) | `[SEBAGIAN]` | `[SEBAGIAN]` (`coverage_zones`+`ops`/Leaflet) | Polygon tak tumpang tindih; mode radius fee/satuan | AP4 |
| AP4.4 | `POST /coverage/resolve` (fee dari **rute WALK**) | `[SEBAGIAN]` | `[SEBAGIAN]` (`check_coverage`; **belum** Google) | Radius = garis lurus; fee = rute WALK (no cache) | ARC-12 |
| AP4.5 | `order_note`/`item_note`+`note_enabled` | `[BELUM]` | `[SEBAGIAN]` | Catatan per menu hanya terlihat merchant | AP2 |

## AP5 — Kurir inhouse + auto-sort (M5, f13/f25)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP5.1 | Batch assign → delivery mulai → selesai per order | `[BELUM]` | `[SEBAGIAN]` (`assign_batch`) | Event `batch_assigned`/`delivery_started`/`order_completed` | AP4.1 |
| AP5.2 | Auto-sort rute (ON = WALK, mulai merchant→order terakhir; ≤25 titik) | `[BELUM]` | `[SEBAGIAN]` (`auto_sort_batch`, nearest-neighbor) | Google Routes bila ON; biaya R4 dipantau | ARC-12 |

## AP6 — Kurir partner + dispatch (M6, f26)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP6.1 | `courier_partner` + status + `GET/PATCH /courier-partners` | `[BELUM]` | `[SEBAGIAN]` (`31`) | offline/available/reserved/busy | AP0 |
| AP6.2 | `POST /assignments/{id}/approve\|reject{reason}` | `[BELUM]` | `[ADA]` `respond_assignment` (`32`) | reject wajib alasan; fee Quick 100% ke partner saat selesai | AP6.1 |
| AP6.3 | `POST /assignments/{id}/sp` + off bila tak merespons | `[BELUM]` | `[SEBAGIAN]` (`punishments`) | SP + punishment + status off sampai prepare selesai | AP6.1 |
| AP6.4 | Dispatch (antrian idle + batas jarak) | `[USULAN]` (OPEN-11) | `[SEBAGIAN]` (`dispatch_partner`) | Tie-break: selesai hari ini → jarak terdekat | OPEN-11 |

## AP7 — Realtime, tracking, notifikasi, chat (M7, §19–§20)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP7.1 | WS ber-versi + resync (NFR-05/06) | `[SEBAGIAN]` | `[SEBAGIAN]` (Supabase Realtime) | Semua perubahan observable dipublikasi; reconnect resync | AP0 |
| AP7.2 | `notifications` + `checkpoints` realtime (G9) | `[BELUM]` | `[SEBAGIAN]` (`36` publikasi) | Atau polling 5s disetujui | AP7.1 |
| AP7.3 | Emit notif per langkah + audience `cs` (G3) | `[BELUM]` | `[SEBAGIAN]` (trigger journey) | Recipient dari relasi order, bukan id demo | AP0 |
| AP7.4 | Push fan-out (Edge Function) + fallback WA | `[BELUM]` (R-PUSH-01) | `[ADA]` (`send-push`) | Payload ≤4 KB, TTL, `userVisibleOnly`, nonaktifkan sub 404/410 | AP7.3 |
| AP7.5 | Group chat per order + gambar R2, RLS peserta (G1) | `[SEBAGIAN]` | `[ADA]` peserta (`36`); **R2 belum** | Peserta ≤3; kurir gabung saat assign/approve; read-only N hari | AP0 |
| AP7.6 | `courier_location` + `courier_almost_arrived` | `[BELUM]` (L1) | `[BELUM]` | Andai hanya saat app kurir terbuka | AP7.1 |

## AP8 — Rating & review (M8, f19)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP8.1 | `POST /orders/{id}/review` (merchant + menu, tanpa variant) | `[BELUM]` | `[ADA]` (`submit_review`,`40`) | Rating 1–5; tip 100% ke kurir → ledger | AP2 |
| AP8.2 | `POST /reviews/{id}/reply` | `[BELUM]` (RATE-1/2) | `[ADA]` (`reply_review`) | RLS owner merchant | AP8.1 |
| AP8.3 | Agregat `rating_avg`/`rating_count` refresh | `[BELUM]` | `[ADA]` (trigger `refresh_merchant_rating`) | Trigger saat review masuk | AP8.1 |

## AP9 — Dispute & punishment (M9, f8/f24)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP9.1 | Rule + kompensasi + punishment + snapshot ke order | `[BELUM]` | `[ADA]` (`31`,`33`) | Snapshot saat order dibuat | AP0 |
| AP9.2 | `POST /disputes` + `resolve` + `appeals` | `[BELUM]` (DSP-1) | `[ADA]` (`open/resolve/appeal_dispute`) | 4 resolusi; tiap putusan = 1 entry ledger; freeze + pause auto-settle | AP2, AP9.1 |
| AP9.3 | `incident_resolutions` (G8) | `[BELUM]` | `[ADA]` (migrasi lama) | Jejak tutup insiden CS | AP9.2 |
| AP9.4 | Batas peran CS vs SA (DEC-2003) | `[ADA]` | `[SEBAGIAN]` | CS menangani; SA hanya eskalasi | AP9.2 |

## AP10 — Ops PWA, ARC & NFR (M10, §13/§21)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP10.1 | Ops PWA + Cloudflare Access (verifikasi, moderasi tag, param, SP) | `[BELUM]` | `[SEBAGIAN]` (Supabase RLS ops) | Di balik Access; audit trail (NFR-07) | ARC deviasi |
| AP10.2 | Analytics + logs | `[BELUM]` (OPEN-24) | `[SEBAGIAN]` (`ops_kpis`) | Workers Analytics Engine (target) | ARC |
| AP10.3 | ARC-01..13 (Worker/DO/Queue/Workflow/RPC/WS/R2) | `[BELUM]` | `[UNRESOLVED-deviasi]` (Supabase) | Keputusan PO; repo tetap Supabase | — |
| AP10.4 | NFR-01/02 (idempotency, ledger append-only) | `[BELUM]` | `[SEBAGIAN]` (`32`, append-only) | Idempotency key langkah uang; ledger tak bisa diedit | AP2 |
| AP10.5 | Job: SLA watcher, auto-settle, chat retention, rating window, payout poll, liability | `[BELUM]` (G2) | `[SEBAGIAN]` (`sla_watch`, `close_stale_chats`) | Cron + emit notif (§8) | AP7.3 |

## AP11 — Verifikasi lintas role (M11)
| # | Item | Spec | Repo | Acceptance criteria | Dep |
|---|---|---|---|---|---|
| AP11.1 | Konsistensi notifikasi/status lintas role (G3) | `[BELUM]` | `[SEBAGIAN]` | Matriks §6 terpenuhi e2e | AP0–AP10 |
| AP11.2 | E2E: create→batch/quick→checkpoint→OTP→settle→refund/dispute | `[BELUM]` | `[SEBAGIAN]` (`scripts/api-e2e.mjs` 18/18) | Semua langkah lewat API nyata, angka cocok | AP0–AP10 |

---

## Cross-cutting (paralel sejak AP0)
- **G1** RLS chat peserta · **G3** emit notif per langkah + `cs` · **G9** realtime notif/checkpoint · **G14** `order_status_history`.
- **UNRESOLVED-deviasi:** semua item ARC/Cloudflare (Worker/DO/Workflow/R2/Access/Global Index) — repo tetap Supabase sampai PO memutuskan; ditandai, bukan dikerjakan diam-diam.

## Blocker & terbuka (jangan dikerjakan dengan tebakan)
- OPEN-01 DANA (blocker uang), OPEN-02 kurs, OPEN-08, OPEN-11, OPEN-17/18/19, OPEN-20, OPEN-23, OPEN-24, OPEN-25, OPEN-26, OPEN-27, OPEN-28, OPEN-29, OPEN-30.
- Spec §14: window cancel, ambang tolak berulang, kanal final, SLA CS, editor SLA, retensi chat, idempotency/retry/VA expiry, tarif pajak, quotation vs placed, Google auth, dispute kategori, kolom 19 tabel kosong.

## Catatan
- Dokumen ini **tidak** mengaktifkan revisi; `activeRevision` tetap `sa7tein-mvp-2026-10-11`.
- Status `[BELUM]` di spec = berdasarkan probe 2026-10-12; banyak sudah sebagian ditutup backend repo ini
  (migrasi `31`–`38`) — lihat kolom **Repo** dan `analysis.md`, tanpa menyunting `docs/backend`.
