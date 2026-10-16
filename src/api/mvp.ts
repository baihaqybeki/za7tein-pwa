import { dbRpc, dbSelect } from './db'

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

export interface CreateOrderItem {
  menu_id: number
  qty: number
  unit_jod: number
  name?: string
  modifiers?: unknown[]
}

/** Buat order lengkap (M3 capstone). Mengembalikan order_id. */
export function createOrder(input: {
  customerId: number
  merchantId: number
  addressId: number
  items: CreateOrderItem[]
  deliveryType?: 'regular' | 'quick'
  paymentMethod?: 'qris' | 'dana_balance' | 'cod'
  note?: string
}): Promise<number | null> {
  return dbRpc<number>('create_order', {
    p_customer: input.customerId,
    p_merchant: input.merchantId,
    p_address: input.addressId,
    p_items: input.items,
    p_delivery_type: input.deliveryType ?? 'regular',
    p_payment_method: input.paymentMethod ?? 'qris',
    p_note: input.note ?? null,
  })
}

/** M1: magic link (stub — token dikembalikan sebagai state demo). */
export function requestMagicLink(email: string, role = 'customer'): Promise<string | null> {
  return dbRpc<string>('request_magic_link', { p_email: email, p_role: role })
}

export function consumeMagicLink(token: string): Promise<{ email: string; role: string } | null> {
  return dbRpc<{ email: string; role: string }>('consume_magic_link', { p_token: token })
}

/** Selesaikan order (M4/M7): consume quota + settlement + notif. */
export function completeOrder(orderId: number): Promise<void> {
  return dbRpc<void>('complete_order', { p_order: orderId }).then(() => undefined)
}

/** Batal/tolak order (M4/M7): release quota + refund bila sudah dibayar. */
export function cancelOrder(orderId: number, by: string, reason = 'dibatalkan'): Promise<void> {
  return dbRpc<void>('cancel_order', { p_order: orderId, p_by: by, p_reason: reason }).then(() => undefined)
}

export interface OpsKpis {
  orders_active: number
  orders_done: number
  orders_canceled: number
  gmv_jod: number
  transaction_fee_jod: number
  merchants_approved: number
  couriers: number
  refunds_pending: number
}

export function opsKpis(): Promise<OpsKpis[]> {
  return dbSelect<OpsKpis>('ops_kpis')
}

/** Auto-sort rute batch (M5, nearest-neighbor tanpa Google Routes). */
export function autoSortBatch(batchId: number): Promise<number[] | null> {
  return dbRpc<number[]>('auto_sort_batch', { p_batch: batchId })
}

/** Kirim pesan chat order (M11; teks atau gambar). */
export function sendChatMessage(
  orderId: number,
  senderId: number,
  body: string,
  imageUrl?: string,
): Promise<number | null> {
  return dbRpc<number>('send_chat_message', {
    p_order: orderId,
    p_sender: senderId,
    p_body: body,
    p_image: imageUrl ?? null,
  })
}

/** Tutup chat yang melewati auto_close_at (M11). Mengembalikan jumlah yang ditutup. */
export function closeStaleChats(): Promise<number | null> {
  return dbRpc<number>('close_stale_chats', {})
}

// ── AP8 rating & AP9.2 dispute (api-spec §5.9, §5.8) ─────────────────────────
export function submitReview(input: {
  orderId: number
  customerId: number
  rating: number
  review?: string
  merchantId?: number | null
  menuId?: number | null
}): Promise<number | null> {
  return dbRpc<number>('submit_review', {
    p_order: input.orderId,
    p_customer: input.customerId,
    p_rating: input.rating,
    p_review: input.review ?? null,
    p_merchant_id: input.merchantId ?? null,
    p_menu_id: input.menuId ?? null,
  })
}

export function replyReview(reviewId: number, body: string): Promise<number | null> {
  return dbRpc<number>('reply_review', { p_review: reviewId, p_body: body })
}

export function openDispute(input: {
  orderId: number
  filedBy: number
  filedRole: string
  category: string
  reason?: string
}): Promise<number | null> {
  return dbRpc<number>('open_dispute', {
    p_order: input.orderId,
    p_filed_by: input.filedBy,
    p_filed_role: input.filedRole,
    p_category: input.category,
    p_reason: input.reason ?? null,
  })
}

/** p_resolution ∈ refund_customer | refund_order | resettle | no_action */
export function resolveDispute(
  disputeId: number,
  resolution: 'refund_customer' | 'refund_order' | 'resettle' | 'no_action',
  actorId: number,
  note?: string,
  refundJod = 0,
): Promise<void> {
  return dbRpc<void>('resolve_dispute', {
    p_dispute: disputeId,
    p_resolution: resolution,
    p_actor: actorId,
    p_note: note ?? null,
    p_refund_jod: refundJod,
  }).then(() => undefined)
}

export function appealDispute(disputeId: number, actorId: number): Promise<void> {
  return dbRpc<void>('appeal_dispute', { p_dispute: disputeId, p_actor: actorId }).then(() => undefined)
}

// ── AP1.3 katalog atribut (api-spec §17.3.6) ─────────────────────────────────
export interface DbAttribute {
  id: number
  name: string
  display_type: string
  create_variant: string
}
export interface DbAttributeValue {
  id: number
  attribute_id: number
  name: string
  html_color: string | null
  price_extra: number | string
  sort_order: number
}

export function fetchAttributes(): Promise<DbAttribute[]> {
  return dbSelect<DbAttribute>('product_attributes', {
    query: { select: 'id,name,display_type,create_variant', order: 'sort_order.asc' },
  })
}
export function fetchAttributeValues(): Promise<DbAttributeValue[]> {
  return dbSelect<DbAttributeValue>('product_attribute_values', {
    query: { select: 'id,attribute_id,name,html_color,price_extra,sort_order', order: 'sort_order.asc' },
  })
}

// ── AP2.5/AP10.5 job (api-spec §17.6, §8) ────────────────────────────────────
export function runCronJobs(): Promise<Record<string, number> | null> {
  return dbRpc<Record<string, number>>('run_cron_jobs', {})
}
export function expireUnpaidOrders(): Promise<number | null> {
  return dbRpc<number>('expire_unpaid_orders', {})
}

// ── AP7.2/AP7.3/AP10.2 (api-spec §4 G3/G9, §17.3.9) ─────────────────────────
export function emitNotification(input: {
  userId: number
  kind: string
  title: string
  body?: string
  audience?: string
  orderId?: number | null
}): Promise<number | null> {
  return dbRpc<number>('emit_notification', {
    p_user: input.userId,
    p_kind: input.kind,
    p_title: input.title,
    p_body: input.body ?? null,
    p_audience: input.audience ?? 'customer',
    p_order: input.orderId ?? null,
  })
}

export interface OpsRevenueDay {
  day: string
  orders_done: number
  transaction_fee_jod: number | string
  applicator_fee_jod: number | string
}
export function fetchOpsRevenueDaily(): Promise<OpsRevenueDay[]> {
  return dbSelect<OpsRevenueDay>('ops_revenue_daily')
}

// ── AP3.2/AP6.1/AP4.2 (api-spec §17.3.5/§17.3.3/§17.3.2) ────────────────────
export function buyQuotaPackage(merchantId: number, packageId: number, method: 'qris' | 'dana_balance' = 'qris'): Promise<number | null> {
  return dbRpc<number>('buy_quota_package', { p_merchant: merchantId, p_package: packageId, p_method: method })
}
export function setCourierStatus(courierId: number, status: 'offline' | 'available' | 'busy' | 'reserved'): Promise<void> {
  return dbRpc<void>('set_courier_status', { p_courier: courierId, p_status: status }).then(() => undefined)
}
export function closeBatch(batchId: number): Promise<void> {
  return dbRpc<void>('close_batch', { p_batch: batchId }).then(() => undefined)
}

// ── AP6.3 SP/punishment (api-spec §17.3.3; ops-only) ─────────────────────────
export function issueSp(input: {
  subjectType: 'merchant' | 'courier' | 'customer'
  subjectId: number
  kind?: 'sp' | 'fine' | 'suspend'
  level?: number
  reason?: string
  disputeId?: number | null
}): Promise<number | null> {
  return dbRpc<number>('issue_sp', {
    p_subject_type: input.subjectType,
    p_subject_id: input.subjectId,
    p_kind: input.kind ?? 'sp',
    p_level: input.level ?? 1,
    p_reason: input.reason ?? null,
    p_dispute: input.disputeId ?? null,
  })
}
