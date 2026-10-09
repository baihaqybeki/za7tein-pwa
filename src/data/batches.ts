import type { BatchStatus, OrderBatch } from '../types'

/** Jendela prepare & delivery (mock; angka SLA final masih UNRESOLVED, DEC-1037). */
export const PREPARE_WINDOW_SECONDS = 15 * 60
export const DELIVERY_WINDOW_SECONDS = 30 * 60

export const BATCH_STATUS_LABEL: Record<BatchStatus, string> = {
  prepare: 'Disiapkan',
  closed: 'Batch ditutup',
  waitingCourier: 'Menunggu kurir',
  waitingDelivery: 'Siap diantar',
  delivery: 'Dalam pengantaran',
}

/**
 * Batch contoh kosong. Batch dibuat saat merchant menerima order pertama
 * (`addOrderToBatch`); tak ada batch tanpa order.
 */
export const seedBatches: OrderBatch[] = []
