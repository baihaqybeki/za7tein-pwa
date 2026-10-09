# Peta Bisnis Flow — Sa7tein Irbid MVP

Lapisan **bisnis** untuk semua flow di `docs/design/flows/`. Dibaca **sebelum** membuka/menyunting diagram: tiap flow punya masalah bisnis, aktor, nilai, dan dasar keputusan. Diagram hanya bentuk layar dari tabel di bawah — kalau baris di sini kosong atau `proposed`, jangan gambar seolah sudah diputuskan.

**Sumber (jangan dikarang):**
- PRD aktif `docs/product/prd/versions/irbid-mvp-v2-2026-09-21/` — `source.md`, `analysis.md`, `milestones.md` (manifest: `docs/product/prd/manifest.json`)
- Keputusan produk: `C-01…C-19` (`analysis.md`), `DEC-1037` / `DEC-1038` / `DEC-1039`, update PO 2026-09-21
- `docs/product/schema-draft-v1.md` — **rancangan data, bukan requirement.** Boleh dipakai untuk nama tabel/field, tidak boleh jadi dasar bisnis
- Repo ini **front-end saja** (AGENTS.md §1) — semua angka di bawah adalah aturan bisnis yang ditampilkan sebagai mock

**Status:**
| Status | Arti |
|---|---|
| `decided` | ada dasar PRD/keputusan; angka final atau angka kerja yang sudah dipakai |
| `partial` | arah sudah diputuskan, sebagian parameter masih UNRESOLVED (lihat kolom Catatan) |
| `proposed` | **tidak ada dasar di PRD aktif** — masih usulan, butuh keputusan PO sebelum dianggap requirement |

---

## 1. Bisnis intinya dulu (konteks semua flow)

- **Produk:** food delivery + e-wallet untuk **diaspora Indonesia di Irbid, Jordan**. Semua pengguna memakai **bank Indonesia**, jadi jalur pembayaran Indonesia (Xendit) yang dipakai — uang tidak pernah menyentuh sistem Jordan (source §Latar Belakang, §2).
- **Settlement IDR penuh, JOD display-only** (C-14). Rate di-sync 1×24 jam; Wise dibatalkan (update PO #6, OQ-20/21 closed).
- **Model pendapatan:** flat fee **0,37 JOD/order** = merchant 0,15 + customer 0,22 (update PO #1–2). Komisi 8% **dihapus**.
- **Unit economics per order** (ilustrasi rate 1 JOD = Rp23.000, subtotal Rp100.000 + ongkir Rp10.000):
  - customer bayar ≈ Rp115.060 → merchant terima Rp106.550 (ongkir 100% merchant, C-07) → platform Rp8.510
  - biaya platform ≈ Rp1.143 (QRIS 0,7% + PPh 0,5% + protection fund 2% + payout amortized) → **profit ≈ Rp7.367/order**
  - **fee flat, bukan persen:** order Rp20.000 dan Rp500.000 sama-sama menghasilkan Rp8.510; break-even sisi atas ≈ Rp1,17jt top-up
  - break-even biaya tetap ≈ **111 order/bulan** (dorman Xendit USD50 ≈ Rp815rb)
- **3 titik boncos yang wajib diatur:** (1) cash-out saldo customer tanpa order → rugi ≈Rp3.200/kejadian; (2) order batal refund full → ≈Rp805; (3) volume < 111 order/bulan (source §Unit economics).
- **Kurir = karyawan merchant**, bukan entitas platform; platform tidak assign kurir dan tidak menahan dana kurir (C-06). Ongkir 100% merchant (C-07). Wallet kurir **hanya tips** (source §Tips).
- **Tip (source:78-84, lintas flow f1/f3/f4/f6/f13/f15/f19):** sukarela, 100% ke kurir tanpa komisi platform, dipotong dari wallet customer, dipilih saat checkout **atau setelah terima** — yang "setelah terima" **digabung ke prompt pasca-order `f19`** (keputusan PO 2026-09-22, bukan layar terpisah). Masuknya gratis (QRIS sudah dibayar saat top-up), yang berbiaya cuma keluarnya (payout Rp2.500) → withdraw menunggu **akumulasi ambang minimum** (`f6`); kalau tidak, asumsi "payout amortized Rp2.500 ÷ ±20 order/withdraw" (`source:621`) jebol. **UNRESOLVED:** angka ambang minimum withdraw. Fee payout tips **RESOLVED (PO 2026-09-22): ditanggung kurir** — dipotong dari nilai withdraw, bukan beban platform (`source:84`), jadi asumsi boncos platform di `source:621` tidak berlaku untuk tips.
- **Referensi UI/UX:** 4 portal `baihaqybeki/sa7tein` (termasuk portal CS) — acuan bentuk layar, **bukan** target implementasi; konflik aturan sudah diputuskan di C-06…C-19.

---

## 2. Tabel bisnis per flow

| Flow | Masalah bisnis | Aktor | Nilai / angka bisnis | Dasar | Status | Catatan (UNRESOLVED) |
|---|---|---|---|---|---|---|
| **f1 order-lifecycle** | Diaspora Irbid butuh kirim makanan dengan pembayaran yang bisa dipercaya dua sisi | customer, merchant, kurir | engine inti: tiap order = Rp8.510 pendapatan platform | R-COD-01, R-DELIV-01, R-TOPUP-01, R-FEE-01, C-06…C-11 | decided | SLA timer 15/30/10 sementara (OQ-13) |
| **f2 cod-hold** | COD tunai berisiko (kurir bawa uang, customer tak bayar) | customer, merchant | Wallet reserve (prepaid & COD): saldo di-reserve saat order, berkurang saat order done → merchant kena fee 0,15 saat settle, tidak ada uang fisik | R-COD-01, PO 2026-09-25, C-08 | decided | saldo tidak berkurang saat order; batal sebelum done = release reserve |
| **f3 wallet-topup** | Semua user bank Indonesia, tapi butuh saldo internal yang murah diputar | customer, merchant, kurir | Xendit hanya 2 titik (top-up & payout); transaksi antar-wallet = ledger internal tanpa fee. Gate top-up **3,5 JOD ≈ Rp80.500** menyaring akun sampah & menutup fee payout tetap | R-WALLET-01, R-TOPUP-01, C-14 | decided | withdrawability cashback merchant (I-3) |
| **f4 fee-tax** | Fee persen (8%) tidak cocok untuk order kecil Irbid | platform, merchant, customer | flat **0,37 JOD/order**; GST 2 lapis (makanan 16% disetor merchant, fee platform disetor platform) + PPh final 0,5% | R-FEE-01, R-TAX-01, OQ-25 | partial | tarif GST makanan, PPN ekspor jasa, status PKP (OQ-2/3/4/17/18) — butuh konsultan pajak |
| **f5 delivery-verification** | "Kurir bilang sudah kirim" tidak bisa dibuktikan | kurir, customer, merchant | settle **hanya** lewat OTP 4 digit customer; tanpa GPS realtime (hemat, C-10) → checkpoint + SLA + 1 snapshot geolokasi + foto | R-DELIV-01, C-09, C-10 | partial | % penalti customer lalai (OQ-14); SLA final (OQ-13) |
| **f6 cashout-payout** | Uang keluar sistem = titik rugi | customer, merchant, kurir | wajib ada supaya orang mau top-up; **tanpa fee cash-out rugi ≈Rp3.200/kejadian** → perlu fee/minimum/batas; tips kurir: withdraw menunggu akumulasi + **fee payout ditanggung kurir** (PO 2026-09-22) | R-CASHOUT-01, R-WALLET-01, source §Unit economics, source §Tips | partial | flow cash-out (OQ-16) & fee penarikan (OQ-22) belum final — blocker M3 · ambang minimum withdraw tips belum ada angkanya |
| **f7 ledger-liability** | Uang user ada di saldo platform = utang, bukan aset | platform | double-entry, append-only, kronologis; saldo Xendit harus ≥ total liability wallet, kalau kurang → flag | R-LEDGER-01 | decided | jadwal settlement liability belum diputuskan |
| **f8 dispute** | Sengketa uang antar pihak butuh jalur resmi | customer, merchant, Super Admin | 4 resolusi (refund penuh/sebagian/release/tolak), hold dibekukan, auto-settle pause; kasus tanpa pihak bersalah dari **protection fund 2%** fee platform | R-DISPUTE-01, C-12, OQ-12 | partial | window 24 jam, kategori, SLA (OQ-29) ditunda sampai volume > 5/bulan; siapa admin (OQ-30) |
| **f9 incentive** | Merchant baru perlu alasan ikut di marketplace kosong | merchant, platform | modal **5 JOD non-withdrawal** (≈33 order pertama) + cashback tiered 15/40/62,5 JOD → fee efektif turun sampai 0,10 JOD/porsi; konsekuensi: profit/order turun ke ≈Rp6.217 di Tier 3 | R-INCENTIVE-01, update PO #7, I-1/I-2 resolved | partial | I-3 withdrawability, I-4 periode tier, I-5 kuota Founding, I-6 sisa modal |
| **f10 exchange-rate** | Harga dirasa dalam JOD, uang mengalir dalam IDR | platform | semua hitungan server pakai IDR; JOD hanya render; rate 1×24 jam + fallback cache terakhir | R-CURR-01, C-14, OQ-20/21 closed | partial | provider rate JOD (OQ-26), umur cache saat API mati (OQ-28) |
| **f11 push-notification** | Order berubah saat app ketutup | customer, merchant, kurir | Web Push payload ≤4KB + TTL + `userVisibleOnly`; iOS wajib install (16.4+), force-quit = bisu, ITP 7 hari; fallback deep link `wa.me` | R-PUSH-01, C-18 | partial | OQ-24 RESOLVED (PO 2026-09-22): Level 1, tanpa OTP; WA Business API L2 TIDAK dipakai (PO 2026-09-23); uji push di device belum |
| **f12 merchant-console** | Merchant perlu kendali antrean & kurir tanpa operasi platform | merchant, kurir | platform **tidak** assign kurir (C-06) & ongkir 100% merchant (C-07) → beban operasi kurir pindah ke merchant; maks 3 kurir | C-06, C-07, plan-merchant M0–M7, R-COD-01 | partial | merchant sebagai pihak bersengketa (OQ-30); nav merchant belum diputuskan |
| **f13 courier-view** | Kurir adalah karyawan merchant, bukan mitra platform | kurir, merchant, customer | platform tidak menahan dana kurir; gaji dari merchant; wallet kurir **hanya tips** (100% ke kurir, tanpa komisi) | C-06, R-DELIV-01, source §Tips | partial | SLA final (OQ-13), penalti customer lalai (OQ-14); label "Mulai Antar"/lantai-unit tak ada di PRD v2 |
| **f14 chat-order** | Komunikasi 3 pihak pindah ke WA pribadi → konteks & bukti hilang | customer, merchant, kurir | **in-app chat dipertahankan** sebagai kanal order; 1 thread per order (maks 3 peserta); kurir masuk saat `courier_match`; sengketa menaikkan prioritas thread, bukan bikin thread baru | **C-18** (in-app chat), C-12 (dispute) | decided | retensi chat setelah `done` (N hari) belum ditentukan; media/gambar & push chat belum |
| **f15 super-admin** | COD & deposit butuh pengawasan manusia; sengketa butuh wasit | Super Admin (portal CS), merchant | portal **CS merangkap Super Admin** (C-12): approve tenant + verifikasi deposit, blacklist COD (`tenantStatus` + `customer.riskFlag`), dashboard liability, queue dispute | C-12, PRD §5C (deposit), R-DISPUTE-01 | partial | siapa admin operasional, multi-admin, audit trail (OQ-30); jadwal settlement liability |
| **f16 merchant-onboarding** | Marketplace butuh merchant serius, bukan akun sampah | merchant, Super Admin | deposit COD **3,50 JOD** (PRD §5C) + kredit Founding 5 JOD **terpisah**, bukan pengganti deposit (I-2 resolved) → filter komitmen sekaligus modal awal | PRD §5C, I-2, C-12 | partial | AUTH-1 (provider auth, OTP email vs WA); mekanisme verifikasi deposit; dokumen legal merchant |
| **f17 payment-xendit** | Harus ada jalan uang masuk/keluar yang murah & tidak bisa dobel | customer, platform, Xendit | Xendit menang: 1 akun untuk VA/QRIS + payout + account-name-check; QRIS 0,7% (termurah), payout Rp2.500/transfer, settlement H+2; wajib `idempotency-key` + `reference_id` | C-01, DEC-1039, source §2/§Biaya Xendit | decided | strategi idempotency key (schema belum punya `xenditInvoiceId`), retry webhook, expiry VA, siapa verif transfer manual |
| **f18 order-state** | Status order tercecer di banyak flow → laporan & ledger tidak sinkron | platform, semua role | **enum 9 status dipertahankan** + `hold_status` sub-state + state dispute (C-17); `paymentStatus` disinkronkan, bukan jadi state; `placedAt` = gerbang SLA | C-17, schema entri 9, DEC-1037 | partial | istilah `quotation` vs `placed` belum disamakan; jendela cancel 10 menit belum final |
| **f19 rating-review (+ tip)** | Pembeli belum punya sinyal kualitas; merchant baru & lama tampil sama. Sekaligus: PRD membolehkan tip **setelah terima**, tapi tidak ada layarnya | customer, merchant, kurir | Sinyal kualitas + masukan konkret. Satu penilaian per order: bintang merchant (wajib) + kurir (bila ada) + per hidangan (opsional) + teks/tag (opsional); tampil sebagai rata-rata & distribusi; merchant bisa membalas. **Tip kurir digabung di layar pasca-order ini** (PO 2026-09-22): opsional, 100% ke kurir, dari wallet customer; withdraw di `f6`. Rating **bukan** jalur sengketa dan tanpa insentif | **BRS `rating-review-2026-09-22`** (BR-1…BR-11 + catatan layar tip) · PRD §Tips · PO 2026-09-22 · silang C-06, C-12 | partial | Revisi BRS `proposed` · jendela pengisian, edit/hapus, daftar tag, batas balasan, moderasi, ambang rata-rata · tip: ambang withdraw (`f6`; fee payout sudah diputuskan ditanggung kurir) |
| **f20 address-zone** | Ongkir & jangkauan harus jelas sebelum order dibuat | customer, merchant | **2 zona Hijazi / Syimali, ≤2 km haversine dari dapur merchant**, per-merchant `is_active_hijazi` / `is_active_syimali` (C-13); ongkir 100% merchant (C-07); zona di-snapshot ke order | C-13, C-05, C-07, schema entri 2/4 | decided | angka `radiusMeters` & tier fee final; apakah master zona jadi tugas Super Admin; alamat di luar coverage boleh disimpan? |
| **f21 account-auth** | Nomor WA satu-satunya kanal kontak kurir↔customer + fallback `wa.me`, tapi registrasi tidak punya alur dan tidak ada verifikasi nomor → nomor palsu = order gagal antar | customer, merchant, kurir | Masuk dengan **login Google** (menggantikan sandi) → **nomor WA wajib (E.164)** → verifikasi format (Level 1) → lanjut peran: customer kena gate top-up 3,5 JOD (`f3`), merchant/kurir diserahkan ke `f16` (deposit 3,50 JOD + approval SA) | PRD §Registrasi `source.md:760` + E.164 `:727` + gate top-up `:641`/`:653` + keputusan PO 2026-09-22 (Google + nomor WA, Level 1) | decided | apakah merchant/kurir juga boleh Google · sesi/token & PIN belum berdasar PRD · verifikasi otomatis (Level 2) ditunda |

---

## 3. Koreksi yang harus dilakukan di flow (temuan dari peta ini)

| Flow | Masalah | Perbaikan | Status |
|---|---|---|---|
| f20 | Memakai zona **A/B/C 600 m/1,5 km/2 km + tarif 5.000/9.000/13.000** dari `src/data/merchant.ts` — itu **LEGACY PRD lama**, PRD aktif = **Hijazi/Syimali ≤2 km** (C-13) | Diagram & README diganti ke Hijazi/Syimali ≤2 km; A/B/C tetap disebut sebagai legacy; `R-ADDR-01` kini diturunkan dari C-13/C-05/C-07 | **selesai** |
| f19 | Digambar `done` padahal tidak ada requirement di PRD aktif | Keputusan PO 2026-09-22: rating masuk MVP. BRS `rating-review-2026-09-22` dibuat lewat alur intake (status `proposed`), diagram diselaraskan (bintang merchant/kurir/hidangan + tampilan ulasan + balasan) | **selesai** (aktivasi manifest menunggu keputusan) |
| f14 | Diberi label `R-CHAT-01 synthetic` dari schema draft, padahal dasarnya **C-18 (in-app chat dipertahankan)** | Ikat ke C-18 + C-12; skema draft hanya nama field | **selesai** |
| f15 | Label `synthetic`; node deposit tidak menampilkan nominal; dasar sebenarnya C-12 + PRD §5C | Ikat ke `C-12` + §5C + `R-DISPUTE-01`; sublabel deposit jadi `3,50 JOD · unpaid → held` | **selesai** |
| f16 | Label `synthetic` **dan hilang elemen bisnisnya**: kredit Founding 5 JOD + cashback tiered tidak ada di diagram padahal BUSINESS.md & PRD §Insentif menyebutnya | Tambah node `Kredit Founding` (5 JOD non-withdrawal) setelah deposit + aturan keras terpisah-dari-deposit (I-2); dasar = §5C + §Insentif + I-1/I-2 + C-12 | **selesai** |
| f18 | `R-STATE-01 synthetic`; dasar sebenarnya **C-17** (extend enum) | Ikat ke `C-17` + `DEC-1037` | **selesai** |
| f17 | `R-PAY-01 synthetic`; dasar sebenarnya **C-01 + DEC-1039 + OQ-25** | Ikat ke keputusan itu | **selesai** |
| f15 | Dashboard liability disebut "hutang platform ke merchant/kurir" — menyiratkan platform menahan gaji kurir, padahal kurir digaji merchant (`C-06`) | Isi liability = saldo wallet customer + merchant + tips kurir belum di-payout; gaji kurir tidak masuk | **selesai** |
| f6 | Kartu hanya bilang "fee cash-out UNRESOLVED" tanpa **alasan bisnisnya** — pembaca tidak tahu kenapa fee itu wajib | Tambah alasan unit economics: tanpa fee platform rugi ≈Rp3.200/kejadian | **selesai** |
| f9 | Kartu tidak menyebut fee customer tetap 0,22 selama promo (I-1 RESOLVED) — padahal ini yang membedakan kredit Founding dari diskon | Tambah "fee customer tetap 0,22 (I-1)" di kartu modal | **selesai** |
| tip | Layar "kasih tip setelah terima" (PRD §Tips) tidak ada di repo dan tidak jelas flow-nya; aturan withdraw tips juga belum muncul | Digabung ke prompt pasca-order `f19` (PO 2026-09-22): prompt "nilai + tip", node form "teks, tag & tip"; aturan withdraw tips masuk `f6`; dua titik masuk tip dicatat di `f4`; catatan di `f1`. Teks lama "layar setelah-terima belum ada" di `f1`/`f4` sudah dibersihkan → menunjuk `f19` | **selesai** |
| fee payout tips | `source.md:84` menyerahkan pilihan ke PO: platform yang menanggung, atau pass ke kurir | **Keputusan PO 2026-09-22: ditanggung kurir** — dipotong dari nilai withdraw, bukan beban platform; `source.md:84` diperbarui, UNRESOLVED dicabut dari `f6`/`f19`/`BUSINESS.md` | **selesai** |
| INDEX trace | Trace masih memakai key `R-CHAT-01`, `R-SA-01/02`, `R-ONBOARD-01`, `R-PAY-01`, `R-STATE-01` (synthetic) padahal flow-nya sudah diikat ke C-*/PRD | Key diganti ke dasar sebenarnya + `note`; `R-WALLET-01` ditambah `f19:teks` (tip) | **selesai** |
| f20 | Diagram tidak punya kartu bisnis — pembaca bingung skenarionya (harus buka README/BUSINESS.md dulu) | **Kartu pertama tiap diagram = "Bisnis: kenapa flow ini ada"** (masalah · aktor/nilai · skenario), lalu kartu alur/guard/sumber | **pola dibuat di f20** — rollout 19 flow lain belum |
| 13 flow | Node bertipe `backend` di flow user-facing (f1, f3, f4, f6, f8, f9, f11, f12, f13) — f7/f10/f17 memang diagram sistem, biarkan | Sweep `backend` → `frontend`/`security` | **ditunda** (keputusan PO 2026-09-22: biarkan dulu) |
| registrasi & auth | Area bisnis tanpa flow sama sekali; AUTH-1 (verifikasi nomor) diputuskan: Level 1 (format + E.164), tanpa OTP | **f21 account-auth** dibuat: Google + nomor WA wajib + OTP WA (keputusan PO 2026-09-22); `source.md:760` diperbarui; PRD sha + manifest diperbarui | **selesai** |

---

## 4. Urutan kerja yang benar (jangan dibalik)

1. **Bisnis** — baris flow di §2 terisi dan `decided` (atau sadar `proposed`).
2. **Requirement** — turunkan jadi `R-*` di PRD aktif; kalau belum ada, masuk intake `docs/product/prd/inbox/` (lihat `docs/product/prd/README.md`), status `proposed` sampai diputuskan.
3. **Flow diagram** — baru gambar layar/state dari requirement itu.
4. **UI** — layar di `src/pages/`, state mock di Redux.

Aturan keras: **flow tanpa baris bisnis = jangan digambar.** Kalau ketemu flow yang isinya cuma field tabel, berarti langkah 1 dilewati.

Terakhir diperbarui: 2026-09-22 — audit bisnis + tip: f16 ditambah kredit Founding 5 JOD + cashback tiered; f6/f9 ditambah alasan bisnisnya; label `synthetic` diganti dasar keputusan; **tip kurir digabung ke prompt pasca-order `f19`** (PO 2026-09-22) dengan aturan withdraw di `f6`; trace INDEX dibersihkan dari key synthetic. Sisa: sweep node `backend` (ditunda) + aktivasi BRS rating.
