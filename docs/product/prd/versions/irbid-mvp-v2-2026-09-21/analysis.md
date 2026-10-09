# Analysis: irbid-mvp-v2-2026-09-21

Status: REVIEWED. Baseline: irbid-mvp-2026-09-12 (kini superseded oleh irbid-mvp-v2-2026-09-21).

## Source inventory
- Version printed in document: irbid-mvp-v2-2026-09-21 (Meta ID)
- Pages/sections read: Meta, Latar Belakang, Perubahan dari PRD Aktif, Update PO 2026-09-21, Keputusan (3 Wallet, Tips, Payment Gateway Xendit, VAT/GST), Model Transaksi (Prepaid vs COD, Fee Platform), Guard Zona, Verifikasi Pengiriman (Checkpoint, OTP, Timer/SLA), Proteksi/Dispute/Protection Fund (Negative scenarios, Kurir bawa kabur, Protection fund, Politik waktu tunggu, Penalti customer, Dispute), Reporting/Ledger/Liability (Ledger, Laporan, Liability, Pajak, VAT dua lapis, Ringkasan pajak), Mata Uang (Transaksi IDR, Display JOD, Provider rate, Yang dihapus), Biaya Xendit (Top-up, Withdraw, Biaya tetap, Unit economics), Scope Sistem, Status Legacy, Realtime & Notifikasi (Web Push rules, iOS limits, WhatsApp fallback), Open Questions (30 items), Referensi (Klaim terverifikasi, Klaim perlu konfirmasi, URL referensi)
- SHA-256: 0f80c546dee94e1c7b45a4cc74bfcea6a58babf06fb298fc3da5541d8b850225

## Requirement delta
| Requirement ID | Source page/section | Current rule | New rule | UI/state impact | BE contract | Decision/status |
|---|---|---|---|---|---|---|
| R-FEE-01 | Fee Platform (lines 127-142), Update PO (lines 37-48) | Flat 0,35 JOD/order (buyer 0,20 + merchant 0,15) (source "Perubahan dari PRD Aktif" table row "Model fee platform") | Flat fee JOD: merchant 0,15 + customer 0,22 = 0,37 JOD/order. Fee flat bukan persen. (source "Fee Platform" table + "Update PO" #1-2) | `src/data/merchant.ts` PAYMENT_METHODS — absent (no fee constants). `src/types.ts` PaymentMethodId — absent (no wallet). Checkout page needs fee breakdown display — absent. | Field: `fee_merchant_jod` (0.15), `fee_customer_jod` (0.22), `fee_platform_jod` (0.37) per order. Actor: system calculates at checkout. No backend in this repo. | DECIDED |
| R-WALLET-01 | Keputusan 1. Tiga Wallet (lines 64-76) | No wallet system. Only COD and transfer manual. (source: decision-irbid-mvp.md "tanpa payment gateway, hanya cod dan transfer manual") | Three closed-loop wallets: customer (top-up via Xendit), merchant (auto-kredit on order complete + Xendit payout), courier (tips only + Xendit payout). Internal ledger for inter-wallet transfers. Status: available + pending. | `src/types.ts` — absent (no Wallet, TopUp, Payout types). `src/store/slices/cartSlice.ts` — absent (no walletBalance, topUpHistory, payoutHistory). `src/App.tsx` — absent (no wallet routes). Need 3 wallet screens per role (balance, top-up, payout history). | Types: Wallet{balance,available,pending}, TopUp{amount,channel,status,createdAt}, Payout{amount,status,createdAt}. Actors: customer, merchant, courier. Events: top_up_created, top_up_completed, payout_requested, payout_completed. State: pending/processing/completed/failed. | DECIDED |
| R-COD-01 | Model Transaksi (lines 106-126), Update PO Alur COD (lines 50-61) — **direvisi PO 2026-09-25** | COD = cash on delivery (source: decision-irbid-mvp.md "COD dan transfer manual hanya alur layar"). No wallet hold mechanism. | Wallet **reserve** (prepaid & COD): saldo di-reserve saat order dibuat, **saldo berkurang saat order done (settle)**. Batal sebelum done = release reserve. **Cut saat kurir match dihapus** (menggantikan "potong saat match", PO 2026-09-25). | `src/store/slices/cartSlice.ts` — partial (has orderStage, selectedPaymentId but no wallet reserve). `src/types.ts` PaymentMethodId only has 'cod'|'transfer' — needs 'wallet' added. CartSlice needs reserve/release/settle branches. | State: order.hold_status (none/reserved/settled/released). Event: reserve_created, reserve_settled (order done), reserve_released (cancel before done). Ledger: append-only entries per state transition. Refund/dispute post-done = ledger reversal (f7/f8), bukan state hold. | DECIDED (PO 2026-09-25) |
| R-CURR-01 | Mata Uang (lines 470-501), Update PO (lines 46-48) | JOD as primary working currency. Code is "IDR-only" as legacy implementation, not active product decision. (source: active baseline irbid-mvp-2026-09-12; decision-irbid-mvp.md section "Status kode": "IDR-only, radius A/B_C, kuota free tier, dan transfer manual tetap ada sebagai legacy implementation, bukan keputusan produk aktif") | IDR penuh untuk semua settlement (Xendit Indonesia-only). JOD hanya display-only. Rate sync sistem 1x24 jam dari API kurs eksternal. Simpan ke tabel exchange_rates. Semua perhitungan server pakai IDR. Wise dibatalkan. | `src/types.ts` — absent (no ExchangeRate type). `src/data/merchant.ts` — absent (no exchange rate constants). Needs rate fetch service + JOD display component. | Table: exchange_rates{base,quote,rate,fetched_at,source}. Event: rate_fetched, rate_fetch_failed. SLA: sync 1x24 jam. Fallback: gunakan rate terakhir kalau fetch gagal. Data sensitif: rate source URL. | DECIDED |
| R-TAX-01 | VAT (lines 97-104), VAT dua lapis (lines 408-419), Pajak (lines 394-468) | No tax framework in current PRD. (source: decision-irbid-mvp.md — no mention of VAT/GST) | Two layers: (1) GST atas makanan — Jordan 16%, merchant setor ke IGA, platform cuma monitor. (2) GST/PPh atas fee platform — 0,37 JOD/order kena pajak jasa. PPh final 0,5% sejak order pertama. Database butuh dua kolom: gst_amount + platform_gst. | `src/types.ts` — absent (no VAT type). Checkout needs VAT breakdown display — absent. Invoice screen needs VAT lines — absent. | Field: gst_amount (per order, for merchant reports), platform_gst (on fee platform, for platform tax). Actor: merchant (layer 1), platform (layer 2). Events: tax_calculated, tax_reported. Status: belum final — needs konsultan pajak. | UNRESOLVED (tarif GST makanan spesifik, PPN Indonesia ekspor jasa, status PKP) |
| R-DISPUTE-01 | Dispute — Modul Super Admin (lines 300-358) | No dispute system. (source: decision-irbid-mvp.md — no mention of dispute) | Dispute = super admin queue. User tap "Ajukan Sengketa" + alasan + bukti. Order -> disputed, hold dibekukan, auto-settle pause. 4 resolusi: refund penuh, refund sebagian, release ke merchant, tolak. 1x pengajuan per order, 24 jam window. | `src/pages/` — absent (no dispute page). `src/store/slices/` — absent (no dispute slice). Need dispute submission screen (customer/merchant) + super admin queue + resolution screen. Super Admin may need full-width shell exception (AGENTS.md section 9). | State: order.disputed, order.resolved_{refund_full|refund_partial|released|rejected}. Event: dispute_filed, dispute_resolved. Actor: super admin. SLA: 24h window per order. Ledger: each resolution = 1 new double-entry transaction (append-only). | DECIDED |
| R-DELIV-01 | Verifikasi Pengiriman (lines 156-190) | No delivery verification beyond journey stages. (source: current codebase OrderStageScreen shows journey but no checkpoint/OTP/SLA) | 4 checkpoints: Ambil (merchant konfirmasi), Berangkat (timer SLA 15m), Tiba (geolocation + foto), Selesai (OTP 4-digit). Timer: Ambil->Berangkat 15m, Berangkat->Tiba 30m, Tiba->OTP 10m. Auto-settle after 10m. | `src/components/OrderStageScreen.tsx` — partial (has 4 stages but no OTP, no SLA timer, no checkpoint buttons). `src/types.ts` OrderStage — partial (has stages but no OTP/SLA fields). Need OTP verification screen, SLA timer display, checkpoint action buttons per role. | State: checkpoint{type,timestamp,evidence}, timer{checkpoint,start,duration,expired}, otp{generated,verified}. Event: checkpoint_reached, timer_expired, otp_verified, auto_settled. SLA: 15m/30m/10m per checkpoint. Auto-complete: 10m after Tiba. | DECIDED |
| R-PUSH-01 | Realtime & Notifikasi (lines 611-658), WhatsApp fallback (lines 660-679) | No push notification system. (source: AGENTS.md "Service worker untuk Web Push — PWA-nya jalan, tapi push tidak") | Web Push rules: payload max 4KB, TTL wajib, silent push dilarang, userVisibleOnly wajib. iOS: install gate 16.4+, force-quit = bisu, ITP 7 hari. WhatsApp fallback: manual deep link wa.me. Nomor WA wajib saat registrasi (E.164). | `src/pages/NotificationSettings.tsx` — partial (has UI but no push registration). `src/types.ts` — absent (no push subscription type). PWA service worker exists but push not implemented. Need push registration flow, WhatsApp fallback button. | Event: push_subscribed, push_sent, push_delivery_confirmed. State: subscription{endpoint,keys,platform,expiresAt}. SLA: WhatsApp fallback for critical events on iOS. Data sensitif: push subscription keys, phone numbers. | UNRESOLVED (push testing on device belum dilakukan, WhatsApp Business API level 2 belum dipakai) |
| R-CASHOUT-01 | Open Questions #16/#22 (lines 700-706), Guard Zona (line 153) | No cash-out mechanism. (source: absent from current PRD and codebase) | Customer cash-out: flow tarik saldo kembali ke rekening. Wajib ada supaya customer mau top-up. Fee cash-out masih OPEN (Open Questions #22). | `src/types.ts` — absent. `src/store/slices/` — absent. Need cash-out screen + fee configuration. | Event: cashout_requested, cashout_completed. Fee: UNRESOLVED (nominal/fee penarikan). Loss ~Rp3.200/kejadian tanpa fee (source: unit economics section). | UNRESOLVED (cash-out fee belum final, Open Questions #22) |
| R-TOPUP-01 | Update PO #3 (line 45), Unit economics (line 589) | No top-up gate. (source: absent from current PRD) | Akun baru wajib top-up minimum 3,5 JOD (Rp80.500) sebelum bisa order. Gate saldo awal. | `src/types.ts` — absent. `src/store/slices/` — absent. Need top-up gate check at checkout. | Field: min_topup_new_account_jod = 3.5. Event: topup_gate_checked, topup_gate_passed/failed. Validator: balance >= 3.5 JOD before first order. | DECIDED |
| R-LEDGER-01 | Reporting, Ledger & Liability (lines 361-407) | No ledger system. (source: absent from current PRD) | Ledger = double-entry, append-only, kronologis. Semua laporan adalah turunan ledger. Saldo wallet user = liability (utang) platform, bukan aset. Metric: saldo Xendit >= total utang wallet. | `src/types.ts` — absent. `src/store/slices/` — absent. Ledger is pure backend concept — no UI mock needed beyond status displays. | Table: ledger_entries{transaction_id,debit_account,credit_account,amount,timestamp,type}. Events: entry_appended, entry_reversed. Rule: never edit/delete, only reverse with new entry. Data sensitif: all financial records. | DECIDED |
| R-INCENTIVE-01 | Insentif Founding Merchant (section baru) | Tidak ada skema insentif merchant. (source: `irbid-mvp-2026-09-12/source.pdf` — tidak ada "Founding"; hanya deposit COD 3,50 JOD §5C dan Sa7tein Credit non-withdrawable §5J) | Merchant baru dapat **modal saldo 5 JOD non-withdrawal** (`merchant_credit`, menutup ~33 order pertama × 0,15) + **cashback bulanan tiered**: Tier 1 (500 order) 15 JOD, Tier 2 (1.000) 40 JOD, Tier 3 (1.250+) 62,5 JOD → fee efektif 0,12 / 0,11 / 0,10 JOD per porsi | `src/types.ts` — perlu tipe `MerchantCredit`, `RebateTier`. `src/data/merchant.ts` — perlu konstanta `FOUNDING_CREDIT_JOD = 5`, `REBATE_TIERS[]`. `src/store/slices/walletSlice.ts` — perlu dompet deposit merchant + saldo credit terpisah dari saldo withdrawable. `src/pages/WalletBalance.tsx` (merchant) — perlu tampilan modal terpakai + progress tier bulan berjalan. Ledger butuh akun `merchant_credit` | Field: `merchant_credit_balance`, `rebate_tier`, `rebate_period` (YYYY-MM), `rebate_amount_jod`, `rebate_paid_at`. Events: `merchant_credit_granted`, `merchant_credit_debited`, `rebate_tier_reached`, `rebate_paid`. Rule: modal **non-withdrawal** dan **hangus** kalau merchant berhenti (I-6); cashback masuk dompet deposit merchant tapi juga **non-withdrawal** — hanya untuk pemakaian in-app (I-3). Status: angka dari PO; I-1..I-6 semua sudah dijawab | DECIDED |

## Conflicts and open questions

### Conflicts with active baseline (irbid-mvp-2026-09-12)
| Conflict ID | Aspect | Active baseline | New doc | Resolution needed |
|---|---|---|---|---|
| C-01 | Payment gateway | Midtrans (QRIS/VA, disbursement H+1) — source "Perubahan dari PRD Aktif" table | Xendit (top-up + payout) — source "Keputusan 2. Payment Gateway: Xendit" | CONFLICT. New doc replaces Midtrans with Xendit. Must update manifest + decision-irbid-mvp.md upon activation. |
| C-02 | Model fee | Flat 0,35 JOD/order (buyer 0,20 + merchant 0,15) — source "Perubahan dari PRD Aktif" table "Model fee platform" | Flat fee JOD: merchant 0,15 + customer 0,22 = 0,37 JOD/order — source "Update PO 2026-09-21" #1-2 | CONFLICT. Fee total changed from 0,35 to 0,37 JOD. Customer fee changed from 0,20 to 0,22 JOD. |
| C-03 | Currency model | JOD primary, IDR via Midtrans — source "Perubahan dari PRD Aktif" table "Mata uang" | IDR penuh, JOD display-only, rate sync 1x24 jam — source "Mata Uang" section + Update PO #4-6 | CONFLICT. Wise cancelled. JOD becomes display-only. All calculations in IDR. |
| C-04 | COD model | COD = cash on delivery (implied) — source decision-irbid-mvp.md | COD via e-wallet with hold/cut/settle mechanism — source "Model Transaksi" + "Update PO Alur COD" | CONFLICT. COD is now wallet-based, not cash. Major behavioral change. |
| C-05 | Zone model | 2 zones: Hijazi/Syimali (source "Guard Zona" section) — consistent with active baseline | Same 2 zones — consistent | No conflict. Zones match. |

### Conflicts vs repo UI/UX referensi `baihaqybeki/sa7tein` — RESOLVED by PO 2026-09-21

Repo 4 portal itu (`apps/{customer,merchant,courier,cs}`, JS + Zustand + Supabase) adalah **referensi UI/UX, bukan target implementasi**. Target tetap repo ini (`sa7tein-pwa`). PO memutuskan setiap konflik mengikuti aturan revisi ini, sambil memakai struktur portal referensi sebagai acuan bentuk layar (termasuk portal CS sebagai acuan Super Admin). Perbedaan design system eksplisit DI LUAR CAKUPAN.

| ID | Aspect | Referensi sekarang | This revision (decided) | Decision |
|---|---|---|---|---|
| C-06 | Courier model | Courier = platform entity (`couriers.online`, `last_seen_at`, earnings = `courierCost`); offer engine `OFFER_TIMEOUT_MS 60s`, `rejectedBy[]`, CS force-assign / re-offer | Courier = merchant employee, paid by merchant; platform does not assign couriers nor hold courier funds; courier wallet = tips only | **Adopt revision.** Courier gets `merchant_id`; platform-level offer engine and courier earnings are dropped. |
| C-07 | Delivery fee (ongkir) | Customer pays `courierCost` (base Rp5.000 + Rp2.500/km) and it becomes courier earnings | Ongkir 100% merchant, 0% platform fee; courier paid by merchant | **Adopt revision.** Ongkir is a merchant-borne line, not courier earnings. |
| C-08 | Payment model | COD / QRIS / Transfer, simulated; no wallet, no platform fee | COD via e-wallet: hold → cut at courier match → settle at OTP; fee merchant 0,15 JOD + customer 0,22 JOD | **Adopt revision.** |
| C-09 | Delivery verification | Courier taps `completeDelivery` manually | OTP 4-digit from customer is the only settle trigger | **Adopt revision.** |
| C-10 | Tracking | Live GPS every 3s (`STEP_MS 3000`) rendered on a map | No realtime GPS. Checkpoints + SLA timers (15/30/10 min) + one geolocation snapshot at "Tiba" + photo | **Adopt revision.** |
| C-11 | Cancel policy | Customer cancel window 15s (`CANCEL_WINDOW_MS`); CS cancel; `store_closed` auto-cancel | Courier waits max 10 min at the door, then may leave; negligent-customer refund is partial (50% food, ongkir split to courier/merchant) | **Adopt revision.** |
| C-12 | Dispute / CS | CS portal: cancel, force-assign, re-offer, mark-delivered, chat mediator. No dispute or refund flow | Dispute = queue with 4 resolutions (refund full / partial / release to merchant / reject), 24h window, 1× per order, hold frozen, auto-settle paused | **Adopt revision, inside the existing CS portal.** Portal keeps the name "CS" and doubles as super admin. |
| C-13 | Zones | Distance-based fee only, no zone polygon | 2 zones Hijazi / Syimali, ≤2 km haversine from merchant kitchen, per-merchant `is_active_hijazi` / `is_active_syimali` | **Adopt revision.** |
| C-14 | Currency | 100% IDR, `formatRupiah`, no JOD anywhere | IDR for all settlement, JOD display-only, rate synced 1×24h from an external API | **Adopt revision.** |
| C-15 | Locale | Jakarta restaurant seed (`lat -6.2, lng 106.8166`) | Irbid, Jordan | **Adopt revision.** |
| C-16 | Tax | None | Two-layer GST (food → merchant settles; platform fee → platform settles); columns `gst_amount` + `platform_gst` | **Adopt revision.** |
| C-17 | Order status enum | `pending, accepted, preparing, ready, picked_up, on_the_way, delivered, rejected, cancelled` | Needs hold/settle granularity plus `disputed` / `resolved_*` | **Extend the repo enum.** Keep the existing 9 statuses; add `hold_status` sub-state and dispute states. |
| C-18 | Notifications | In-app chat only (3 channels) | Web Push (strict rules) + WhatsApp `wa.me` fallback; phone mandatory in E.164 | **Adopt revision.** Keep in-app chat; add push + WA fallback. |
| C-19 | Order payload | Whole order stored in `orders.data jsonb` | Ledger and tax require normalized money columns | **Extend.** Keep `data jsonb` for mock convenience; add normalized fee/tax/hold columns for reporting. |

**Target tetap repo ini (`sa7tein-pwa`).** Sitasi path di `analysis.md` dan `milestones.md` memakai path `sa7tein-pwa` (TS + Redux + SCSS, 3 role + Super Admin). Repo referensi tidak dipakai sebagai target implementasi, jadi konflik di atas adalah **daftar penyesuaian aturan bisnis**, bukan rencana migrasi repo.

### Source doc Open Questions (status per PO 2026-09-22)
| OQ# | Question | Status in source |
|---|---|---|
| OQ-2 | Ambang registrasi IGA & kapan mulai memungut GST (Jordan) | UNRESOLVED |
| OQ-3 | Tarif GST spesifik makanan siap saji vs ongkir di Jordan | UNRESOLVED |
| OQ-4 | PPN Indonesia atas "ekspor jasa" — apakah berlaku untuk entitas PT Indonesia | UNRESOLVED |
| OQ-5 | Xendit: onboarding + approval skenario penggunaan (user di luar negeri, transaksi IDR) | DEFERRED (BE — PO 2026-09-22) |
| OQ-6 | Urutan implementasi: wallet milestone terpisah setelah M5, atau disisipkan di M0-M5 | DEFERRED (BE — PO 2026-09-22); milestone mock menempatkan wallet di M3 |
| OQ-7 | Onboarding Xendit: persetujuan kategori bisnis (marketplace + disbursement) | DEFERRED (BE — PO 2026-09-22); fee dorman min. USD50/bulan sudah dijawab |
| OQ-8 | xenPlatform (sub-account per merchant, Rp25.000/akun/bulan) vs 1 akun utama + ledger internal | DEFERRED (BE — PO 2026-09-22); rekomendasi: 1 akun utama + ledger |
| OQ-13 | Timer SLA per zona: konfigurasi final (15/30/10 menit) berdasarkan data rute Irbid | DECIDED sementara (PO 2026-09-22: 15/30/10 dipakai) |
| OQ-14 | Penalti customer lalai: % potongan final — body pakai 50% makanan + ongkir | UNRESOLVED (30%/50%/full ongkir) |
| OQ-15 | Regulasi e-money/PJP & segregated account | UNRESOLVED |
| OQ-16 | Cash-out saldo customer: flow tarik saldo kembali ke rekening | UNRESOLVED |
| OQ-17 | Struktur PPh & PPN Indonesia: angka final fee vs beban | UNRESOLVED |
| OQ-18 | Regulasi Indonesia: kewajiban pajak & ambang batas | UNRESOLVED (needs konsultan) |
| OQ-19 | Segregated account: desain pemisahan dana float user dari dana operasional | UNRESOLVED |
| OQ-22 | Fee cash-out customer: nominal/fee penarikan saldo | UNRESOLVED |
| OQ-23 | Konfirmasi "activity threshold" fee dorman ke sales Xendit | DEFERRED (BE — PO 2026-09-22) |
| OQ-24 | Registrasi: nomor WhatsApp wajib — perlu verifikasi OTP atau cukup input E.164 | UNRESOLVED |
| OQ-25 | Fee 0,37 JOD untuk metode legacy (transfer manual, COD cash) | DECIDED (PO 2026-09-22: fee flat 0,37 JOD berlaku semua metode, termasuk legacy) |
| OQ-26 | Provider rate IDR>JOD: pilih provider yang menyediakan JOD (bukan ECB-only) | UNRESOLVED |
| OQ-27 | Sanity check fee flat: fee customer 0,22 JOD (25% dari order Rp20.000) bisa diterima pasar? | UNRESOLVED |
| OQ-28 | Perilaku saat rate API mati: fallback pakai rate terakhir berapa lama? | UNRESOLVED |
| OQ-29 | Dispute: finalisasi window 24 jam, kategori sengketa, SLA resolusi | DECIDED sementara (PO 2026-09-23: dipakai apa adanya sampai volume > 5/bulan) |
| OQ-30 | Dispute: siapa "super admin" secara operasional | RESOLVED (PO 2026-09-23): SA membuat akun operator CS; role/permission ditentukan SA sesuai kebutuhan |
| I-1 | Insentif: fee customer di ketentuan insentif tertulis 0,20 JOD, keputusan PO = 0,22 JOD | RESOLVED (PO 2026-09-22: 0,22 JOD) |
| I-2 | Insentif: modal 5 JOD menggantikan atau menambah deposit COD 3,50 JOD (PRD aktif §5C) | RESOLVED (PO 2026-09-22: terpisah — kredit sistem non-tunai, bukan ganti/tambah deposit) |
| I-3 | Insentif: cashback masuk dompet deposit merchant — non-withdrawal atau bisa ditarik | RESOLVED (PO 2026-09-23: non-withdrawal, hanya untuk pemakaian in-app) |
| I-4 | Insentif: periode tier (bulan kalender?) + perlakuan naik tier di tengah bulan | UNRESOLVED |
| I-5 | Insentif: kuota Founding (dibatasi jumlah merchant?) dan durasi berlaku | UNRESOLVED |
| I-6 | Insentif: sisa modal 5 JOD kalau merchant berhenti — hangus atau utang | RESOLVED (PO 2026-09-23: hangus) |

### Closed questions (resolved in source)
| OQ# | Resolution |
|---|---|
| OQ-1 | Merchant setor GST makanan, platform setor GST fee (Section VAT dua lapis) |
| OQ-9 | Komisi 8% diganti flat fee JOD (merchant 0,15 + customer 0,22) |
| OQ-10 | Deposit kurir: bukan urusan platform (kurir diurus merchant) |
| OQ-11 | Holding earnings kurir: bukan urusan platform |
| OQ-12 | Protection fund: 2% dari fee platform |
| OQ-20 | Konversi IDR>JOD: dibatalkan |
| OQ-21 | Wise API: tidak dipakai |

## Repo impact and evidence

Target implementasi: repo ini (`sa7tein-pwa`) — Vite + TS + React 19 + Redux Toolkit + SCSS, 3 role (customer, merchant, courier) + Super Admin yang belum dibangun. Referensi UI/UX 4 portal ada di `repo-sa7tein-schema.md` (repo terpisah, bukan target).

### Existing files — affected by new requirements
| File | Requirement | Status | Notes |
|---|---|---|---|
| `src/types.ts` | R-FEE-01, R-WALLET-01, R-COD-01, R-CURR-01, R-TAX-01, R-TOPUP-01, R-LEDGER-01 | **partial** | Ada `PaymentMethodId = 'cod' \| 'transfer'` — perlu tambah `wallet`, `xendit_va`, `xendit_qris`. Ada `OrderStage` (4 stage) — perlu field OTP/SLA. Belum ada sama sekali: `Wallet`, `TopUp`, `Payout`, `VAT`, `ExchangeRate`, tipe dispute. |
| `src/data/merchant.ts` | R-FEE-01, R-COD-01, R-CURR-01 | **partial** | Ada `PAYMENT_METHODS` (2 item: cod, transfer) — perlu diperluas ke 5+. Belum ada konstanta `PLATFORM_FEE_MERCHANT_JOD`, `PLATFORM_FEE_CUSTOMER_JOD`, `MIN_TOPUP_NEW_ACCOUNT_JOD`. |
| `src/store/slices/cartSlice.ts` | R-WALLET-01, R-COD-01, R-TOPUP-01 | **partial** | Ada `orderStage`, `selectedPaymentId`, `transferProof` — belum ada `walletBalance`, `topUpHistory`, `payoutHistory`, branch hold/settle. |
| `src/store/index.ts` | R-WALLET-01 | **absent** | Whitelist persist: `cart`, `favorites`, `accountSetup`, `catalog`. State wallet belum ada dan belum masuk whitelist. |
| `src/App.tsx` | R-WALLET-01, R-DISPUTE-01 | **absent** | 46 rute ada, tapi belum ada rute wallet, dispute, atau super admin. |
| `src/components/OrderStageScreen.tsx` | R-DELIV-01 | **partial** | Ada 4 stage perjalanan — belum ada tombol checkpoint, verifikasi OTP, tampilan timer SLA, indikator auto-settle. |
| `src/pages/Checkout.tsx` | R-FEE-01, R-COD-01, R-TAX-01 | **partial** | Ada: daftar item, alamat, ongkir per zona, subtotal+total. Belum ada: breakdown fee (merchant 0,15 + customer 0,22), selector wallet, gate top-up, baris pajak. |
| `src/pages/NotificationSettings.tsx` | R-PUSH-01 | **partial** | Ada UI pengaturan notifikasi — belum ada pendaftaran push subscription atau konfigurasi fallback WA. |

### New files needed (when revision is activated)
| File | Requirement | Purpose |
|---|---|---|
| `src/pages/WalletBalance.tsx` | R-WALLET-01 | Saldo wallet per role (available + pending) |
| `src/pages/WalletTopUp.tsx` | R-TOPUP-01 | Layar top-up (mock Xendit VA/QRIS) + gate 3,5 JOD |
| `src/pages/WalletPayout.tsx` | R-WALLET-01 | Withdraw/payout (fee cash-out masih UNRESOLVED) |
| `src/pages/DisputeSubmit.tsx` | R-DISPUTE-01 | Pengajuan sengketa (customer/merchant) |
| `src/pages/SuperAdminQueue.tsx` | R-DISPUTE-01 | Queue dispute super admin + 4 resolusi |
| `src/pages/OrderOtpVerify.tsx` | R-DELIV-01 | Layar verifikasi OTP 4-digit |
| `src/store/slices/walletSlice.ts` | R-WALLET-01, R-INCENTIVE-01 | State wallet (balance, topUpHistory, payoutHistory) + dompet deposit merchant + `merchant_credit` + state rebate tier |
| `src/store/slices/disputeSlice.ts` | R-DISPUTE-01 | State dispute (daftar sengketa, resolusi) |
| `src/pages/MerchantRebate.tsx` | R-INCENTIVE-01 | Modal credit terpakai + progress tier bulan berjalan + riwayat cashback |

### Files NOT affected (confirmed no change needed)
- `src/pages/MerchantDashboard.tsx` — mungkin perlu widget saldo, bukan inti
- `src/components/ui/FoodCard.tsx` — tidak berubah
- `src/components/layout/BottomNav.tsx` — tidak berubah (mungkin perlu entri nav wallet)

### AGENTS.md section 9 note
Super Admin dashboard kemungkinan perlu pengecualian shell lebar penuh (AGENTS.md §9: "Shell 430px kemungkinan salah untuk Super Admin. Ia dashboard dengan tabel. Kalau memang perlu lebar penuh, jadikan pengecualian yang didokumentasikan di /documentation"). Berlaku untuk R-DISPUTE-01 (queue dispute super admin).
