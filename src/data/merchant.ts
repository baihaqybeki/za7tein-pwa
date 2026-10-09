import type {
  Address,
  Courier,
  DeliveryZone,
  HoldEventName,
  HoldStatus,
  Merchant,
  MerchantDeliveryConfig,
  MerchantRecord,
  OrderStage,
  PaymentMethod,
  StoreStatus,
  ZoneId,
} from '../types'

import { jodToIdr } from './currency'

/** Batas keras PRD: alamat >2 km Haversine dari dapur tidak dilayani (`C-13`). */
export const MAX_DELIVERY_METERS = 2000

/**
 * Fee platform flat (PRD v2 "Fee Platform", update PO 2026-09-21):
 * merchant 0,15 + customer 0,22 = 0,37 JOD per order. Berlaku **semua** metode,
 * termasuk COD cash & transfer manual (PO 2026-09-22, OQ-25). Angka JOD =
 * nominal tampilan; settlement tetap IDR (R-CURR-01).
 */
export const PLATFORM_FEE_MERCHANT_JOD = 0.15
export const PLATFORM_FEE_CUSTOMER_JOD = 0.22
export const PLATFORM_FEE_JOD = PLATFORM_FEE_MERCHANT_JOD + PLATFORM_FEE_CUSTOMER_JOD

/** Akun baru wajib top-up minimal 3,5 JOD (Rp80.500) sebelum bisa order (R-TOPUP-01). */
export const MIN_TOPUP_NEW_ACCOUNT_JOD = 3.5

/**
 * Padanan IDR dari konstanta yang PRD tetapkan dalam JOD. State dan perhitungan
 * tetap IDR; angka JOD di atas hanya nominal kontrak.
 */
export const PLATFORM_FEE_MERCHANT_IDR = jodToIdr(PLATFORM_FEE_MERCHANT_JOD)
export const PLATFORM_FEE_CUSTOMER_IDR = jodToIdr(PLATFORM_FEE_CUSTOMER_JOD)
export const MIN_TOPUP_NEW_ACCOUNT_IDR = jodToIdr(MIN_TOPUP_NEW_ACCOUNT_JOD)

/* ── Pajak (R-TAX-01, F4) ────────────────────────────────────────────────────
 * Dua lapis: GST makanan (merchant yang menyetor, objek = penjualan) dan GST
 * atas fee platform (kewajiban platform, objek = fee 0,37 JOD per order).
 *
 * Tarif 16% ada di acceptance M7, TAPI statusnya belum final: OQ-2/3/4 (tarif
 * GST makanan, PPN ekspor jasa, status PKP) dan OQ-17/18 masih terbuka. Karena
 * itu angkanya dipakai untuk tampilan dengan tanda "belum final" — jangan
 * diklaim sebagai tarif final dan jangan dipakai menghitung setoran.
 */
export const GST_FOOD_PERCENT = 16
export const PLATFORM_GST_PERCENT = 16

/** Nilai GST makanan untuk sebuah subtotal (info-only, tidak masuk total bayar). */
export function gstFoodIdr(subtotalIdr: number): number {
  return Math.round((subtotalIdr * GST_FOOD_PERCENT) / 100)
}

/** GST atas objek fee platform 0,37 JOD (info-only, tak masuk total bayar). */
export function platformGstIdr(): number {
  return Math.round((jodToIdr(PLATFORM_FEE_JOD) * PLATFORM_GST_PERCENT) / 100)
}

/**
 * Gate saldo awal (R-TOPUP-01, guard flow F3): akun wajib punya minimal 3,5 JOD
 * sebelum bisa order — berlaku **semua metode**, bukan cuma bayar pakai saldo.
 * Saldo tepat di ambang dinyatakan lolos (`>=`).
 */
export function needsTopUpGate(availableIdr: number): boolean {
  return availableIdr < MIN_TOPUP_NEW_ACCOUNT_IDR
}

/**
 * Dua zona pengantaran PRD v2 (`C-13`, flow F20): Hijazi (pemukiman barat) &
 * Syimali (utara kampus). Merchant hanya melayani zona yang ia aktifkan, dan
 * hanya untuk alamat ≤2 km Haversine dari dapurnya.
 */
export const DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'hijazi', label: 'Hijazi', area: 'pemukiman barat' },
  { id: 'syimali', label: 'Syimali', area: 'utara kampus' },
]

/**
 * Konfigurasi pengantaran merchant contoh (F20/F16). Di produksi ini dihitung
 * server; di sini tampilan mock. Ongkir **100% merchant** (`C-07`) — platform
 * tidak mengambil bagian.
 *
 * `ongkirIdr` adalah angka placeholder: nominal ongkir final belum diputuskan
 * (flow F20 menandai tier `feeByDistance`/`feeByArea` sebagai UNRESOLVED), jadi
 * jangan dikutip sebagai tarif aktif.
 */
export const merchantDeliveryConfig: MerchantDeliveryConfig = {
  mode: 'area',
  maxKm: 2,
  isActiveHijazi: true,
  isActiveSyimali: true,
  ongkirIdr: 5000,
}

/** Metode bayar PRD v2 — saldo wallet dulu; COD & transfer legacy tetap ada (OQ-25). */
export const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'wallet',
    label: 'Saldo Sa7tein',
    description: 'Bayar dari saldo wallet Sa7tein — top-up lewat Xendit (VA/QRIS).',
  },
  {
    id: 'cod',
    label: 'COD — Bayar di Tempat',
    description: 'Saldo dipotong (hold) saat kurir match, settle setelah OTP.',
  },
  {
    id: 'transfer',
    label: 'Transfer Manual (legacy)',
    description: 'Transfer ke rekening toko, lalu unggah bukti transfer.',
  },
]

/** Deposit COD merchant & tenant (3,50 JOD, PRD §5C). Approve = verifikasi transfer dulu. */
export const DEPOSIT_JOD = 3.5

/**
 * Merchant yang sedang login di PWA merchant. Id-nya sama dengan record
 * registri di bawah (`am-1`) — itulah penghubung yang dulu tidak ada.
 */
export const mockMerchant: Merchant = {
  id: 'am-1',
  name: 'Warung Sate Pak Ali',
  lat: -6.26,
  lng: 106.78,
  tier: 'free',
  todayOrderCount: 7,
  dailyLimit: 10,
  isActive: true,
  storeStatus: 'open',
  openTime: '07:00',
  closeTime: '22:00',
  rating: 4.8,
  reviewCount: 214,
  // Cover toko (SVG lokal, inisial + palet per toko) — bukan foto menu.
  logo: '/assets/img/merchant/warung-sate-pak-ali.svg',
  bank: { name: 'BCA', account: '8830 1122 3344', holder: 'Ali Santoso' },
}

/**
 * Profil toko yang disunting di Setelan merchant. Nama mengikuti
 * `mockMerchant.name` supaya beranda dan form tidak berbeda; nomor & alamat
 * tidak ada di tipe `Merchant` karena hanya dipakai layar ini.
 */
export const mockStoreProfile = {
  name: mockMerchant.name,
  phone: '0811-2222-3333',
  address: 'Jl. Kebon Sirih No. 8, Jakarta Pusat',
} as const

/**
 * Registri merchant platform — identitas usaha + keadaan tenant dalam satu
 * record. Ini yang dibaca konsol SA dan panel CS.
 *
 * Tenant yang masih `pending` **tidak** ada di sini: ia belum merchant, dan
 * antreannya ada di panel CS (`adminTenants`, `/admin/onboarding`).
 */
export const merchants: MerchantRecord[] = [
  {
    id: 'am-1',
    name: 'Warung Sate Pak Ali',
    owner: 'Ali Santoso',
    ownerPhone: '+6281200000011',
    city: 'Irbid — Al-Hashmi',
    tier: 'free',
    isActiveHijazi: true,
    isActiveSyimali: true,
    tenantStatus: 'approved',
    deposit: DEPOSIT_JOD,
    depositStatus: 'held',
    codIssues: 0,
    joinedAt: '4 bulan lalu',
    approvedAt: '4 bulan lalu',
    statusReason: null,
  },
  {
    id: 'am-2',
    name: 'Bakso Pak Kumis',
    owner: 'Kumis Wijaya',
    ownerPhone: '+6281200000012',
    city: 'Irbid — Al-Hashmi',
    tier: 'pro',
    isActiveHijazi: true,
    isActiveSyimali: false,
    tenantStatus: 'suspended',
    deposit: DEPOSIT_JOD,
    depositStatus: 'held',
    codIssues: 1,
    joinedAt: '3 bulan lalu',
    approvedAt: '3 bulan lalu',
    statusReason: 'COD bermasalah berulang, menunggu konfirmasi pemilik',
  },
  {
    id: 'am-3',
    name: 'Kopi Kenangan Kecil',
    owner: 'Rina Kusuma',
    ownerPhone: '+6281200000013',
    city: 'Irbid — University St.',
    tier: 'free',
    isActiveHijazi: false,
    isActiveSyimali: true,
    tenantStatus: 'approved',
    deposit: DEPOSIT_JOD,
    depositStatus: 'held',
    codIssues: 3,
    joinedAt: '2 bulan lalu',
    approvedAt: '2 bulan lalu',
    statusReason: null,
  },
]

/**
 * Merchant baru hasil approve tenant. Kolom operasional PWA (koordinat dapur,
 * rekening, jam buka) tidak diisi di sini — form onboarding belum
 * mengumpulkannya, dan mengarang rekening bank bukan tugas registri.
 */
export function merchantFromTenant(tenant: {
  id: string
  name: string
  owner: string
  city: string
  deposit: number
  deliveryConfig: { isActiveHijazi: boolean; isActiveSyimali: boolean }
}): MerchantRecord {
  return {
    id: `am-${tenant.id}`,
    name: tenant.name,
    owner: tenant.owner,
    ownerPhone: '',
    city: tenant.city,
    tier: 'free',
    isActiveHijazi: tenant.deliveryConfig.isActiveHijazi,
    isActiveSyimali: tenant.deliveryConfig.isActiveSyimali,
    tenantStatus: 'approved',
    deposit: tenant.deposit,
    depositStatus: 'held',
    codIssues: 0,
    joinedAt: 'Baru saja',
    approvedAt: 'Baru saja',
    statusReason: null,
  }
}

/**
 * Pin bawaan untuk alamat yang baru ditambahkan, sebelum pengguna menggeser
 * pin di peta. Sengaja di dalam coverage (540 m < 2 km, zona Hijazi aktif)
 * supaya alamat baru selalu bisa diantar; kalau angkanya diubah, `zone` dan
 * `distanceMeters` harus ikut dijaga agar tetap konsisten.
 */
export const DEFAULT_NEW_ADDRESS_PIN = {
  lat: -6.2575,
  lng: 106.7812,
  distanceMeters: 540,
  zone: 'hijazi',
} as const

/**
 * Kurir toko bersifat eksklusif milik satu merchant (PRD bab 04). Daftar ini
 * adalah registri platform — tiap kurir menunjuk merchant pemiliknya lewat
 * `merchantId` yang sama dengan `MerchantRecord.id`.
 *
 * Catatan PRD: `source.md:296` menyebut deposit, holding earnings, dan blacklist
 * kurir sebagai tanggung jawab merchant, bukan platform. Menampilkan daftar
 * lintas merchant di konsol SA adalah keputusan PO 2026-09-23 yang **menyimpang**
 * dari baris itu; dicatat di `decision-irbid-mvp.md` + flow F22.
 */
export const couriers: Courier[] = [
  // Warung Sate Pak Ali (am-1) — kurir yang tampil di PWA merchant & kurir.
  { id: 'cr-1', merchantId: 'am-1', name: 'Budi Santoso', phone: '+6281234567890', phoneVerified: true, status: 'at_store', activeOrderCount: 0, joinedAt: '5 minggu lalu' },
  { id: 'cr-2', merchantId: 'am-1', name: 'Andi Pratama', phone: '+6281298765432', phoneVerified: true, status: 'delivering', activeOrderCount: 2, joinedAt: '3 minggu lalu' },
  { id: 'cr-3', merchantId: 'am-1', name: 'Rizal', phone: '+6281355566677', phoneVerified: false, status: 'offline', activeOrderCount: 0, joinedAt: '1 minggu lalu' },
  // Merchant lain — hanya muncul di registri SA, tidak di PWA merchant mana pun.
  { id: 'cr-4', merchantId: 'am-2', name: 'Hasan Basri', phone: '+6281200000021', phoneVerified: true, status: 'offline', activeOrderCount: 0, joinedAt: '2 bulan lalu' },
  { id: 'cr-5', merchantId: 'am-3', name: 'Yusuf Karim', phone: '+6281200000022', phoneVerified: true, status: 'delivering', activeOrderCount: 1, joinedAt: '1 bulan lalu' },
  { id: 'cr-6', merchantId: 'am-3', name: 'Slamet Riyadi', phone: '+6281200000023', phoneVerified: false, status: 'at_store', activeOrderCount: 0, joinedAt: '2 minggu lalu' },
]

/** Kurir milik merchant yang sedang login — dipakai PWA merchant & kurir. */
export const mockCouriers: Courier[] = couriers.filter(
  (courier) => courier.merchantId === mockMerchant.id,
)

export const MAX_COURIERS_PER_MERCHANT = 3

/** Urutan tahap perjalanan; satu sumber untuk Journey Line dan label status. */
export const ORDER_STAGES: { id: OrderStage; label: string }[] = [
  { id: 'diterima', label: 'Diterima' },
  { id: 'dimasak', label: 'Dimasak' },
  { id: 'diantar', label: 'Diantar' },
  { id: 'tiba', label: 'Tiba' },
]

/** Pesanan contoh — nomor, jam, dan estimasi dari PRD. */
export const mockOrder = {
  /**
   * Kode satu-satunya order demo yang berjalan. Merchant (`merchantOrders`),
   * kurir (`courierTasks` ct-1), dan baris ledger panel CS memakai kode yang
   * sama supaya M11 bisa memeriksa order yang sama di empat role — bukan empat
   * pesanan berbeda dengan kode berbeda.
   */
  code: 'SA-1041',
  placedAt: '12:27',
  readyEstimate: '12:47',
  arriveEstimate: '13:05',
  courierRating: 4.7,
} as const

// Formatter uang tinggal di `data/currency.ts` (IDR + padanan JOD, R-CURR-01).
// Diekspor ulang di sini supaya pemakai lama tidak perlu ganti jalur impor.
export { money, moneyPlain } from './currency'

export function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1).replace('.', ',')} km`
}

/** Label zona untuk daftar (mis. `Zona Syimali`), aman kalau id tak dikenal. */
export function zoneLabel(id: ZoneId): string {
  return DELIVERY_ZONES.find((z) => z.id === id)?.label ?? id
}

/** Daftar zona yang diaktifkan merchant, mis. `Hijazi, Syimali` (panel CS). */
export function activeZonesLabel(config: MerchantDeliveryConfig): string {
  const zones = [
    config.isActiveHijazi ? 'Hijazi' : null,
    config.isActiveSyimali ? 'Syimali' : null,
  ].filter(Boolean)
  return zones.length ? zones.join(', ') : 'Belum ada zona'
}

/**
 * Zona aktif untuk sebuah alamat, atau null kalau di luar coverage (F20).
 * Coverage lolos hanya kalau: alamat punya zona hasil validasi server, jarak
 * ≤ `maxKm` Haversine, DAN merchant mengaktifkan zona itu (`C-13`).
 */
export function zoneFor(
  address: Pick<Address, 'zone' | 'distanceMeters'>,
): DeliveryZone | null {
  const { zone } = address
  if (!zone) return null
  const limit = Math.min(MAX_DELIVERY_METERS, merchantDeliveryConfig.maxKm * 1000)
  if (address.distanceMeters > limit) return null
  const active =
    zone === 'hijazi'
      ? merchantDeliveryConfig.isActiveHijazi
      : merchantDeliveryConfig.isActiveSyimali
  if (!active) return null
  return DELIVERY_ZONES.find((z) => z.id === zone) ?? null
}

/** Jarak geodesik dua koordinat, dipakai memvalidasi pin peta. */
export function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const la1 = toRad(a.lat)
  const la2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(h)))
}

/**
 * Ongkir untuk sebuah alamat — masuk kas merchant, bukan platform (`C-07`).
 * Nol kalau alamat di luar coverage: order tidak jalan, jadi tak ada ongkir.
 */
export function deliveryFeeFor(address: Pick<Address, 'zone' | 'distanceMeters'>): number {
  return zoneFor(address) ? merchantDeliveryConfig.ongkirIdr : 0
}

export function isDeliverable(address: Pick<Address, 'zone' | 'distanceMeters'>): boolean {
  return zoneFor(address) !== null
}

/**
 * Copy per status hold (F2). `action` = tombol aksi mock yang sah dari status
 * itu, `cancel` = tombol batal, `note` = keterangan di detail order. Status
 * akhir tidak punya aksi lanjutan — di situlah lifecycle berhenti.
 */
export const HOLD_STATUS_COPY: Record<
  HoldStatus,
  { label: string; note: string; action?: string; cancel?: string }
> = {
  none: {
    label: 'Belum ada hold',
    note: 'Hold dibuat saat pesanan COD dibuat.',
    action: 'Buat pesanan',
  },
  held: {
    label: 'Held',
    note: 'Saldo ditahan sejak pesanan dibuat, belum masuk ke merchant.',
    action: 'Kurir match',
    cancel: 'Batal (sebelum match)',
  },
  cut: {
    label: 'Cut',
    note: 'Kurir sudah match; potongan dikunci sampai OTP.',
    action: 'OTP sukses',
    cancel: 'Batal (sesudah match)',
  },
  settled: {
    label: 'Settled',
    note: 'OTP terverifikasi — dana diteruskan ke merchant.',
  },
  released: {
    label: 'Released',
    note: 'Batal sebelum match. Saldo kembali tanpa potongan.',
  },
  reversed: {
    label: 'Reversed',
    note: 'Batal sesudah match. Potongan dikembalikan lewat entry reversal.',
  },
}

/** Label ledger per event hold — tiap transisi = satu entry append-only. */
export const HOLD_EVENT_LABEL: Record<HoldEventName, string> = {
  hold_created: 'hold_created — saldo masuk hold',
  hold_cut: 'hold_cut — potongan dikunci saat kurir match',
  hold_settled: 'hold_settled — dana diteruskan ke merchant',
  hold_released: 'hold_released — hold dilepas (batal sebelum match)',
  hold_reversed: 'hold_reversed — reversal potongan (batal sesudah match)',
}

/** Label status toko untuk UI customer (open/busy/closed). */
export const STORE_STATUS_LABEL: Record<StoreStatus, string> = {
  open: 'Buka',
  busy: 'Sibuk',
  closed: 'Tutup',
}
