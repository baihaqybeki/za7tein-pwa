import type { CartItem, MerchantOrder, MerchantOrderStatus } from '../types'

/** Tab antrean merchant — satu sumber untuk label dan status anggotanya. */
export const QUEUE_TABS = [
  { id: 'masuk', label: 'Antrean', statuses: ['masuk'] },
  { id: 'diproses', label: 'Diproses', statuses: ['diterima', 'dimasak', 'diantar', 'tiba'] },
  { id: 'selesai', label: 'Selesai', statuses: ['selesai'] },
  { id: 'batal', label: 'Batal', statuses: ['ditolak', 'batal'] },
] as const

export type QueueTabId = (typeof QUEUE_TABS)[number]['id']

export const ORDER_STATUS_LABEL: Record<MerchantOrderStatus, string> = {
  masuk: 'Baru',
  diterima: 'Diterima',
  dimasak: 'Dimasak',
  diantar: 'Diantar',
  tiba: 'Tiba',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
  batal: 'Batal',
};

export function orderStatusLabel(status: MerchantOrderStatus): string {
  return ORDER_STATUS_LABEL[status];
}

const items = {
  geprek: [{ id: 'ayam-geprek', name: 'Ayam Geprek + Nasi', price: 22000, quantity: 2, image: '' }],
  mie: [{ id: 'mie-goreng', name: 'Mie Goreng Spesial', price: 18000, quantity: 1, image: '' }],
  nasi: [{ id: 'nasi-uduk', name: 'Nasi Uduk Komplit', price: 20000, quantity: 3, image: '' }],
  es: [{ id: 'es-teh', name: 'Es Teh Manis', price: 6000, quantity: 2, image: '' }],
} satisfies Record<string, CartItem[]>

export const merchantOrders: MerchantOrder[] = [
  {
    id: 'mo-1',
    code: 'SA-1041',
    customerId: 'cus-1',
    customerName: 'Rani',
    buyerAvatar: '/assets/img/reviewer/user1.png',
    buyerRating: 5,
    address: 'Menara Sudirman, Lt. 12 Unit B',
    items: items.geprek,
    total: 44000,
    distanceMeters: 480,
    zone: 'hijazi',
    status: 'masuk',
    placedAt: '2 menit lalu',
    paymentMethod: 'cod',
  },
  {
    id: 'mo-2',
    code: 'SA-1040',
    customerId: 'cus-2',
    customerName: 'Budi',
    buyerAvatar: '/assets/img/reviewer/user2.png',
    buyerRating: 4,
    address: 'Jl. Kebon Sirih No. 8, Jakarta Pusat',
    items: items.mie,
    total: 18000,
    distanceMeters: 900,
    zone: 'syimali',
    status: 'masuk',
    placedAt: '5 menit lalu',
    paymentMethod: 'qris',
  },
  {
    id: 'mo-3',
    code: 'SA-1039',
    customerId: 'cus-3',
    customerName: 'Sinta',
    buyerAvatar: '/assets/img/reviewer/user3.png',
    buyerRating: 5,
    address: 'Apartemen Casablanca, Tower B Lt. 7',
    items: items.nasi,
    total: 60000,
    distanceMeters: 1300,
    zone: 'syimali',
    status: 'dimasak',
    placedAt: '14 menit lalu',
    paymentMethod: 'cod',
    cookMinutes: 25,
  },
  {
    id: 'mo-4',
    code: 'SA-1038',
    customerId: 'cus-4',
    customerName: 'Andre',
    buyerAvatar: '/assets/img/reviewer/user4.png',
    buyerRating: 3,
    address: 'Jl. Sabang No. 22, Jakarta Pusat',
    items: items.geprek,
    total: 44000,
    distanceMeters: 1750,
    zone: 'hijazi',
    status: 'dimasak',
    placedAt: '18 menit lalu',
    paymentMethod: 'qris',
    cookMinutes: 25,
  },
  {
    id: 'mo-5',
    code: 'SA-1037',
    customerId: 'cus-5',
    customerName: 'Maya',
    buyerAvatar: '/assets/img/reviewer/user5.png',
    buyerRating: 4,
    address: 'Wisma BNI 46, Lt. 20',
    items: items.es,
    total: 12000,
    distanceMeters: 620,
    zone: 'syimali',
    status: 'diantar',
    placedAt: '26 menit lalu',
    paymentMethod: 'cod',
  },
  {
    id: 'mo-6',
    code: 'SA-1036',
    customerId: 'cus-6',
    customerName: 'Dimas',
    buyerAvatar: '/assets/img/reviewer/user6.png',
    buyerRating: 5,
    address: 'Jl. Wahid Hasyim No. 4, Jakarta Pusat',
    items: items.nasi,
    total: 60000,
    distanceMeters: 1900,
    zone: 'hijazi',
    status: 'tiba',
    placedAt: '34 menit lalu',
    paymentMethod: 'qris',
  },
  {
    id: 'mo-7',
    code: 'SA-1035',
    customerId: 'cus-7',
    customerName: 'Tia',
    buyerAvatar: '/assets/img/reviewer/user1.png',
    buyerRating: 5,
    address: 'Menara Imperium, Lt. 3 Unit A',
    items: items.mie,
    total: 18000,
    distanceMeters: 540,
    zone: 'hijazi',
    status: 'selesai',
    placedAt: '1 jam lalu',
    paymentMethod: 'cod',
  },
  {
    id: 'mo-8',
    code: 'SA-1034',
    customerId: 'cus-8',
    customerName: 'Fajar',
    buyerAvatar: '/assets/img/reviewer/user2.png',
    buyerRating: 2,
    address: 'Jl. Jaksa No. 30, Jakarta Pusat',
    items: items.geprek,
    total: 44000,
    distanceMeters: 1600,
    zone: 'hijazi',
    status: 'ditolak',
    placedAt: '2 jam lalu',
    paymentMethod: 'qris',
  },
]

export function ordersForStatuses(
  orders: MerchantOrder[],
  statuses: readonly MerchantOrderStatus[],
): MerchantOrder[] {
  return orders.filter((order) => statuses.includes(order.status))
}

export function countByTab(orders: MerchantOrder[], tabId: QueueTabId): number {
  const tab = QUEUE_TABS.find((t) => t.id === tabId)
  if (!tab) return 0
  return ordersForStatuses(orders, tab.statuses).length
}
