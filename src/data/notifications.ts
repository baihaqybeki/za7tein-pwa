// Isi kotak masuk notifikasi. Sebelumnya satu-satunya jejak notifikasi di
// aplikasi ini adalah ui.notificationCount = 3 — angka tanpa data apa pun yang
// mendasarinya — sementara halaman /notifications ternyata berisi preferensi
// toggle, bukan daftar notifikasi. Jadi lonceng berbadge "3" membuka halaman
// yang tidak memuat satu pun notifikasi.
import type { AppNotification, PushSubscriptionRecord } from '../types'

/** Tiga yang belum dibaca, supaya cocok dengan badge lonceng yang sudah ada. */
export const mockNotifications: AppNotification[] = [
  {
    id: 'n1',
    kind: 'order',
    title: 'Pesanan sedang dimasak',
    body: 'Warung Sate Pak Ali sedang menyiapkan pesanan SA-1041.',
    time: '12.32',
    unread: true,
    sound: 'order',
  },
  {
    id: 'n2',
    kind: 'order',
    title: 'Kurir menuju lokasimu',
    body: 'Budi Santoso sedang mengantar pesananmu ke Green View Apartment.',
    time: '12.41',
    unread: true,
    sound: 'courier',
  },
  {
    id: 'n3',
    kind: 'promo',
    title: 'Diskon 30% untuk pesanan pertamamu',
    body: 'Berlaku sampai akhir bulan, minimum belanja Rp50.000.',
    time: '09.15',
    unread: true,
    sound: 'promo',
  },
  {
    id: 'n4',
    kind: 'payment',
    title: 'Pembayaran diterima',
    body: 'Transfer Manual Rp118.000 sudah dikonfirmasi.',
    time: 'Kemarin',
    unread: false,
    sound: 'payment',
  },
  {
    id: 'n5',
    kind: 'order',
    title: 'Pesanan selesai',
    body: 'Pesanan S7-1019 sudah diterima. Beri rating untuk kurirnya?',
    time: '2 hari lalu',
    unread: false,
    sound: 'order',
  },
  {
    id: 'n6',
    kind: 'system',
    title: 'Pembaruan aplikasi',
    body: 'Versi baru tersedia dengan perbaikan pada pelacakan pesanan.',
    time: '3 hari lalu',
    unread: false,
    sound: 'system',
  },
]

/* ── Nada notifikasi (audio push) ───────────────────────────────────────────── */

/**
 * Katalog nada notifikasi. Tidak ada berkas audio baru (AGENTS §6: aset dari
 * `public/assets/`); nadanya dibangkitkan di klien lewat Web Audio (nada dasar
 * per key) supaya tetap bisa didengar tanpa menambah aset biner.
 */
export const NOTIFICATION_SOUNDS = [
  { key: 'order', label: 'Pesanan baru', tones: [660, 880] },
  { key: 'courier', label: 'Kurir tiba', tones: [880, 660, 880] },
  { key: 'promo', label: 'Promo', tones: [523, 659, 784] },
  { key: 'payment', label: 'Pembayaran', tones: [784, 1047] },
  { key: 'system', label: 'Sistem', tones: [440] },
] as const

export const DEFAULT_NOTIFICATION_SOUND = 'order'

export function soundLabel(key: string): string {
  return NOTIFICATION_SOUNDS.find((s) => s.key === key)?.label ?? 'Nada'
}

export function soundTones(key: string): readonly number[] {
  return NOTIFICATION_SOUNDS.find((s) => s.key === key)?.tones ?? [440]
}

/* ── Push (R-PUSH-01, M8) ──────────────────────────────────────────────────── */

/**
 * Ketentuan payload push dari PRD. Ditampilkan di layar pengaturan sebagai
 * kontrak, bukan diimplementasikan: repo ini tidak punya service worker push,
 * jadi tidak ada notifikasi yang benar-benar dikirim.
 */
export const PUSH_CONTRACT = {
  maxPayloadKb: 4,
  ttlRequired: true,
  userVisibleOnly: true,
} as const

/**
 * Subscription mock. Endpoint sengaja domain contoh supaya jelas tidak ada
 * server push yang menerima; kuncinya dipotong karena bukan kunci nyata.
 */
export function mockPushSubscription(platform = 'web'): PushSubscriptionRecord {
  return {
    endpoint: 'https://push.sa7tein.example/sub/9f2c1b',
    keys: { p256dh: 'BOr…mock…p256dh', auth: 'K7f…mock' },
    platform,
    expiresAt: new Date(Date.now() + 30 * 24 * 3_600_000).toISOString(),
  }
}

