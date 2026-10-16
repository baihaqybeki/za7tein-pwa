# Analysis / Decision Record: sa7tein-mvp-2026-10-11

Status: REVIEWED — **AKTIF** sejak 2026-10-16 (menggantikan `irbid-mvp-v2-2026-09-21`). Keputusan: `docs/product/prd/decision-sa7tein-mvp.md`.
Sumber: `source.pdf` (47 halaman). Seluruh bagian 1–24 dibaca; isu terbuka ada di bagian 23.

> Keputusan aktivasi 2026-10-16 (PO): PRD ini **diaktifkan** sebagai revisi aktif. Deviasi platform
> disetujui: **backend tetap Supabase** (bukan Cloudflare Workers/DO seperti ARC-01..13), dipetakan
> sedekat mungkin ke PRD dan ditandai `UNRESOLVED`. Lihat `decision-sa7tein-mvp.md`.

> Catatan: dokumen ini **menggantikan model produk, model uang, dan arsitektur backend** yang sekarang.
> Ia bukan revisi kecil dari `irbid-mvp-v2-2026-09-21`. Perbedaan terbesar: backend bukan Supabase,
> melainkan Cloudflare Workers + Durable Objects (ARC-01..13).

## Source inventory
- Version printed in document: tidak dicetak sebagai nomor versi; bertanggal **11 Oktober 2026**.
- Pages/sections read: 1–24 (47 halaman), termasuk tabel keputusan ARC, NFR, risiko R1–R11, OPEN-01..30.
- Produk: **sa7tein — Online Food Marketplace & Delivery (MVP)**, pasar Yordania (Asia/Amman), harga JOD.
- SHA-256: 00427dec72749d6a67e8f3bedec7346ee00f44641d1a1e52c9869b0b45d7cd6c

## Requirement inventory (ID scheme dari sumber)
`ACC-01..05`, `CUS-01..32`, `MER-01..23`, `COU-01..18`, `OPS-01..15`, `ARC-01..13`, `NFR-01..07`,
`L1..L2` (batasan), `R1..R11` (risiko), `OPEN-01..30` (isu terbuka). Judul bagian: 7 order/flow,
9 delivery/dispatch, 10 discovery, 11–14 katalog/menu/atribut, 15–16 uang, 17 monetisasi, 18 dispute,
19 realtime, 20 chat/rating/notifikasi, 21 arsitektur+NFR, 22 batasan/risiko/dependensi, 23 open issues.

## Requirement delta (vs irbid-mvp-v2-2026-09-21)

### Model produk & role
| ID | Sumber | Aturan sekarang | Aturan baru | UI/state | BE contract | Status |
|---|---|---|---|---|---|---|
| — | §1–2 | Radius/geofence 2 km, zona A/B/C, tarif 5k/9k/13k | **Marketplace** multi-merchant; JOD; Yordania | Discovery kota + coverage polygon | Ganti zona→coverage | UNRESOLVED |
| — | CUS-04..09, §10 | Katalog sederhana | Layout ganda, sort jarak/rating/jumlah order/ETA, filter tag | Home/browse | Search & filter lintas instance | UNRESOLVED (OPEN-25) |
| — | MER-01..23 | Merchant console min | Profil, tag global + usul, operasional, katalog ala Odoo, marketing, kuota | Merchant console besar | Banyak (lihat §11–17) | UNRESOLVED |
| — | COU-01..18 | Kurir tunggal | **Kurir inhouse + kurir partner**, 2 jalur | Courier app 2 mode | Batch vs single | UNRESOLVED |
| — | OPS-01..15 | CS panel | **Ops penuh**: verifikasi, moderasi tag, atur semua parameter, dispute, SP, analitik | Superadmin/ops, di balik Cloudflare Access (ARC-10) | Internal app | UNRESOLVED (OPEN-24) |

### Auth
| ID | Sumber | Sekarang | Baru | UI/state | BE | Status |
|---|---|---|---|---|---|---|
| ACC-01 | §6 | Mock/OTP/no guard | **Login email magic link**, semua role | Sign-in semua role | Magic link + sesi | UNRESOLVED |
| ACC-02 | §6 | — | Satu email satu role | — | Constraint | UNRESOLVED |
| ACC-03 | §6 | — | Akun kurir inhouse dibuat merchant | Merchant: kelola kurir | — | UNRESOLVED |
| ACC-05 | §6 | — | Merchant & kurir wajib punya/daftar **akun DANA**; customer tidak | Onboarding DANA | DANA account bind | UNRESOLVED (OPEN-01) |

### Order, delivery & uang (paling mengubah)
| ID | Sumber | Sekarang | Baru | UI/state | BE | Status |
|---|---|---|---|---|---|---|
| — | §7.1 | COD/transfer manual | Bayar online saat order dibuat (QRIS/DANA), ditahan akun enterprise | Checkout | Webhook DANA | UNRESOLVED (OPEN-01) |
| — | §7.2, CUS-18 | Satu mode | **Regular** (kurir inhouse, **batch ≤24**, auto-sort) | Checkout: pilih Regular/Quick | Batch + routes | UNRESOLVED |
| — | §7.3, COU-15 | — | **Quick** (kurir partner, 1 order/waktu) | — | Dispatch partner | UNRESOLVED |
| — | §16.1 | IDR | **JOD 3 desimal**, transaksi in-app IDR, kurs harian | Semua harga/uang | Kurs + pembulatan (OPEN-02, NFR-03) | UNRESOLVED |
| — | §16.3–16.4 | — | Total = S−Dm−Da+F+Pc+Ft; Ft=1,5% (QRIS saja); payout auto saat selesai | Rincian harga & settlement | Ledger + idempotency (NFR-01/02) | UNRESOLVED |
| — | §16.5 | COD umum | **COD hanya bila merchant punya kuota order COD** | COD nonaktif tanpa kuota | Kuota | UNRESOLVED |
| — | §16.6 | — | Refund penuh via DANA, atau **BI-FAST** bila customer tanpa akun DANA (pending refund) | Layar refund | DANA + bank | UNRESOLVED |

### Monetisasi
| ID | Sumber | Sekarang | Baru | UI/state | BE | Status |
|---|---|---|---|---|---|---|
| MER-17..19, §17 | §17 | Free tier kuota 7/10 | **Dua langganan kuota** (order + order COD), setting "Terima order tanpa kuota order?" | Merchant: beli paket, indikator kuota | Ledger langganan | UNRESOLVED (OPEN-29) |
| MER-09, §15 | §15 | — | **Program marketing ala Odoo** (loyalty), `isStackable` | Builder promo | Diskon Dm/Da | UNRESOLVED (OPEN-23) |

### Ops, dispute, chat, rating
| ID | Sumber | Sekarang | Baru | UI/state | BE | Status |
|---|---|---|---|---|---|---|
| MER-22, §18 | §18 | Dispute ringan | **Rule kompensasi & punishment** dikelola ops; merchant multi-select; di-snapshot ke order | Ops: rule; merchant: pilih | Rule engine | UNRESOLVED (OPEN-17/18/19) |
| COU-17, OPS-10 | §9.5, §18 | — | **SP kurir partner** + punishment | — | — | UNRESOLVED (OPEN-13) |
| CUS-26, §20.1 | §20.1 | Chat mock | Group chat per order (teks+gambar di **R2**), auto-close | Chat | R2 + realtime | UNRESOLVED (OPEN-20) |
| CUS-27/28, §20.2 | §20.2 | Rating | Bintang 1–5 merchant + review; rating menu tanpa review; tanpa moderasi | Detail order | — | UNRESOLVED (OPEN-21) |
| §19, §20.3 | §19/20.3 | Notif dasar | Matriks audiens realtime **+ web push**; iOS butuh install | Semua role | WebSocket fan-out | UNRESOLVED |

### Arsitektur & NFR (perubahan platform — kritis)
| ID | Sumber | Sekarang | Baru | UI/state | BE | Status |
|---|---|---|---|---|---|---|
| ARC-01..08 | §21.1 | **Supabase** (Postgres/PostgREST/Edge Fn) | **Cloudflare**: satu Worker → DO(SQLite) + Queue + Workflows + WebSocket | Kontrak Worker | **Tulis ulang backend** | UNRESOLVED |
| ARC-04/05 | §21.1 | Tabel relasional | 1 class DO = 1 domain, 1 instance = 1 row; **Global Index DO** | — | Skema index (OPEN-25) | UNRESOLVED |
| ARC-09 | §21.1 | Supabase Storage | **R2** (logo/cover/menu/chat/bukti dispute) | Upload | R2 | UNRESOLVED |
| ARC-10 | §21.1 | — | Ops di balik **Cloudflare Access/Zero Trust**; analitik Workers | — | — | UNRESOLVED |
| ARC-11 | §21.1 | React SPA (Vite) | React PWA **zero-route SPA berarsitektur SSR**; native pasca-MVP | Kontrak Worker identik | — | UNRESOLVED |
| ARC-12/13 | §21.1 | — | Eksternal: **provider kurs (belum dipilih), Google Maps, DANA**; sistem async/realtime | — | Integrasi | UNRESOLVED |
| NFR-01..07 | §21.2 | — | Idempotency uang, ledger audit, JPEG/IDR rounding, UTC/Asia-Amman, WS resync, versi kontrak, audit ops | — | — | UNRESOLVED |

## Conflicts and open questions
Blocker keras (harus diputuskan sebelum ERD/implementasi; jangan ditebak):
- **OPEN-01 (kritis)**: kapabilitas DANA (daftar 16.7). Menentukan seluruh alur uang. Menunggu sales DANA.
- **OPEN-02**: provider kurs, jam update, fallback bila gagal (R8).
- **OPEN-08**: penarikan dana setelah payout (R6).
- **OPEN-24**: jalur aplikasi ops ke Worker.
- **OPEN-25**: skema Global Index DO + query lintas instance (browse/search) + skala (R3).
- **OPEN-26**: enum final status order & batch.
- **OPEN-27**: daftar periksa legal (22.3) — termasuk penampungan dana & stored value (R2, R10).
- **OPEN-10**: gift card/eWallet di MVP atau tidak.
- **OPEN-17/18/19**: dispute otomatis/manual, rule dasar wajib, batas waktu & akses chat.
- **OPEN-20**: durasi tutup & retensi chat.
- **OPEN-23**: semantik `isStackable`.
- **OPEN-29**: beli paket sejenis saat paket aktif.
- **OPEN-30**: tarif "Bayar pakai DANA".
Sudah diputuskan (dari §23): OPEN-03/04/05/06/07/09/12/13/14/15/16/21/22 — lihat sumber.

Konflik langsung dengan repo:
1. **Platform BE**: PRD menuntut Cloudflare Workers/DO, sedangkan repo sekarang Supabase. Ini **tulis ulang**, bukan penyesuaian.
2. **Scope repo**: AGENTS.md §1 menyatakan repo ini **front-end showcase** tanpa backend/API/pembayaran. PRD ini menuntut backend penuh + DANA + Google Maps.
3. **Auth**: magic link (ACC-01) vs mock/OTP sekarang.
4. **Mata uang & pasar**: IDR/radius → JOD/Yordania.

## Repo impact and evidence
- **Ada & perlu diganti akarnya**: `supabase/00-30-*.sql` + `docs/backend/openapi.yaml` + `src/api/*` (client Supabase).
  Kontrak shell 430px (AGENTS §5) dan design system tetap dipakai; kontrak backend tidak.
- **Bisa dipakai ulang (UI/design system)**: `src/styles/system/*`, komponen `OrderStageScreen`,
  `BottomNav`, `FoodCard`, dsb. Flow `f1/f12/f13` konsep order/batch/kurir masih relevan sebagai bahan,
  tapi aturan bisnisnya berubah.
- **Absen (harus dibangun bila diaktifkan)**: magic link, DANA (pay/payout/refund), kurs+rounding,
  batch Regular + auto-sort Google Routes, dispatch Quick, kuota langganan, marketing loyalty,
  rule dispute/SP, coverage polygon, R2, Cloudflare Access, WebSocket versioning.
- **Governance**: aktivasi PRD ini menuntut re-bind semua flow di `docs/design/flows/INDEX.json`
  ke revisi aktif baru (dienforce `npm run governance:check`) dan pembaruan AGENTS.md/.rules.json/
  `src/pages/Documentation.tsx` pada commit yang sama.

## Rekomendasi
Jangan aktifkan otomatis. PRD ini adalah **pergantian model + platform backend**. Aktifkan hanya bila
keputusan produk tertulis menyetujui: (a) pergantian backend ke Cloudflare Workers/DO, (b) penaklukan
OPEN-01 (DANA) sebagai dependensi keras, (c) lingkup MVP yang disetujui (mana OPEN yang ditunda).
Sampai itu, status tetap `proposed` dan PRD lama tetap aktif.
