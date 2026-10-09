import type { LucideIcon } from 'lucide-react'

// Domain model for the Sa7tein marketplace (PRD v1.1).
// Fields are additive over the original Sa7tein shapes so the ported screens
// keep working while the PRD flows come online.

export interface ModifierOption {
  id: string
  label: string
  extraPrice: number
}

export interface ModifierGroup {
  id: string
  name: string
  /** single = radio (mis. tingkat pedas), multi = checkbox (mis. topping) */
  type: 'single' | 'multi'
  options: ModifierOption[]
}

export interface Food {
  id: string
  name: string
  price: number
  rating: number
  reviewCount: number
  deliveryTime: string
  distance: string
  discountPercent?: number
  category: string
  image: string
  description: string
  isPopular?: boolean
  calories?: number
  /** Estimasi waktu masak (menit) per menu — dipakai UI customer. */
  cookMinutes?: number
  modifierGroups?: ModifierGroup[]
}

export interface MenuItem extends Food {
  stock: number
  available: boolean
}

/** Filter yang diteruskan layar Filter ke Search (satu modul memproduksi, satu membaca). */
export interface SearchFilters {
  maxPrice?: number
  categories?: string[]
}

export interface Category {
  id: string
  label: string
  /**
   * Ikon Lucide, bukan emoji. Emoji dirender berbeda di tiap platform —
   * ukuran, warna, dan gayanya di luar kendali kita — sehingga tidak bisa
   * masuk sistem ikon yang strokenya seragam.
   */
  icon?: LucideIcon
}

export interface Review {
  id: string
  name: string
  avatar: string
  rating: number
  text: string
}

/**
 * Ulasan dari sudut pandang merchant — terikat ke satu hidangan katalog
 * supaya pemilik toko tahu menu mana yang dikomentari. Di luar PRD aktif:
 * FR-MC tidak menyebut ulasan/respons; ditandai UNRESOLVED di
 * docs/product/prd/milestones-irbid-mvp.md.
 */
export interface MerchantReview {
  id: string
  /** `Customer.id` — sebelum ini hanya nama, jadi ulasan tidak bisa ditautkan. */
  customerId: string
  customerName: string
  avatar: string
  rating: number
  text: string
  /** id MenuItem di katalog, mis. 'mm-1' */
  foodId: string
  foodName: string
  createdAt: string
}

/**
 * Zona pengantaran PRD v2 (`C-13`, flow F20) — dua kawasan Irbid: **Hijazi**
 * (pemukiman barat) & **Syimali** (utara kampus), masing-masing ≤2 km Haversine
 * dari dapur merchant. Pita radius A/B/C 600 m/1,5 km/2 km adalah model PRD
 * lama (`radius-mvp-legacy`) dan bukan ketentuan aktif.
 */
export type ZoneId = 'hijazi' | 'syimali'

export interface DeliveryZone {
  id: ZoneId
  label: string
  /** Arah kawasan, dipakai sebagai keterangan di layar. */
  area: string
}

/**
 * Konfigurasi pengantaran merchant (F20/F16) — di produksi dihitung server,
 * di repo ini hanya tampilan mock (AGENTS.md §1). Ongkir **100% milik merchant,
 * 0% fee platform** (`C-07`).
 */
export interface MerchantDeliveryConfig {
  mode: 'radius' | 'area'
  maxKm: number
  isActiveHijazi: boolean
  isActiveSyimali: boolean
  /** Ongkir yang dibayar customer, diteruskan utuh ke merchant. */
  ongkirIdr: number
}

/**
 * Alamat apartemen. PRD mewajibkan gedung, lantai, dan unit karena pin GPS
 * saja tidak cukup untuk kurir menemukan pintu.
 */
export interface Address {
  id: string
  name: string
  /** Alamat utama — dipilih otomatis saat checkout kalau belum ada pilihan. */
  isDefault: boolean
  /** nama gedung / tower */
  building: string
  floor: string
  unit: string
  /** catatan untuk kurir, mis. "Titip lobi" */
  notes: string
  /** jalan / kawasan */
  address: string
  city: string
  fullAddress: string
  lat: number
  lng: number
  /** jarak geodesik ke toko, dasar penentuan coverage */
  distanceMeters: number
  /**
   * Zona hasil validasi server (poligon Hijazi/Syimali + ≤2 km + merchant
   * mengaktifkan zona itu). `null` = di luar coverage. Dihitung di luar repo,
   * layar hanya menampilkan nilainya (flow F20).
   */
  zone: ZoneId | null
}

export interface User {
  id: string
  name: string
  email: string
  /** login utama Sa7tein: nomor HP terverifikasi */
  phone: string
  phoneVerified: boolean
  dob: string
  gender: string
  avatar: string
  addresses: Address[]
}

export type CustomerStatus = 'active' | 'suspended' | 'blacklisted'

/**
 * Satu penandaan risiko customer. Disimpan sebagai **riwayat**, bukan keadaan:
 * sebelumnya `customerRiskFlags` hanya `{ id, name }`, jadi alasan, waktu, dan
 * operator penanda hilang begitu halaman dimuat ulang.
 */
export interface CustomerRiskFlag {
  id: string
  /** `Customer.id` — dulu hanya nama, jadi flag tidak bisa ditautkan ke akun. */
  customerId: string
  reason: string
  at: string
  /** `SaOperator.id` — id, bukan nama, supaya bisa ditautkan ke akun pelaku. */
  byOperatorId: string
}

/**
 * Registri customer platform. Sebelum ini customer hanya hidup sebagai
 * `MerchantOrder.customerName` (string tanpa id), sehingga tidak ada satu pun
 * pertanyaan per-customer yang bisa dijawab — berapa order, kena berapa
 * sengketa, uangnya masuk ledger yang mana.
 *
 * Profil lengkap (alamat, tanggal lahir) tetap di `User`; di sini hanya kolom
 * yang dibutuhkan untuk mengenali dan memantau akun.
 */
export interface Customer {
  id: string
  name: string
  /** E.164 (+962/+62) — identitas utama Sa7tein (R-PUSH-01). */
  phone: string
  phoneVerified: boolean
  avatar: string
  /** Jumlah alamat tersimpan; rinciannya di profil customer. */
  addressCount: number
  status: CustomerStatus
  joinedAt: string
}

export interface Card {
  id: string
  brand: 'visa' | 'mastercard'
  last4: string
  holder: string
  expiry: string
  image: string
}

/** Metode bayar PRD v2: `wallet` (top-up Xendit) + channel VA/QRIS. `cod` & `transfer` legacy. */
export type PaymentMethodId = 'cod' | 'transfer' | 'wallet' | 'xendit_va' | 'xendit_qris'

export interface PaymentMethod {
  id: PaymentMethodId
  label: string
  description: string
}

/** Status transaksi uang (top-up, payout) — R-WALLET-01. */
export type WalletTxStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** Channel top-up Xendit (PRD §2 Xendit). */
export type TopUpChannel = 'xendit_va' | 'xendit_qris'

/**
 * Saldo satu wallet. `pending` = dana hold order berjalan, `available` = sisa yang
 * bisa dipakai. Semua nominal **IDR** — source of truth; JOD hanya tampilan
 * (R-CURR-01), jadi jangan simpan nominal JOD di sini.
 */
export interface Wallet {
  balance: number
  available: number
  pending: number
}

export interface TopUp {
  id: string
  amount: number
  channel: TopUpChannel
  status: WalletTxStatus
  createdAt: string
}

export interface Payout {
  id: string
  amount: number
  status: WalletTxStatus
  createdAt: string
}

/**
 * Rekening pencairan (R-WALLET-01, flow f6). Merchant bisa punya beberapa;
 * tepat satu bertanda `isPrimary` sebagai tujuan default. Menggantikan rekening
 * tunggal read-only `Merchant['bank']`, yang dulu hanya bisa dilihat.
 */
export interface PayoutAccount {
  id: string
  bankName: string
  accountNumber: string
  holderName: string
  isPrimary: boolean
}

/**
 * Satu baris dompet merchant: `settlement` = kredit dari order selesai,
 * `payout` = dana keluar ke rekening. `destination` disimpan sebagai snapshot
 * supaya riwayat tetap terbaca walau rekeningnya kemudian dihapus.
 */
export interface PayoutEntry {
  id: string
  kind: 'settlement' | 'tip' | 'payout'
  amount: number
  status: WalletTxStatus
  createdAt: string
  destination?: string
  /** Fee payout yang dipotong dari nilai withdraw (kurir menanggungnya). */
  fee?: number
}

/** Satu baris tabel `exchange_rates` — rate IDR→JOD, display-only (R-CURR-01). */
export interface ExchangeRate {
  base: string
  quote: string
  rate: number
  fetchedAt: string
  source: string
}

/** Status toko yang tampil di UI customer (open/busy/closed). */
export type StoreStatus = 'open' | 'busy' | 'closed'

export interface Merchant {
  id: string
  name: string
  lat: number
  lng: number
  tier: 'free' | 'pro'
  todayOrderCount: number
  dailyLimit: number
  isActive: boolean
  /** Status toko: buka / sibuk / tutup (satu sumber, menggantikan `available`). */
  storeStatus: StoreStatus
  openTime: string
  closeTime: string
  /** Rating agregat merchant (dari `rating_reviews`) + jumlah ulasan. */
  rating: number
  reviewCount: number
  /** Foto toko (field `photo` D1, f16). Path aset atau object URL sesi unggah. */
  logo: string
  bank: { name: string; account: string; holder: string }
}

/**
 * Registri merchant platform: identitas usaha + keadaan tenant dalam satu
 * record. Ini yang dibaca konsol SA dan panel CS.
 *
 * Sengaja **tidak** mewarisi `Merchant`: `Merchant` adalah profil operasional
 * PWA merchant (koordinat dapur, rekening, jam buka) yang dimiliki satu toko,
 * sedangkan registri ini tentang siapa merchantnya dan bagaimana statusnya di
 * platform. Keduanya terhubung lewat `id` yang sama — dulu `mockMerchant` (id
 * `'1'`) dan daftar CS (id `'am-1'`) tidak punya penghubung sama sekali.
 *
 * Menggantikan `AdminMerchant`.
 */
export interface MerchantRecord {
  id: string
  name: string
  /** Foto/cover toko (path aset lokal). */
  photo: string
  /** Nama pemilik usaha, dipisah dari nama usaha supaya kontaknya bisa disimpan. */
  owner: string
  /** WA pemilik, E.164. Sebelum ini `AdminTenant.owner` hanya nama tanpa kontak. */
  ownerPhone: string
  city: string
  tier: 'free' | 'pro'
  /** Zona master yang diaktifkan merchant (poligonnya milik SA). */
  isActiveHijazi: boolean
  isActiveSyimali: boolean
  tenantStatus: TenantStatus
  deposit: number
  depositStatus: DepositStatus
  /** Riwayat COD bermasalah — dasar aksi blacklist (F15). */
  codIssues: number
  joinedAt: string
  /** `null` selama tenant belum di-approve. */
  approvedAt: string | null
  /** Alasan saat `suspended`/`blacklisted`; `null` saat normal. */
  statusReason: string | null
}

export interface Courier {
  id: string
  merchantId: string
  name: string
  /** Nomor kurir, dipakai tombol "Hubungi" di halaman pelacakan. */
  phone: string
  /** Verifikasi nomor kurir. Sebelum ini hanya customer yang punya flag ini. */
  phoneVerified: boolean
  status: 'at_store' | 'delivering' | 'offline'
  activeOrderCount: number
  joinedAt: string
}

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image: string
  /** ringkasan modifier terpilih, mis. "Pedas Sedang, + Lontong" */
  modifiers?: string
}

/** Empat tahap perjalanan pesanan, dipakai Sa7tein Journey Line. */
export type OrderStage = 'diterima' | 'dimasak' | 'diantar' | 'tiba'

export type NotificationKind = 'order' | 'promo' | 'payment' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  time: string
  unread: boolean
  /** Nada notifikasi (key dari NOTIFICATION_SOUNDS) — audio push. */
  sound?: string
  /** Peran penerima; `undefined`/`'all'` = tampil di semua sisi. */
  audience?: ChatRole | 'all'
}

export type ChatRole = 'customer' | 'merchant' | 'courier' | 'cs'

/** Peserta satu thread chat (maks 3: customer, merchant, kurir) — C-18. */
export interface ChatParticipant {
  userId: string
  role: ChatRole
}

/** Thread chat per order (tabel `chats`). */
export interface ChatThread {
  id: string
  orderId: string
  participants: ChatParticipant[]
  lastMessage?: string
  lastAt: string
}

/** Satu pesan (tabel `chat_messages`). `readAt` null = belum dibaca penerima. */
export interface ChatMessage {
  id: string
  chatId: string
  senderId: string
  senderRole: ChatRole
  body: string
  at: string
  readAt?: string | null
}

export type BatchStatus = 'prepare' | 'closed' | 'waitingCourier' | 'waitingDelivery' | 'delivery'

/**
 * Batch pengantaran (tabel `batches`, ERD): sekumpulan order satu merchant yang
 * disiapkan bersama lalu diantar oleh satu kurir. Mengikuti state machine F12:
 * `prepare` → `closed` → (`waitingCourier` | `waitingDelivery`) → `delivery`.
 */
export interface OrderBatch {
  id: string
  merchantId: string
  orderIds: string[]
  courierId?: string
  status: BatchStatus
  etaPrepareSeconds: number
  etaDeliverySeconds: number
  /** Epoch ms — tenggat SLA; `escalatedToAdmin` bila terlewat. */
  slaPrepareDeadline?: number
  slaDeliveryDeadline?: number
  escalatedToAdmin: boolean
  createdAt: number
}

/**
 * Subscription Web Push (R-PUSH-01, M8). Bentuknya mengikuti kontrak BE
 * (`endpoint`, `keys`, `platform`, `expiresAt`); di repo ini registrasinya mock —
 * tidak ada service worker push yang mengirim (AGENTS §1).
 *
 * Namanya diberi akhiran `Record` supaya tidak bentrok dengan `PushSubscription`
 * milik DOM — kalau namanya sama, TypeScript diam-diam memakai tipe global dan
 * errornya baru muncul jauh dari penyebabnya.
 */
export interface PushSubscriptionRecord {
  endpoint: string
  keys: { p256dh: string; auth: string }
  platform: string
  /** ISO — kapan subscription perlu diperbarui. */
  expiresAt: string
}

/** Status order dari sudut pandang merchant. Menumpang `OrderStage` yang sudah ada. */
export type MerchantOrderStatus = 'masuk' | OrderStage | 'selesai' | 'ditolak' | 'batal'

export interface MerchantOrder {
  id: string
  code: string
  /** `Customer.id` — kunci yang membuat order bisa dihitung per customer. */
  customerId: string
  customerName: string
  buyerAvatar: string
  buyerRating: number
  address: string
  items: CartItem[]
  total: number
  distanceMeters: number
  zone: ZoneId
  status: MerchantOrderStatus
  placedAt: string
  paymentMethod: PaymentMethod['id']
  cookMinutes?: number
  /**
   * `Courier.id` yang dipilih merchant untuk order ini. Platform tidak pernah
   * menugaskan kurir (C-06) — kurir karyawan merchant, jadi rujukan ini hanya
   * diisi dari aksi merchant (F12 `:assign` → `hold_cut`).
   */
  courierId?: string
}

/**
 * Checkpoint pengantaran dari sisi kurir. Sumbu ini cermin urutan flow F13
 * (`docs/design/flows/f13-courier-view/`) — masuk → ambil → berangkat → tiba →
 * (OTP) → selesai, plus cabang `batal` saat customer lalai. Berbeda dari
 * `OrderStage` (sumbu customer/merchant): kurir menekan aksi, customer melihat
 * tahap. Layar detail menampilkan keduanya berdampingan.
 *
 * Catatan: node `otp` di flow bukan state tersimpan — ia langkah di dalam
 * state `tiba` (sudah tiba, menunggu kode customer). Karena itu nilai di sini
 * berhenti di `tiba`, dan stepper menampilkan `otp` sebagai langkah kelima.
 */
export type CourierCheckpoint =
  | 'masuk'
  | 'ambil'
  | 'berangkat'
  | 'tiba'
  | 'selesai'
  | 'batal'

/** Satu tugas pengantaran milik kurir toko (PRD M4/M5). */
export interface CourierTask {
  id: string
  code: string
  /** `Customer.id` — sama dengan yang dipakai order, jadi satu orang satu kunci. */
  customerId: string
  customerName: string
  /** Nomor customer, dipakai tombol "Hubungi customer" saat guard customer lalai. */
  customerPhone: string
  /** Jalan / kawasan alamat tujuan. */
  address: string
  /** Lantai & unit wajib — pin GPS saja tidak cukup untuk kurir (PRD bab 04). */
  floor: string
  unit: string
  items: CartItem[]
  total: number
  distanceMeters: number
  zone: ZoneId
  paymentMethod: PaymentMethod['id']
  /** Tips customer. Kurir karyawan merchant: hanya tips yang jadi miliknya (C-06). */
  tip: number
  /** Tahap order dari sisi customer/merchant, dipakai Journey Line. */
  orderStage: OrderStage
  checkpoint: CourierCheckpoint
  /** Waktu mulai jeda checkpoint ini — dasar hitung mundur SLA. */
  checkpointStartedAt?: string
  /** Kode OTP 4 digit dari customer. Tanpa OTP kurir tidak bisa settle (C-09). */
  otp: string
  otpVerified?: boolean
}

/**
 * Status tenant merchant. `pending` menunggu approval tim CS; `blacklisted`
 * lahir dari aksi blacklist COD dan wajib dibarengi `riskFlag` customer (F15).
 */
export type TenantStatus = 'pending' | 'approved' | 'suspended' | 'blacklisted'

/** Deposit COD merchant (3,50 JOD, PRD §5C). Approve = verifikasi transfer dulu. */
export type DepositStatus = 'unpaid' | 'held' | 'released'

/** Antrean onboarding tenant di panel admin (CS) — feeder F16. */
export interface AdminTenant {
  id: string
  name: string
  owner: string
  city: string
  submittedAt: string
  /** Jumlah foto tempat usaha yang diunggah merchant saat onboarding. */
  photoCount: number
  /** Konfigurasi pengantaran yang diajukan merchant. */
  deliveryConfig: MerchantDeliveryConfig
  deposit: number
  depositStatus: DepositStatus
  tenantStatus: TenantStatus
}

export type DisputeStatus = 'open' | 'investigating' | 'resolved' | 'rejected'

/** Empat resolusi F8. `no_action` = tolak, tanpa ubah saldo. */
export type DisputeResolution =
  | 'refund_full'
  | 'refund_partial'
  | 'released'
  | 'no_action'

/** Sengketa satu order. `disputed` membekukan hold sampai SA memutuskan (M6). */
export interface Dispute {
  id: string
  orderCode: string
  /** Pihak yang mengajukan; form submit ada di sisi customer dan merchant. */
  filedBy: 'customer' | 'merchant'
  /** `Customer.id` atau `MerchantRecord.id`, mengikuti `filedBy`. */
  partyId: string
  /** Nama pihak pengaju (tampilan). */
  party: string
  /** `Customer.id` pemilik order yang disengketakan — terpisah dari `partyId`. */
  customerId: string
  /** `MerchantRecord.id` — dulu hanya nama, jadi sengketa per merchant tak bisa dihitung. */
  merchantId: string
  merchant: string
  category: string
  reason: string
  photoCount: number
  filedAt: string
  /** Nilai order yang disengketakan, JOD. */
  amount: number
  status: DisputeStatus
  resolution?: DisputeResolution
  /** Persentase refund sebagian saat `refund_partial` (belum final, OQ-29). */
  partialPercent?: number
  /** Banding ke Super Admin setelah putusan level-1 CS (keputusan PO 2026-09-23). */
  appeal?: DisputeAppeal
}

/** Putusan banding: putusan CS diperkuat, atau diubah SA. */
export type AppealVerdict = 'upheld' | 'overturned'

/** Banding sengketa — jalur SA meninjau putusan level-1 CS. */
export interface DisputeAppeal {
  requestedAt: string
  requestedBy: 'customer' | 'merchant'
  note: string
  verdict?: AppealVerdict
  decidedAt?: string
}

/**
 * Status hold COD via wallet (R-COD-01, flow F2). `held` = order dibuat, saldo
 * ditahan; `cut` = kurir match; `settled` = OTP sukses, uang pindah ke merchant.
 * Dua jalur batal: `released` (sebelum match, hold dilepas) dan `reversed`
 * (sesudah match, potongan dikembalikan lewat entry reversal).
 */
export type HoldStatus = 'none' | 'held' | 'cut' | 'settled' | 'released' | 'reversed'

/** Nama event hold — sama dengan kontrak BE, satu event per transisi (M4). */
export type HoldEventName =
  | 'hold_created'
  | 'hold_cut'
  | 'hold_settled'
  | 'hold_released'
  | 'hold_reversed'

/** Entry hold append-only. Tiap transisi menambah satu; tidak ada yang diubah. */
export interface HoldEvent {
  id: string
  event: HoldEventName
  /** IDR — nominal hold saat event terjadi. */
  amountIdr: number
  at: string
}

export type LedgerEntryType =
  | 'deposit_hold'
  | 'cod_hold'
  | 'settlement'
  | 'fee'
  | 'refund'
  | 'protection_fund'

/** Jenis pemilik dana di satu entry ledger. */
export type LedgerPartyKind = 'customer' | 'merchant' | 'courier' | 'platform'

/**
 * Pihak yang uangnya bergerak di satu entry ledger. Sebelum ini `LedgerEntry`
 * tidak punya field pihak sama sekali, sehingga janji PRD "monitoring ledger
 * detail merchant & customer" (`decision-irbid-mvp.md:52`) tidak bisa dipenuhi:
 * uangnya terlihat bergerak, pemiliknya tidak.
 */
export interface LedgerParty {
  kind: LedgerPartyKind
  /** `Customer.id` / `MerchantRecord.id` / `Courier.id`; `null` untuk `platform`. */
  id: string | null
  name: string
}

/** Entry ledger — append-only, tanpa aksi edit atau hapus dari UI (M9). */
export interface LedgerEntry {
  id: string
  at: string
  type: LedgerEntryType
  direction: 'debit' | 'credit'
  /** JOD. */
  amount: number
  /** Dana siapa yang bergerak di entry ini. */
  party: LedgerParty
  ref: string
  memo: string
}

/** Kewajiban platform = saldo wallet yang belum di-payout (view agregat, M9). */
export interface LiabilitySummary {
  customerWallets: number
  merchantWallets: number
  courierTips: number
  /** Saldo Xendit mock; dipakai membandingkan dengan total liability. */
  xenditBalance: number
}

/** Tier rebate bulanan (R-INCENTIVE-01, F9). */
export type RebateTier = 'tier_1' | 'tier_2' | 'tier_3'

/** Event modal/rebate merchant — sama dengan kontrak BE (M10). */
export type MerchantCreditEventName =
  | 'merchant_credit_granted'
  | 'merchant_credit_debited'
  | 'rebate_tier_reached'
  | 'rebate_paid'

/** Entry modal/rebate — append-only, alasan sama dengan ledger (M9). */
export interface MerchantCreditEvent {
  id: string
  event: MerchantCreditEventName
  /** JOD — nominal yang dipotong dari modal atau cashback yang dibayar. */
  amountJod: number
  at: string
}

/**
 * State insentif merchant (M10). Semua nominal JOD karena kontraknya JOD
 * (`merchant_credit_balance`, `rebate_amount_jod`); padanan IDR dihitung di
 * layer tampilan seperti aturan R-CURR-01.
 */
export interface MerchantCreditState {
  /** Sisa modal awal 5 JOD — non-tunai & non-withdrawal (I-3 belum final). */
  merchantCreditBalance: number
  /** `YYYY-MM` periode tier berjalan. */
  rebatePeriod: string
  /** Order settled pada periode ini — dasar ambang tier. */
  settledThisPeriod: number
  rebateTier: RebateTier | null
  rebateAmountJod: number
  /** null = tier sudah tercapai tapi cashback belum dibayar. */
  rebatePaidAt: string | null
  /** Dompet deposit merchant; cashback masuk ke sini, bukan ke modal. */
  depositBalanceJod: number
  /** Riwayat event modal & cashback, append-only. */
  events: MerchantCreditEvent[]
}

/** Alert SLA breach yang naik ke SA (`batch.escalatedToAdmin: true`, feeder F21). */
export interface AdminEscalation {
  id: string
  orderCode: string
  /** `MerchantRecord.id` — dulu hanya nama. */
  merchantId: string
  merchant: string
  detail: string
  minutesLate: number
}

// ── Konsol Super Admin (role terpisah, website penuh non-PWA) ───────────────
// Cakupan dari keputusan PO 2026-09-23 (`decision-irbid-mvp.md`). Repo ini
// front-end saja: semua angka di bawah adalah mock yang ditampilkan.

/** Titik koordinat geografis. Bentuk yang sama dipakai alamat dan poligon zona. */
export interface GeoPoint {
  lat: number
  lng: number
}

/**
 * Poligon zona master. Vertices disimpan sebagai **lat/lng sungguhan** karena
 * inilah bentuk yang dipakai gate coverage (titik di dalam poligon), bukan
 * koordinat gambar. Kanvas SA hanya memproyeksikan lat/lng itu ke layar supaya
 * bisa digeser; repo ini tidak memakai tile peta eksternal (AGENTS.md §6).
 */
export interface ZoneGeometry {
  id: ZoneId
  label: string
  note: string
  vertices: GeoPoint[]
}

/** Satu izin yang bisa diberikan ke role. `group` hanya untuk pengelompokan UI. */
export interface SaPermission {
  id: string
  label: string
  group: 'platform' | 'operasi'
}

/**
 * Role operator. `scope: 'sa'` = konsol ini; `scope: 'cs'` = panel CS
 * (`/admin/*`). Akun CS dibuat SA (OQ-30, PO 2026-09-23), bukan self-service.
 */
export interface SaRole {
  id: string
  name: string
  scope: 'sa' | 'cs'
  permissionIds: string[]
  /** Role pemilik platform: izinnya tidak bisa dicabut dari UI. */
  locked: boolean
}

/** Operator (akun) yang dibuat SA; role menentukan izinnya. */
export interface SaOperator {
  id: string
  name: string
  contact: string
  roleId: string
  createdAt: string
  status: 'active' | 'invited' | 'suspended'
}

/** Jenis aksi yang tercatat di audit trail — dipakai filter di layar. */
export type AuditKind =
  | 'onboarding'
  | 'dispute'
  | 'merchant'
  | 'zone'
  | 'role'
  | 'operator'
  | 'tax'
  | 'profit'
  | 'switch'
  | 'escalate'

/** Entry audit trail; append-only, satu baris per aksi SA maupun CS. */
export interface AuditEntry {
  id: string
  at: string
  actor: string
  /**
   * `SaOperator.id` pelaku; `null` untuk aksi sistem yang tidak dijalankan akun.
   * Dulu hanya ada `actor` (nama), jadi audit tidak bisa ditautkan ke akun.
   */
  actorId: string | null
  actorRole: 'sa' | 'cs'
  kind: AuditKind
  /** Kalimat aksi yang sudah siap tampil, mis. "Setujui deposit tenant". */
  action: string
  /**
   * Objek yang kena aksi, mis. order code atau nama merchant. **Masih string
   * tampilan, bukan id** — taksonomi target belum ada di PRD, jadi sengaja
   * dibiarkan apa adanya dan ditandai `UNRESOLVED` di dokumentasi konsol.
   */
  target: string
}

/**
 * Laporan pajak aplikasi per periode (PO 2026-09-23). Dua objek berbeda:
 * GST makanan ditanggung merchant atas penjualan (info-only), sedangkan PPh
 * final 0,5% atas fee platform adalah beban platform.
 */
export interface TaxReportRow {
  period: string
  orders: number
  /** Penjualan bruto merchant, IDR. */
  salesIdr: number
  /** Fee platform terkumpul (0,37 JOD/order), JOD. */
  feeGrossJod: number
  /** GST atas objek fee platform (16%), JOD — belum dipungut (OQ-17). */
  gstOnFeeJod: number
  /** PPh final 0,5% atas fee platform, JOD. */
  pphFinalJod: number
}

/** Penarikan saldo keuntungan platform. Hanya dana ini yang boleh ditarik SA. */
export interface ProfitWithdrawal {
  id: string
  at: string
  amountJod: number
  method: string
  status: 'settled' | 'processing'
}

/** Saldo keuntungan platform: fee terkumpul dikurangi biaya, pajak, penarikan. */
export interface ProfitState {
  feeGrossJod: number
  costJod: number
  pphFinalJod: number
  withdrawals: ProfitWithdrawal[]
}

/**
 * Kill switch platform. `true` = jalur normal hidup; `false` = jalur
 * dihentikan. Maintenance memblokir seluruh order baru.
 */
export interface PlatformSwitches {
  cod: boolean
  payout: boolean
  maintenance: boolean
}

// ── Data-viz konsol (donut & bar) ───────────────────────────────────────────
// Tipe view-model, bukan tipe domain: chart menggambarkan data yang sudah ada
// (`LiabilitySummary`, `ProfitState`, `TaxReportRow`, `AuditEntry`), tidak
// menambah aturan bisnis. Lihat `src/data/dashboard.ts`.

/**
 * Nada warna elemen data-viz. Nama **peran**, bukan nomor palet, supaya chart
 * memakai token yang sudah ada dan tidak menambah warna baru (DNA §4).
 */
export type ChartTone = 'brand' | 'success' | 'warning' | 'danger' | 'muted'

/** Satu potongan donut. */
export interface ChartSegment {
  label: string
  value: number
  tone: ChartTone
  /**
   * Id tab antrean yang mewakili potongan ini, kalau ada padanannya.
   * Dipakai legenda yang bisa ditekan: potongan donut tanpa jalan menuju
   * daftar ordernya hanya bisa dilihat, tidak bisa ditindaklanjuti.
   *
   * Tipenya `string`, bukan `QueueTabId`, karena `QueueTabId` diturunkan dari
   * `QUEUE_TABS` di `data/merchantOrders.ts` yang sudah mengimpor berkas ini —
   * memakainya di sini akan membuat lingkaran impor. Nilainya tetap wajib
   * berasal dari `QUEUE_TABS`; itu dijaga di pemanggilnya (`merchantTrend.ts`).
   */
  tab?: string
}

/** Satu batang bar chart. */
export interface ChartBar {
  label: string
  value: number
}

// ── Layar masuk / daftar ────────────────────────────────────────────────────
// Foto panel atas layar auth. Dimensinya bagian dari tipe karena ketiganya
// aset portrait (800x1422 atau 800x1200) dan pemanggil harus meneruskannya ke
// atribut `width`/`height` <img>: tanpa itu browser mengalokasikan ruang
// sebelum gambar dimuat dengan rasio yang salah, dan panel foto melompat.

export interface AuthPhoto {
  src: string
  alt: string
  /** Lebar asli berkas, dipakai atribut `width` <img>. */
  width: number
  /** Tinggi asli berkas, dipakai atribut `height` <img>. */
  height: number
}
