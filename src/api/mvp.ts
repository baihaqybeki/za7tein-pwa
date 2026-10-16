import { dbRpc } from './db'

/**
 * Klien RPC logika bisnis PRD aktif `sa7tein-mvp-2026-10-11` (migrasi
 * `supabase/32-sa7tein-rpc.sql`). Blocker eksternal (DANA/Google/magic-link)
 * dilewati: fungsi ini hanya menghitung & mencatat state, tanpa layanan luar.
 */

export interface OrderPrice {
  subtotal_jod: number
  discount_merchant_jod: number
  discount_applicator_jod: number
  delivery_fee_jod: number
  platform_fee_customer_jod: number
  platform_fee_merchant_jod: number
  transaction_fee_jod: number
  total_jod: number
  rate_locked: number | null
  total_idr: number
  rounding_up_idr: number
  payment_method: string
  delivery_type: string
}

export interface PriceItem {
  unit_jod: number
  qty: number
}

export function fxRateLatest(): Promise<number | null> {
  return dbRpc<number>('fx_rate_latest', {})
}

export function priceOrder(
  merchantId: number,
  items: PriceItem[],
  deliveryType: 'regular' | 'quick' = 'regular',
  paymentMethod: 'qris' | 'dana_balance' | 'cod' = 'qris',
  discountMerchantJod = 0,
  discountApplicatorJod = 0,
): Promise<OrderPrice | null> {
  return dbRpc<OrderPrice>('price_order', {
    p_merchant: merchantId,
    p_items: items,
    p_delivery_type: deliveryType,
    p_payment_method: paymentMethod,
    p_discount_merchant_jod: discountMerchantJod,
    p_discount_applicator_jod: discountApplicatorJod,
  })
}

/** `order` | `order_cod` | `none` | null (= order tidak boleh dibuat). */
export function reserveQuota(merchantId: number, isCod = false): Promise<string | null> {
  return dbRpc<string>('reserve_quota', { p_merchant: merchantId, p_is_cod: isCod })
}

export function consumeQuota(merchantId: number, kind: string): Promise<void> {
  return dbRpc<void>('consume_quota', { p_merchant: merchantId, p_kind: kind }).then(() => undefined)
}

export function releaseQuota(merchantId: number, kind: string): Promise<void> {
  return dbRpc<void>('release_quota', { p_merchant: merchantId, p_kind: kind }).then(() => undefined)
}

export function settleOrder(orderId: number): Promise<void> {
  return dbRpc<void>('settle_order', { p_order: orderId }).then(() => undefined)
}

export function assignBatch(orderId: number, courierId: number): Promise<number | null> {
  return dbRpc<number>('assign_batch', { p_order: orderId, p_courier: courierId })
}

export function dispatchPartner(orderId: number): Promise<number | null> {
  return dbRpc<number>('dispatch_partner', { p_order: orderId })
}

export function respondAssignment(id: number, status: 'approved' | 'rejected', reason?: string): Promise<void> {
  return dbRpc<void>('respond_assignment', { p_id: id, p_status: status, p_reason: reason ?? null }).then(
    () => undefined,
  )
}

export function createRefund(
  orderId: number,
  method: 'dana' | 'bank_bifast',
  amountIdr: number,
  bank?: string,
  account?: string,
): Promise<number | null> {
  return dbRpc<number>('create_refund', {
    p_order: orderId,
    p_method: method,
    p_amount_idr: amountIdr,
    p_bank: bank ?? null,
    p_account: account ?? null,
  })
}

export function checkCoverage(merchantId: number, lat: number, lng: number): Promise<boolean | null> {
  return dbRpc<boolean>('check_coverage', { p_merchant: merchantId, p_lat: lat, p_lng: lng })
}

export interface BrowseMerchant {
  id: number
  store_name: string
  description: string | null
  photo: string | null
  latitude: number | null
  longitude: number | null
  rating_avg: number | null
  rating_count: number | null
  store_status: string | null
  distance_m: number | null
  order_count: number
}

export function browseMerchants(params: {
  lat?: number
  lng?: number
  tag?: string
  q?: string
  sort?: 'distance' | 'rating'
  limit?: number
} = {}): Promise<BrowseMerchant[]> {
  return dbRpc<BrowseMerchant[]>('browse_merchants', {
    p_lat: params.lat ?? null,
    p_lng: params.lng ?? null,
    p_tag: params.tag ?? null,
    p_q: params.q ?? null,
    p_sort: params.sort ?? 'distance',
    p_limit: params.limit ?? 50,
  }).then((rows) => rows ?? [])
}

export interface Discounts {
  discount_merchant_jod: number
  discount_applicator_jod: number
}

export function computeDiscounts(merchantId: number, subtotalJod: number): Promise<Discounts | null> {
  return dbRpc<Discounts>('compute_discounts', { p_merchant: merchantId, p_subtotal_jod: subtotalJod })
}

export function snapshotDisputeRules(orderId: number): Promise<void> {
  return dbRpc<void>('snapshot_dispute_rules', { p_order: orderId }).then(() => undefined)
}
