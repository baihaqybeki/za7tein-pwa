import type { CartItem, Courier, CourierCheckpoint, CourierTask } from '../types'
import { mockCouriers } from './merchant'

/**
 * Langkah yang tampil di stepper kurir. Urutannya cermin `mainPath` flow F13
 * (`docs/design/flows/f13-courier-view/`) — masuk → ambil → berangkat → tiba →
 * otp → selesai. `otp` adalah langkah di dalam state `tiba` (lihat
 * `courierStepIndex`), bukan checkpoint tersimpan.
 */
export const COURIER_STEPS: { id: string; label: string }[] = [
  { id: 'ambil', label: 'Ambil' },
  { id: 'berangkat', label: 'Berangkat' },
  { id: 'tiba', label: 'Tiba' },
  { id: 'otp', label: 'OTP' },
  { id: 'selesai', label: 'Selesai' },
]

/** Checkpoint tersimpan, urut maju. Cabang `batal` di luar daftar ini. */
export const COURIER_CHECKPOINT_ORDER: CourierCheckpoint[] = [
  'masuk',
  'ambil',
  'berangkat',
  'tiba',
  'selesai',
]

/** Status kurir, satu sumber untuk PWA merchant dan registri SA. */
export const COURIER_STATUS_LABEL: Record<Courier['status'], string> = {
  at_store: 'Di toko',
  delivering: 'Mengantar',
  offline: 'Offline',
}

export const COURIER_CHECKPOINT_LABEL: Record<CourierCheckpoint, string> = {
  masuk: 'Tugas baru',
  ambil: 'Menunggu diambil',
  berangkat: 'Dalam perjalanan',
  tiba: 'Menunggu OTP customer',
  selesai: 'Selesai',
  batal: 'Batal — customer lalai',
}

/** Checkpoint berikutnya, atau null kalau sudah di ujung. */
export function nextCheckpoint(checkpoint: CourierCheckpoint): CourierCheckpoint | null {
  const next = COURIER_CHECKPOINT_ORDER[COURIER_CHECKPOINT_ORDER.indexOf(checkpoint) + 1]
  return next ?? null
}

/** Indeks langkah aktif di `COURIER_STEPS`; 1 di atas panjang = semua selesai. */
export function courierStepIndex(checkpoint: CourierCheckpoint): number {
  switch (checkpoint) {
    case 'masuk':
      return 0
    case 'ambil':
      return 1
    case 'berangkat':
      return 2
    case 'tiba':
      return 3
    case 'selesai':
      return COURIER_STEPS.length
    default:
      return 0
  }
}

/** Label aksi tombol utama untuk tiap checkpoint; `tiba` dan `selesai` tak punya. */
export const COURIER_ACTION_LABEL: Partial<Record<CourierCheckpoint, string>> = {
  masuk: 'Ambil tugas',
  ambil: 'Berangkat',
  berangkat: 'Tiba di lokasi',
}

/**
 * SLA tiap jeda checkpoint (menit), kunci = checkpoint saat ini → batas waktu
 * menuju langkah berikutnya. Angka 15/30/10 adalah keputusan SEMENTARA PO
 * 2026-09-22; final menunggu data rute Irbid (OQ-13 di flow F13). Jangan
 * dianggap final — kalau berubah, ubah di sini saja.
 */
export const COURIER_SLA_MINUTES: Partial<Record<CourierCheckpoint, number>> = {
  ambil: 15,
  berangkat: 30,
  tiba: 10,
}

/**
 * Auto-settle setelah window OTP lewat (menit). F5 menegaskan order tidak boleh
 * menggantung pending selamanya: timeout OTP → tetap settle, bukan stuck.
 */
export const AUTO_SETTLE_MINUTES = 10

/** OTP demo 4 digit — dipakai sisi kurir (F13) dan sisi customer (M5). */
export const DELIVERY_OTP_DEMO = '4821'

/**
 * Guard customer lalai saat menunggu OTP (flow F13): +5 menit kurir
 * menghubungi customer, +10 menit kurir boleh membatalkan tugas. Penalti
 * customer masih UNRESOLVED (OQ-14) — jangan dipilih salah satu.
 */
export const COURIER_GUARD_MINUTES = { call: 5, batal: 10 } as const

/** Kurir adalah karyawan merchant (C-06); platform tidak menahan dana kurir. */
export const courierSelf: Courier = mockCouriers[0]

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

const items = {
  geprek: [{ id: 'ayam-geprek', name: 'Ayam Geprek + Nasi', price: 22000, quantity: 2, image: '' }],
  nasi: [{ id: 'nasi-uduk', name: 'Nasi Uduk Komplit', price: 20000, quantity: 3, image: '' }],
  mie: [{ id: 'mie-goreng', name: 'Mie Goreng Spesial', price: 18000, quantity: 1, image: '' }],
} satisfies Record<string, CartItem[]>

export const courierTasks: CourierTask[] = [
  {
    id: 'ct-1',
    code: 'SA-1041',
    customerId: 'cus-1',
    customerName: 'Rani',
    customerPhone: '+6281200000001',
    address: 'Menara Sudirman',
    floor: 'Lt. 12',
    unit: 'Unit B',
    items: items.geprek,
    total: 44000,
    distanceMeters: 480,
    zone: 'hijazi',
    paymentMethod: 'cod',
    tip: 0,
    orderStage: 'dimasak',
    checkpoint: 'masuk',
    otp: '4821',
  },
  {
    id: 'ct-2',
    code: 'SA-1040',
    customerId: 'cus-2',
    customerName: 'Budi',
    customerPhone: '+6281200000002',
    address: 'Jl. Kebon Sirih No. 8',
    floor: 'Lt. 2',
    unit: 'Ruko A',
    items: items.mie,
    total: 18000,
    distanceMeters: 900,
    zone: 'syimali',
    paymentMethod: 'cod',
    tip: 3000,
    orderStage: 'diantar',
    checkpoint: 'berangkat',
    checkpointStartedAt: minutesAgo(11),
    otp: '7391',
  },
  {
    id: 'ct-3',
    code: 'SA-1039',
    customerId: 'cus-3',
    customerName: 'Sinta',
    customerPhone: '+6281200000003',
    address: 'Apartemen Casablanca',
    floor: 'Tower B Lt. 7',
    unit: 'Unit 7C',
    items: items.nasi,
    total: 60000,
    distanceMeters: 1300,
    zone: 'syimali',
    paymentMethod: 'cod',
    tip: 5000,
    orderStage: 'diantar',
    checkpoint: 'tiba',
    checkpointStartedAt: minutesAgo(6),
    otp: '5230',
  },
  {
    id: 'ct-4',
    code: 'SA-1035',
    customerId: 'cus-7',
    customerName: 'Tia',
    customerPhone: '+6281200000004',
    address: 'Menara Imperium',
    floor: 'Lt. 3',
    unit: 'Unit A',
    items: items.nasi,
    total: 60000,
    distanceMeters: 540,
    zone: 'hijazi',
    paymentMethod: 'cod',
    tip: 5000,
    orderStage: 'tiba',
    checkpoint: 'selesai',
    otp: '1180',
    otpVerified: true,
  },
]

/** Tugas yang masih berjalan — belum `selesai` dan belum `batal`. */
export function isActiveTask(task: CourierTask): boolean {
  return task.checkpoint !== 'selesai' && task.checkpoint !== 'batal'
}

/** Tugas yang sudah selesai; riwayat dan sumber angka tips. */
export function isDoneTask(task: CourierTask): boolean {
  return task.checkpoint === 'selesai'
}

/** Milidetik sisa SLA untuk jeda checkpoint sekarang, atau null kalau jeda tak ber-SLA. */
export function slaRemainingMs(
  task: Pick<CourierTask, 'checkpoint' | 'checkpointStartedAt'>,
  now: number,
): number | null {
  const minutes = COURIER_SLA_MINUTES[task.checkpoint]
  if (!minutes || !task.checkpointStartedAt) return null
  const elapsed = now - new Date(task.checkpointStartedAt).getTime()
  return minutes * 60_000 - elapsed
}

/** Menit berjalan sejak checkpoint sekarang dimulai (0 kalau belum ada). */
export function elapsedMinutes(
  task: Pick<CourierTask, 'checkpoint' | 'checkpointStartedAt'>,
  now: number,
): number {
  if (!task.checkpointStartedAt) return 0
  return (now - new Date(task.checkpointStartedAt).getTime()) / 60_000
}

/** Hitung mundur `mm:ss`; nilai negatif jadi `00:00` (SLA lewat ditandai terpisah). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const mm = String(Math.floor(total / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function totalTips(tasks: CourierTask[]): number {
  return tasks.filter(isDoneTask).reduce((sum, task) => sum + task.tip, 0)
}
