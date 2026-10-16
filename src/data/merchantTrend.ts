import type { ChartBar, ChartSegment, MerchantOrder } from '../types'
import { merchantOrders } from './merchantOrders'

/**
 * Data deret waktu untuk dashboard merchant (M2).
 *
 * Merchant tidak menyimpan tanggal pesanan: `MerchantOrder.placedAt` berbentuk
 * teks relatif ("2 menit lalu") karena layar antrean cuma butuh itu. Grafik tren
 * butuh tanggal, jadi deret harian disimpan terpisah di sini dan sengaja
 * diturunkan dari angka yang sama dengan kartu statistik supaya tidak ada dua
 * kebenaran: `orders` tujuh hari terakhir dijumlahkan sama dengan jumlah order
 * mock (`merchantOrders.length`).
 *
 * Angka di sini state demo, bukan hasil query — repo ini front-end saja
 * (AGENTS.md §1). Kalau nanti ada backend, fungsi di bawah tetap berlaku dan
 * sumbernya tinggal diganti.
 */

/** Satu titik deret harian: jumlah order dan pendapatannya (IDR). */
export interface TrendPoint {
  /** Label pendek untuk sumbu, mis. `Sen`. */
  label: string
  /** Tanggal ISO supaya urutannya tidak bergantung nama hari. */
  date: string
  orders: number
  revenueIdr: number
}

/**
 * Tujuh hari terakhir, berakhir hari ini. Bentuknya naik menjelang akhir pekan
 * supaya grafiknya punya bentuk yang bisa dibaca, bukan rata.
 *
 * Dua hal yang dijaga supaya angka di grafik tidak bertentangan dengan kartu:
 * jumlah order tujuh baris ini sama dengan `merchantOrders.length` (8), dan
 * `revenueIdr` per hari hanya menjumlahkan order yang benar-benar berjalan —
 * order `ditolak` dan `batal` tidak pernah jadi pendapatan.
 */
export const merchantTrend: TrendPoint[] = (() => {
  const days = [
    { label: 'Sen', orders: 0, revenueIdr: 0 },
    { label: 'Sel', orders: 1, revenueIdr: 18000 },
    { label: 'Rab', orders: 1, revenueIdr: 44000 },
    { label: 'Kam', orders: 1, revenueIdr: 12000 },
    { label: 'Jum', orders: 1, revenueIdr: 44000 },
    { label: 'Sab', orders: 2, revenueIdr: 78000 },
    { label: 'Min', orders: 2, revenueIdr: 60000 },
  ]
  const today = new Date()
  return days.map((day, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (days.length - 1 - index))
    return { ...day, date: date.toISOString().slice(0, 10) }
  })
})()

/** Permintaan tren: total order dan pendapatan tujuh hari terakhir. */
export function trendTotals(points: TrendPoint[] = merchantTrend): {
  orders: number
  revenueIdr: number
  best: TrendPoint | null
} {
  const orders = points.reduce((sum, point) => sum + point.orders, 0)
  const revenueIdr = points.reduce((sum, point) => sum + point.revenueIdr, 0)
  const best = points.reduce<TrendPoint | null>(
    (top, point) => (!top || point.revenueIdr > top.revenueIdr ? point : top),
    null,
  )
  return { orders, revenueIdr, best }
}

/** Deret batang jumlah order per hari untuk `BarChart`. */
export function orderTrendBars(points: TrendPoint[] = merchantTrend): ChartBar[] {
  return points.map((point) => ({ label: point.label, value: point.orders }))
}

/** Deret batang pendapatan per hari (dalam ribuan rupiah, biar terbaca). */
export function revenueTrendBars(points: TrendPoint[] = merchantTrend): ChartBar[] {
  return points.map((point) => ({ label: point.label, value: Math.round(point.revenueIdr / 1000) }))
}

/**
 * Komposisi status order untuk donut. Menumpang `MerchantOrderStatus` yang ada;
 * `masuk` digabung ke "Baru" dan `tiba` ke "Diantar" supaya donutnya tidak
 * terpecah jadi delapan potongan yang tidak terbaca di lebar 430px.
 */
export function orderMixSegments(orders: MerchantOrder[] = merchantOrders): ChartSegment[] {
  const count = (statuses: string[]) =>
    orders.filter((order) => statuses.includes(order.status)).length
  const segments: ChartSegment[] = [
    { label: 'Baru', value: count(['masuk']), tone: 'warning', tab: 'masuk' },
    { label: 'Diproses', value: count(['diterima', 'dimasak']), tone: 'brand', tab: 'diproses' },
    { label: 'Diantar', value: count(['diantar', 'tiba']), tone: 'success' },
    { label: 'Selesai', value: count(['selesai']), tone: 'muted', tab: 'selesai' },
    { label: 'Batal/tolak', value: count(['ditolak', 'batal']), tone: 'danger', tab: 'batal' },
  ]
  return segments.filter((segment) => segment.value > 0)
}

/** Perbandingan metode bayar — COD ditagih kurir, transfer dicek buktinya. */
export function paymentMixSegments(orders: MerchantOrder[] = merchantOrders): ChartSegment[] {
  const cod = orders.filter((order) => order.paymentMethod === 'cod').length
  const dana = orders.filter((order) => order.paymentMethod === 'qris').length
  const segments: ChartSegment[] = [
    { label: 'COD (tunai)', value: cod, tone: 'brand' },
    { label: 'DANA / QRIS', value: dana, tone: 'success' },
  ]
  return segments.filter((segment) => segment.value > 0)
}

/** Satu baris peringkat menu: terjual, omzet, dan berapa order memuatnya. */
export interface MenuSalesRow {
  /** `CartItem.id` — kunci yang membuat satu menu tidak terhitung dua kali. */
  id: string
  name: string
  /** Total `quantity` lintas order. */
  sold: number
  /** `quantity × price` — omzet menu ini dalam rupiah. */
  revenueIdr: number
  /** Berapa order yang memuat menu ini. */
  orders: number
}

/**
 * Peringkat menu dari isi order yang ada — bukan mock baru.
 *
 * `MerchantOrder.items` sudah membawa `CartItem.quantity` dan `price`, jadi
 * "menu apa yang paling disukai" bisa diturunkan tanpa menambah data apa pun.
 * Dikelompokkan per `CartItem.id`, bukan per nama: dua item dengan nama sama
 * tapi id berbeda adalah dua baris menu yang berbeda.
 *
 * **Rentangnya sempit dan labelnya harus jujur.** Delapan order mock adalah
 * sekitar setengah jam terakhir, bukan "sepanjang masa"; bisa saja satu kantor
 * pesan bareng. Pemanggil wajib menyebut rentangnya di UI.
 */
export function menuSalesRanking(orders: MerchantOrder[] = merchantOrders): MenuSalesRow[] {
  const byId = new Map<string, MenuSalesRow>()
  for (const order of orders) {
    // Order yang ditolak/batal tidak pernah jadi penjualan.
    if (order.status === 'ditolak' || order.status === 'batal') continue
    for (const item of order.items) {
      const row = byId.get(item.id) ?? {
        id: item.id,
        name: item.name,
        sold: 0,
        revenueIdr: 0,
        orders: 0,
      }
      row.sold += item.quantity
      row.revenueIdr += item.quantity * item.price
      row.orders += 1
      byId.set(item.id, row)
    }
  }
  return [...byId.values()].sort((a, b) => b.sold - a.sold || b.revenueIdr - a.revenueIdr)
}

/**
 * Porsi menu teratas dibanding seluruh porsi terjual (0–1). Dipakai kartu
 * "Terjual" untuk membaca satu kalimat, bukan menyuruh merchant menghitung
 * sendiri dari deretan bar.
 */
export function topMenuShare(rows: MenuSalesRow[]): { name: string; share: number; orders: number } | null {
  const top = rows[0]
  const total = rows.reduce((sum, row) => sum + row.sold, 0)
  if (!top || total === 0) return null
  return { name: top.name, share: top.sold / total, orders: top.orders }
}
