import type { AppNotification } from '../types'

/** Peristiwa journey pesanan yang memicu notifikasi lintas peran. */
export type JourneyEvent =
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'assigned'
  | 'pickedUp'
  | 'onTheWay'
  | 'arrived'
  | 'delivered'
  | 'canceled'

let seq = 0
const id = (tag: string) => `n-${tag}-${Date.now()}-${(seq += 1)}`

/**
 * Notifikasi journey untuk tiap sisi peran (customer/merchant/courier) dari satu
 * peristiwa. Satu peristiwa bisa menghasilkan beberapa notifikasi dengan
 * `audience` berbeda — mis. kurir ditugaskan → kurir dapat "Tugas baru",
 * customer dapat "Kurir ditugaskan". `audience` dipakai inbox untuk memfilter
 * per peran (lihat halaman Notifikasi).
 */
export function journeyNotifications(event: JourneyEvent, code: string): AppNotification[] {
  const order = { kind: 'order' as const, time: 'Baru saja', unread: true as const, sound: 'order' }
  switch (event) {
    case 'accepted':
      return [{ ...order, id: id('acc'), audience: 'customer', title: 'Pesanan diterima', body: `Toko menerima pesanan ${code} dan mulai menyiapkan.` }]
    case 'rejected':
      return [{ ...order, id: id('rej'), audience: 'customer', title: 'Pesanan ditolak', body: `Toko tidak bisa menerima pesanan ${code}.` }]
    case 'preparing':
      return [{ ...order, id: id('prep'), audience: 'customer', title: 'Pesanan sedang dimasak', body: `Pesanan ${code} sedang disiapkan di dapur.` }]
    case 'assigned':
      return [
        { ...order, id: id('as-c'), audience: 'courier', sound: 'courier', title: 'Tugas baru', body: `Kamu ditugaskan mengantar pesanan ${code}.` },
        { ...order, id: id('as-u'), audience: 'customer', sound: 'courier', title: 'Kurir ditugaskan', body: `Kurir akan mengantar pesanan ${code}.` },
      ]
    case 'pickedUp':
      return [{ ...order, id: id('pu'), audience: 'merchant', title: 'Kurir mengambil pesanan', body: `Kurir mengambil pesanan ${code} dari toko.` }]
    case 'onTheWay':
      return [
        { ...order, id: id('otw-c'), audience: 'customer', sound: 'courier', title: 'Kurir menuju lokasimu', body: `Kurir sedang mengantar pesanan ${code}.` },
        { ...order, id: id('otw-m'), audience: 'merchant', title: 'Kurir berangkat', body: `Pesanan ${code} dalam pengantaran.` },
      ]
    case 'arrived':
      return [{ ...order, id: id('arr'), audience: 'customer', sound: 'courier', title: 'Kurir sudah sampai', body: `Siapkan kode OTP untuk serah terima pesanan ${code}.` }]
    case 'delivered':
      return [
        { ...order, id: id('dlv-c'), audience: 'customer', title: 'Pesanan selesai', body: `Pesanan ${code} sudah diterima.` },
        { ...order, id: id('dlv-m'), audience: 'merchant', title: 'Order selesai', body: `Pesanan ${code} selesai.` },
      ]
    case 'canceled':
      return [{ ...order, id: id('can'), audience: 'customer', title: 'Pesanan dibatalkan', body: `Pesanan ${code} dibatalkan.` }]
  }
}

/** Peran yang sedang dilihat dari path URL (dipakai inbox memfilter per sisi). */
export function roleFromPath(pathname: string): 'customer' | 'merchant' | 'courier' | 'cs' {
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/courier')) return 'courier'
  if (pathname.startsWith('/admin')) return 'cs'
  return 'customer'
}
