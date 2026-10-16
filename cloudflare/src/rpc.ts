// RPC → D1 (SQLite). Port perilaku dari supabase/31-43 ke JS.
export interface RpcEnv {
  DB: D1Database
}

type Args = Record<string, unknown>
const num = (v: unknown): number => (v === null || v === undefined || v === '' ? 0 : Number(v))
const now = (): string => new Date().toISOString()
const code = (): string => `SA-${Math.random().toString(36).slice(2, 10).toUpperCase()}`

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}
function inPoly(lat: number, lng: number, poly: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > lng !== yj > lng && lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
const q = (env: RpcEnv) => ({
  params: () => env.DB.prepare('SELECT platform_fee_customer_jod pc, quick_multiplier qm, transaction_fee_rate ft FROM platform_params WHERE id=1').first<{ pc: number; qm: number; ft: number }>(),
  fx: () => env.DB.prepare('SELECT rate FROM exchange_rates ORDER BY fetched_at DESC LIMIT 1').first<{ rate: number }>(),
  fee: (m: number) => env.DB.prepare('SELECT delivery_fee_jod fee FROM coverage_zones WHERE merchant_id=? AND active=1 ORDER BY id LIMIT 1').bind(m).first<{ fee: number }>(),
})

async function priceOrder(env: RpcEnv, a: Args) {
  const items = (a.p_items as { unit_jod: number; qty: number }[]) ?? []
  const s = items.reduce((t, i) => t + num(i.unit_jod) * num(i.qty), 0)
  const p = (await q(env).params()) ?? { pc: 0.2, qm: 1.5, ft: 0.015 }
  let fee = (await q(env).fee(num(a.p_merchant)))?.fee ?? 0
  if (a.p_delivery_type === 'quick') fee *= p.qm
  const dm = num(a.p_discount_merchant_jod), da = num(a.p_discount_applicator_jod)
  const ftc = a.p_payment_method === 'qris' ? Math.round(p.ft * (s - dm - da + fee + p.pc) * 100) / 100 : 0
  const totalJod = s - dm - da + fee + p.pc + ftc
  const rate = (await q(env).fx())?.rate ?? 0
  const raw = totalJod * rate
  const totalIdr = Math.ceil(raw / 100) * 100
  return { subtotal_jod: s, discount_merchant_jod: dm, discount_applicator_jod: da, delivery_fee_jod: fee, platform_fee_customer_jod: p.pc, platform_fee_merchant_jod: 0.25, transaction_fee_jod: ftc, transaction_fee_idr: Math.round(ftc * rate), total_jod: totalJod, rate_locked: rate, total_idr: totalIdr, rounding_up_idr: totalIdr - Math.trunc(raw), payment_method: a.p_payment_method ?? 'qris', delivery_type: a.p_delivery_type ?? 'regular' }
}

async function computeDiscounts(env: RpcEnv, a: Args) {
  const { results } = await env.DB.prepare(
    `SELECT mp.owner, mp.is_stackable, MAX(COALESCE(mr.value_jod,0)) vj, MAX(COALESCE(mr.percent,0)) pc
     FROM marketing_programs mp LEFT JOIN marketing_rewards mr ON mr.program_id=mp.id
     WHERE mp.active=1 AND (mp.owner='applicator' OR mp.merchant_id=?) GROUP BY mp.id`).bind(num(a.p_merchant)).all<{ owner: string; is_stackable: number; vj: number; pc: number }>()
  const sub = num(a.p_subtotal_jod)
  let dm = 0, da = 0
  for (const p of results ?? []) {
    const r = Math.max(num(p.vj), (num(p.pc) / 100) * sub)
    if (p.is_stackable) p.owner === 'merchant' ? (dm += r) : (da += r)
    else p.owner === 'merchant' ? (dm = Math.max(dm, r)) : (da = Math.max(da, r))
  }
  return { discount_merchant_jod: dm, discount_applicator_jod: da }
}

async function checkCoverage(env: RpcEnv, a: Args): Promise<boolean> {
  const z = await env.DB.prepare('SELECT mode, center_lat, center_lng, radius_m, polygon FROM coverage_zones WHERE merchant_id=? AND active=1 ORDER BY id LIMIT 1').bind(num(a.p_merchant)).first<{ mode: string; center_lat: number; center_lng: number; radius_m: number; polygon: string | null }>()
  if (!z) return false
  if (z.mode === 'radius' && z.center_lat != null) return haversine(z.center_lat, z.center_lng, num(a.p_lat), num(a.p_lng)) <= (z.radius_m ?? 2000)
  if (z.polygon) return inPoly(num(a.p_lat), num(a.p_lng), JSON.parse(z.polygon))
  return true
}

const AVAIL = `(m.accept_without_quota=1 OR EXISTS(SELECT 1 FROM quota_subscriptions qs WHERE qs.merchant_id=m.id AND qs.status='active' AND (qs.quota_total-qs.quota_used-qs.quota_reserved)>0))`
async function browseMerchants(env: RpcEnv, a: Args) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.store_name, m.description, m.photo, m.latitude, m.longitude, m.rating_avg, m.rating_count, m.store_status,
       (SELECT COUNT(*) FROM orders o WHERE o.merchant_id=m.id) order_count
     FROM merchants m WHERE m.tenant_status='approved'
       AND (?1 IS NULL OR m.store_name LIKE ?1 OR m.description LIKE ?1)
       AND (?2 IS NULL OR EXISTS(SELECT 1 FROM merchant_tags t WHERE t.merchant_id=m.id AND t.tag=?2))
       AND ${AVAIL} ORDER BY m.rating_avg DESC LIMIT ?3`).bind(a.p_q ? `%${a.p_q}%` : null, a.p_tag ?? null, num(a.p_limit) || 50).all()
  return results ?? []
}
async function searchMerchants(env: RpcEnv, a: Args) {
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.store_name, m.photo, m.store_status, m.rating_avg, m.rating_count, m.open_time, m.close_time,
       (SELECT MIN(price_jod) FROM menus WHERE merchant_id=m.id) min_price_jod
     FROM merchants m WHERE m.tenant_status='approved' AND (?1 IS NULL OR m.store_name LIKE ?1) ORDER BY m.rating_avg DESC LIMIT 50`).bind(a.p_query ? `%${a.p_query}%` : null).all()
  return results ?? []
}

async function reserveQuota(env: RpcEnv, a: Args): Promise<string | null> {
  const kinds = a.p_is_cod ? ['order_cod'] : ['order', 'order_cod']
  for (const kind of kinds) {
    const row = await env.DB.prepare(`SELECT id FROM quota_subscriptions WHERE merchant_id=? AND kind=? AND status='active' AND (quota_total-quota_used-quota_reserved)>0 ORDER BY id LIMIT 1`).bind(num(a.p_merchant), kind).first<{ id: number }>()
    if (row) { await env.DB.prepare('UPDATE quota_subscriptions SET quota_reserved=quota_reserved+1 WHERE id=?').bind(row.id).run(); return kind }
  }
  if (!a.p_is_cod) {
    const m = await env.DB.prepare('SELECT accept_without_quota FROM merchants WHERE id=?').bind(num(a.p_merchant)).first<{ accept_without_quota: number }>()
    if (m?.accept_without_quota) return 'none'
  }
  return null
}
async function consumeQuota(env: RpcEnv, a: Args) {
  if (!a.p_kind || a.p_kind === 'none') return
  await env.DB.prepare(`UPDATE quota_subscriptions SET quota_reserved=MAX(quota_reserved-1,0), quota_used=quota_used+1 WHERE id=(SELECT id FROM quota_subscriptions WHERE merchant_id=? AND kind=? AND status='active' ORDER BY id LIMIT 1)`).bind(num(a.p_merchant), a.p_kind).run()
}
async function releaseQuota(env: RpcEnv, a: Args) {
  if (!a.p_kind || a.p_kind === 'none') return
  await env.DB.prepare(`UPDATE quota_subscriptions SET quota_reserved=MAX(quota_reserved-1,0) WHERE id=(SELECT id FROM quota_subscriptions WHERE merchant_id=? AND kind=? AND status='active' ORDER BY id LIMIT 1)`).bind(num(a.p_merchant), a.p_kind).run()
}

async function createOrder(env: RpcEnv, a: Args) {
  const addr = await env.DB.prepare('SELECT latitude, longitude FROM addresses WHERE id=?').bind(num(a.p_address)).first<{ latitude: number; longitude: number }>()
  if (!addr) throw new Error('alamat tidak ada')
  if (!(await checkCoverage(env, { p_merchant: a.p_merchant, p_lat: addr.latitude, p_lng: addr.longitude }))) throw new Error('alamat di luar coverage')
  const kind = await reserveQuota(env, { p_merchant: a.p_merchant, p_is_cod: a.p_payment_method === 'cod' })
  if (kind === null) throw new Error('kuota habis')
  const items = (a.p_items as { menu_id: number; unit_jod: number; qty: number; name?: string }[]) ?? []
  const disc = await computeDiscounts(env, { p_merchant: a.p_merchant, p_subtotal_jod: items.reduce((t, i) => t + num(i.unit_jod) * num(i.qty), 0) })
  const price = await priceOrder(env, { ...a, p_discount_merchant_jod: disc.discount_merchant_jod, p_discount_applicator_jod: disc.discount_applicator_jod })
  const c = code()
  const expires = new Date(Date.now() + 30 * 60000).toISOString()
  const res = await env.DB.prepare(
    `INSERT INTO orders (code,status,customer_id,merchant_id,delivery_address_id,sub_total_jod,delivery_fee_jod,platform_fee_jod,total_jod,total_idr,payment_method,payment_status,delivery_type,quota_kind_used,rate_locked,transaction_fee_jod,transaction_fee_idr,rounding_up_idr,platform_fee_customer_jod,platform_fee_merchant_jod,discount_merchant_jod,discount_applicator_jod,order_note,refund_status,payment_expires_at)
     VALUES (?, 'prepare', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'none', ?)`,
  ).bind(c, num(a.p_customer), num(a.p_merchant), num(a.p_address), price.subtotal_jod, price.delivery_fee_jod, price.platform_fee_customer_jod, price.total_jod, price.total_idr, a.p_payment_method ?? 'qris', a.p_delivery_type ?? 'regular', kind, price.rate_locked, price.transaction_fee_jod, price.transaction_fee_idr, price.rounding_up_idr, price.platform_fee_customer_jod, price.platform_fee_merchant_jod, disc.discount_merchant_jod, disc.discount_applicator_jod, a.p_note ?? null, expires).run()
  const id = res.meta.last_row_id
  for (const i of items) await env.DB.prepare('INSERT INTO order_items (order_id,menu_id,name,qty,unit_price_jod,line_total_jod) VALUES (?,?,?,?,?,?)').bind(id, num(i.menu_id), i.name ?? '', num(i.qty), num(i.unit_jod), num(i.unit_jod) * num(i.qty)).run()
  const ch = await env.DB.prepare('INSERT INTO chats (order_id,auto_close_at) VALUES (?,?)').bind(id, new Date(Date.now() + 86400000).toISOString()).run()
  const chatId = ch.meta.last_row_id
  const cust = await env.DB.prepare('SELECT user_id FROM customers WHERE id=?').bind(num(a.p_customer)).first<{ user_id: number }>()
  const mer = await env.DB.prepare('SELECT user_id FROM merchants WHERE id=?').bind(num(a.p_merchant)).first<{ user_id: number }>()
  for (const [uid, role] of [[cust?.user_id, 'customer'], [mer?.user_id, 'merchant']] as [number | undefined, string][]) {
    if (uid) await env.DB.prepare('INSERT OR IGNORE INTO chat_participants (chat_id,user_id,role) VALUES (?,?,?)').bind(chatId, uid, role).run()
  }
  if (mer?.user_id) await env.DB.prepare('INSERT INTO notifications (user_id,kind,title,body,audience,order_id) VALUES (?,?,?,?,?,?)').bind(mer.user_id, 'order', 'Order baru', c, 'merchant', id).run()
  return id
}
async function completeOrder(env: RpcEnv, a: Args) {
  const o = await env.DB.prepare('SELECT * FROM orders WHERE id=?').bind(num(a.p_order)).first<Record<string, unknown>>()
  if (!o) throw new Error('order tidak ada')
  await env.DB.prepare("UPDATE orders SET status='done', payment_status='paid' WHERE id=?").bind(num(a.p_order)).run()
  await consumeQuota(env, { p_merchant: o.merchant_id, p_kind: o.quota_kind_used })
  const pc = (await q(env).params())?.pc ?? 0.2
  let merAmt = num(o.sub_total_jod) - num(o.discount_merchant_jod), appAmt = pc - num(o.discount_applicator_jod)
  if (o.quota_kind_used === 'order_cod') { merAmt += pc; appAmt = -num(o.discount_applicator_jod) }
  else if (o.quota_kind_used !== 'order') { merAmt -= 0.25; appAmt = pc + 0.25 - num(o.discount_applicator_jod) }
  for (const [party, amt, type] of [['merchant', merAmt, 'payout'], ['courier', num(o.delivery_fee_jod), 'payout'], ['applicator', appAmt, 'fee']] as [string, number, string][]) {
    await env.DB.prepare('INSERT OR IGNORE INTO enterprise_ledger (order_id,entry_type,party,amount_jod,amount_idr,idempotency_key) VALUES (?,?,?,?,0,?)').bind(num(a.p_order), type, party, amt, `settle:${a.p_order}:${party}`).run()
  }
}
async function cancelOrder(env: RpcEnv, a: Args) {
  const o = await env.DB.prepare('SELECT merchant_id, quota_kind_used, payment_status, total_idr FROM orders WHERE id=?').bind(num(a.p_order)).first<Record<string, unknown>>()
  if (!o) throw new Error('order tidak ada')
  await releaseQuota(env, { p_merchant: o.merchant_id, p_kind: o.quota_kind_used })
  await env.DB.prepare("UPDATE orders SET status='canceled', cancel_by=?, cancel_reason=? WHERE id=?").bind(a.p_by ?? 'system', a.p_reason ?? 'dibatalkan', num(a.p_order)).run()
  if (o.payment_status === 'paid' && num(o.total_idr) > 0) await createRefund(env, { p_order: a.p_order, p_method: 'dana', p_amount_idr: o.total_idr })
}

async function assignBatch(env: RpcEnv, a: Args) {
  const order = await env.DB.prepare('SELECT merchant_id, batch_id FROM orders WHERE id=?').bind(num(a.p_order)).first<{ merchant_id: number; batch_id: number | null }>()
  if (!order) throw new Error('order tidak ada')
  let batch = (await env.DB.prepare("SELECT id FROM batches WHERE merchant_id=? AND courier_id=? AND status IN ('prepare','waitingCourier','waitingDelivery','delivery') ORDER BY id DESC LIMIT 1").bind(order.merchant_id, num(a.p_courier)).first<{ id: number }>())?.id
  if (!batch) batch = (await env.DB.prepare("INSERT INTO batches (merchant_id,courier_id,status) VALUES (?,?,'prepare')").bind(order.merchant_id, num(a.p_courier)).run()).meta.last_row_id
  const cnt = (await env.DB.prepare('SELECT COUNT(*) c FROM orders WHERE batch_id=?').bind(batch).first<{ c: number }>())?.c ?? 0
  if (cnt >= 24) throw new Error('batch penuh (24)')
  await env.DB.prepare('UPDATE orders SET batch_id=?, courier_id=? WHERE id=?').bind(batch, num(a.p_courier), num(a.p_order)).run()
  return batch
}
async function autoSortBatch(env: RpcEnv, a: Args) {
  const b = await env.DB.prepare('SELECT b.merchant_id, m.latitude mlat, m.longitude mlng FROM batches b JOIN merchants m ON m.id=b.merchant_id WHERE b.id=?').bind(num(a.p_batch)).first<{ merchant_id: number; mlat: number; mlng: number }>()
  if (!b) return []
  const { results } = await env.DB.prepare('SELECT o.id, a.latitude lat, a.longitude lng FROM orders o JOIN addresses a ON a.id=o.delivery_address_id WHERE o.batch_id=?').bind(num(a.p_batch)).all<{ id: number; lat: number; lng: number }>()
  const pts = (results ?? []).filter((p) => p.lat != null)
  const route: number[] = []
  let clat = b.mlat, clng = b.mlng
  while (pts.length) {
    let best = 0, bd = Infinity
    pts.forEach((p, i) => { const d = haversine(clat, clng, p.lat, p.lng); if (d < bd) { bd = d; best = i } })
    const p = pts.splice(best, 1)[0]; route.push(p.id); clat = p.lat; clng = p.lng
  }
  await env.DB.prepare('UPDATE batches SET route=? WHERE id=?').bind(JSON.stringify(route), num(a.p_batch)).run()
  return route
}
async function dispatchPartner(env: RpcEnv, a: Args) {
  const c = await env.DB.prepare("SELECT id FROM couriers WHERE courier_type IN ('partner','partner_ondemand') AND availability='available' ORDER BY active_order_count ASC, id ASC LIMIT 1").first<{ id: number }>()
  if (!c) return null
  const res = await env.DB.prepare("INSERT INTO dispatch_assignments (order_id,courier_id,status) VALUES (?,?,'reserved')").bind(num(a.p_order), c.id).run()
  await env.DB.prepare('UPDATE couriers SET active_order_count=active_order_count+1 WHERE id=?').bind(c.id).run()
  return res.meta.last_row_id
}
async function respondAssignment(env: RpcEnv, a: Args) {
  if (a.p_status === 'rejected' && !a.p_reason) throw new Error('reject wajib alasan')
  const row = await env.DB.prepare('SELECT courier_id FROM dispatch_assignments WHERE id=?').bind(num(a.p_id)).first<{ courier_id: number }>()
  await env.DB.prepare('UPDATE dispatch_assignments SET status=?, reject_reason=?, responded_at=? WHERE id=?').bind(a.p_status, a.p_reason ?? null, now(), num(a.p_id)).run()
  if (a.p_status === 'rejected' && row) await env.DB.prepare('UPDATE couriers SET active_order_count=MAX(active_order_count-1,0) WHERE id=?').bind(row.courier_id).run()
}
async function createRefund(env: RpcEnv, a: Args) {
  if (!['dana', 'bank_bifast'].includes(String(a.p_method))) throw new Error('metode refund tidak valid')
  if (a.p_method === 'bank_bifast' && (!a.p_bank || !a.p_account)) throw new Error('refund bank butuh bank + rekening')
  const res = await env.DB.prepare("INSERT OR IGNORE INTO refunds (order_id,method,amount_idr,bank_name,account_number,status,idempotency_key) VALUES (?,?,?,?,?,'pending',?)").bind(num(a.p_order), a.p_method, num(a.p_amount_idr), a.p_bank ?? null, a.p_account ?? null, `refund:${a.p_order}`).run()
  await env.DB.prepare("UPDATE orders SET refund_status='pending' WHERE id=?").bind(num(a.p_order)).run()
  return res.meta.last_row_id
}
async function sendChatMessage(env: RpcEnv, a: Args) {
  const ch = await env.DB.prepare('SELECT id, closed_at FROM chats WHERE order_id=? ORDER BY id LIMIT 1').bind(num(a.p_order)).first<{ id: number; closed_at: string | null }>()
  if (!ch) throw new Error('chat tidak ada')
  if (ch.closed_at) throw new Error('chat sudah ditutup')
  const o = await env.DB.prepare('SELECT o.customer_id, o.merchant_id, o.courier_id, cu.user_id cu, mu.user_id mu, co.user_id coid FROM orders o LEFT JOIN customers cu ON cu.id=o.customer_id LEFT JOIN merchants mu ON mu.id=o.merchant_id LEFT JOIN couriers co ON co.id=o.courier_id WHERE o.id=?').bind(num(a.p_order)).first<Record<string, number>>()
  const channel = num(a.p_sender) === o?.coid ? 'merchant-courier' : 'customer-merchant'
  const res = await env.DB.prepare('INSERT INTO chat_messages (chat_id,sender_id,channel,body) VALUES (?,?,?,?)').bind(ch.id, num(a.p_sender), channel, a.p_image ? String(a.p_image) : (a.p_body ?? '')).run()
  await env.DB.prepare('UPDATE chats SET last_message=?, last_at=? WHERE id=?').bind(a.p_body ?? '[gambar]', now(), ch.id).run()
  return res.meta.last_row_id
}
async function closeStaleChats(env: RpcEnv) {
  const r = await env.DB.prepare('UPDATE chats SET closed_at=? WHERE closed_at IS NULL AND auto_close_at IS NOT NULL AND auto_close_at < ?').bind(now(), now()).run()
  return r.meta.changes ?? 0
}
async function buyQuotaPackage(env: RpcEnv, a: Args) {
  const pk = await env.DB.prepare('SELECT * FROM quota_packages WHERE id=? AND active=1').bind(num(a.p_package)).first<Record<string, unknown>>()
  if (!pk) throw new Error('paket tidak ditemukan')
  const ft = a.p_method === 'qris' ? Math.round(0.015 * num(pk.price_jod) * 100) / 100 : 0
  const ms = pk.period === 'day' ? 86400000 : pk.period === 'week' ? 604800000 : 2592000000
  const id = (await env.DB.prepare("INSERT INTO quota_subscriptions (merchant_id,kind,package_id,quota_total,period_start,period_end,status) VALUES (?,?,?,?,?,?,'active')").bind(num(a.p_merchant), pk.kind, pk.id, pk.quota, now(), new Date(Date.now() + ms).toISOString()).run()).meta.last_row_id
  await env.DB.prepare("INSERT OR IGNORE INTO enterprise_ledger (entry_type,party,amount_jod,amount_idr,idempotency_key,note) VALUES ('charge','merchant',?,0,?,?)").bind(num(pk.price_jod) + ft, `quota:${id}:charge`, `beli paket ${pk.kind}`).run()
  return id
}
async function setCourierStatus(env: RpcEnv, a: Args) {
  const map: Record<string, string> = { offline: 'unavailable', reserved: 'busy' }
  await env.DB.prepare('UPDATE couriers SET availability=? WHERE id=?').bind(map[String(a.p_status)] ?? a.p_status, num(a.p_courier)).run()
}
async function closeBatch(env: RpcEnv, a: Args) { await env.DB.prepare("UPDATE batches SET status='closed' WHERE id=?").bind(num(a.p_batch)).run() }
async function issueSp(env: RpcEnv, a: Args) {
  const res = await env.DB.prepare('INSERT INTO punishments (subject_type,subject_id,kind,level,reason,dispute_id) VALUES (?,?,?,?,?,?)').bind(a.p_subject_type, num(a.p_subject_id), a.p_kind ?? 'sp', num(a.p_level) || 1, a.p_reason ?? null, a.p_dispute ?? null).run()
  if (a.p_subject_type === 'courier' && (a.p_kind ?? 'sp') === 'sp') await env.DB.prepare("UPDATE couriers SET availability='unavailable' WHERE id=?").bind(num(a.p_subject_id)).run()
  return res.meta.last_row_id
}
async function submitReview(env: RpcEnv, a: Args) {
  const r = num(a.p_rating)
  if (r < 1 || r > 5) throw new Error('rating 1..5')
  const res = await env.DB.prepare('INSERT INTO rating_reviews (order_id,customer_id,merchant_id,menu_id,rating,review) VALUES (?,?,?,?,?,?)').bind(num(a.p_order), num(a.p_customer), a.p_merchant_id ?? null, a.p_menu_id ?? null, r, a.p_review ?? null).run()
  if (a.p_merchant_id) {
    const agg = await env.DB.prepare('SELECT AVG(rating) avg, COUNT(*) c FROM rating_reviews WHERE merchant_id=? AND deleted_at IS NULL').bind(num(a.p_merchant_id)).first<{ avg: number; c: number }>()
    await env.DB.prepare('UPDATE merchants SET rating_avg=?, rating_count=? WHERE id=?').bind(Math.round(num(agg?.avg) * 100) / 100, agg?.c ?? 0, num(a.p_merchant_id)).run()
  }
  return res.meta.last_row_id
}
async function replyReview(env: RpcEnv, a: Args) {
  const rr = await env.DB.prepare('SELECT merchant_id FROM rating_reviews WHERE id=?').bind(num(a.p_review)).first<{ merchant_id: number }>()
  if (!rr?.merchant_id) throw new Error('bukan ulasan merchant')
  const res = await env.DB.prepare('INSERT INTO review_replies (review_id,merchant_id,body) VALUES (?,?,?)').bind(num(a.p_review), rr.merchant_id, a.p_body).run()
  return res.meta.last_row_id
}
async function openDispute(env: RpcEnv, a: Args) {
  const type = ['late', 'missing', 'wrong', 'not_delivered', 'payment_failed'].includes(String(a.p_category)) ? a.p_category : 'late'
  const res = await env.DB.prepare("INSERT INTO disputes (order_id,opened_by,filed_role,category,type,status,resolution_note) VALUES (?,?,?,?,?,'open',?)").bind(num(a.p_order), num(a.p_filed_by), a.p_filed_role, a.p_category, type, a.p_reason ?? null).run()
  return res.meta.last_row_id
}
async function resolveDispute(env: RpcEnv, a: Args) {
  const map: Record<string, string> = { no_action: 'rejected' }
  const status = map[String(a.p_resolution)] ?? 'resolved'
  const d = await env.DB.prepare('SELECT order_id FROM disputes WHERE id=?').bind(num(a.p_dispute)).first<{ order_id: number }>()
  await env.DB.prepare('UPDATE disputes SET status=?, resolution=?, resolution_note=?, refund_amount_jod=?, resolved_by=?, resolved_at=? WHERE id=?').bind(status, a.p_resolution, a.p_note ?? null, num(a.p_refund_jod), num(a.p_actor), now(), num(a.p_dispute)).run()
  if (d && num(a.p_refund_jod) > 0) await env.DB.prepare("INSERT OR IGNORE INTO enterprise_ledger (order_id,entry_type,party,amount_jod,amount_idr,idempotency_key,note) VALUES (?,'refund','customer',?,0,?,'kompensasi dispute')").bind(d.order_id, num(a.p_refund_jod), `dispute:${a.p_dispute}:refund`).run()
}
async function appealDispute(env: RpcEnv, a: Args) { await env.DB.prepare("UPDATE disputes SET status='appealed' WHERE id=? AND status IN ('resolved','rejected')").bind(num(a.p_dispute)).run() }
async function snapshotDisputeRules(env: RpcEnv, a: Args) {
  const o = await env.DB.prepare('SELECT merchant_id FROM orders WHERE id=?').bind(num(a.p_order)).first<{ merchant_id: number }>()
  const { results } = await env.DB.prepare('SELECT rule_id FROM merchant_dispute_rules WHERE merchant_id=?').bind(o?.merchant_id ?? 0).all<{ rule_id: number }>()
  await env.DB.prepare('UPDATE orders SET dispute_rule_ids=? WHERE id=?').bind(JSON.stringify((results ?? []).map((r) => r.rule_id)), num(a.p_order)).run()
}
async function emitNotification(env: RpcEnv, a: Args) {
  const res = await env.DB.prepare('INSERT INTO notifications (user_id,kind,title,body,audience,order_id) VALUES (?,?,?,?,?,?)').bind(num(a.p_user), a.p_kind, a.p_title, a.p_body ?? null, a.p_audience ?? 'customer', a.p_order ?? null).run()
  return res.meta.last_row_id
}
async function requestMagicLink(env: RpcEnv, a: Args) {
  const token = crypto.randomUUID().replace(/-/g, '')
  await env.DB.prepare('INSERT INTO magic_links (email,role,token,expires_at) VALUES (?,?,?,?)').bind(String(a.p_email).toLowerCase(), a.p_role ?? 'customer', token, new Date(Date.now() + 900000).toISOString()).run()
  return token
}
async function consumeMagicLink(env: RpcEnv, a: Args) {
  const row = await env.DB.prepare('SELECT id,email,role,expires_at,consumed_at FROM magic_links WHERE token=?').bind(a.p_token).first<{ id: number; email: string; role: string; expires_at: string; consumed_at: string | null }>()
  if (!row) throw new Error('token tidak ditemukan')
  if (row.consumed_at) throw new Error('token sudah dipakai')
  if (row.expires_at < now()) throw new Error('token kedaluwarsa')
  await env.DB.prepare('UPDATE magic_links SET consumed_at=? WHERE id=?').bind(now(), row.id).run()
  return { email: row.email, role: row.role }
}
async function expireUnpaidOrders(env: RpcEnv) {
  const { results } = await env.DB.prepare("SELECT id,merchant_id,quota_kind_used FROM orders WHERE payment_status='unpaid' AND status NOT IN ('done','canceled') AND payment_method<>'cod' AND COALESCE(payment_expires_at, '9999') < ?").bind(now()).all<{ id: number; merchant_id: number; quota_kind_used: string }>()
  for (const o of results ?? []) {
    await releaseQuota(env, { p_merchant: o.merchant_id, p_kind: o.quota_kind_used })
    await env.DB.prepare("UPDATE orders SET status='canceled', cancel_by='system', cancel_reason='kadaluarsa' WHERE id=?").bind(o.id).run()
  }
  return (results ?? []).length
}
async function quotaLowAlerts(env: RpcEnv) {
  const { results } = await env.DB.prepare("SELECT qs.kind, (qs.quota_total-qs.quota_used-qs.quota_reserved) avail, m.user_id FROM quota_subscriptions qs JOIN merchants m ON m.id=qs.merchant_id WHERE qs.status='active' AND (qs.quota_total-qs.quota_used-qs.quota_reserved)<=2").all<{ kind: string; avail: number; user_id: number }>()
  for (const r of results ?? []) if (r.user_id) await env.DB.prepare("INSERT INTO notifications (user_id,kind,title,body,audience) VALUES (?, 'system', 'Kuota menipis', ?, 'merchant')").bind(r.user_id, `Kuota ${r.kind} tinggal ${Math.max(r.avail, 0)}`).run()
  return (results ?? []).length
}

const R: Record<string, (e: RpcEnv, a: Args) => Promise<unknown>> = {
  fx_rate_latest: (e) => q(e).fx().then((r) => r?.rate ?? null),
  price_order: priceOrder, compute_discounts: computeDiscounts, check_coverage: checkCoverage,
  browse_merchants: browseMerchants, search_merchants: searchMerchants,
  reserve_quota: reserveQuota, consume_quota: consumeQuota, release_quota: releaseQuota,
  create_order: createOrder, complete_order: completeOrder, cancel_order: cancelOrder,
  assign_batch: assignBatch, auto_sort_batch: autoSortBatch, dispatch_partner: dispatchPartner, respond_assignment: respondAssignment,
  create_refund: createRefund, send_chat_message: sendChatMessage, close_stale_chats: closeStaleChats,
  buy_quota_package: buyQuotaPackage, set_courier_status: setCourierStatus, close_batch: closeBatch, issue_sp: issueSp,
  submit_review: submitReview, reply_review: replyReview, open_dispute: openDispute, resolve_dispute: resolveDispute, appeal_dispute: appealDispute,
  snapshot_dispute_rules: snapshotDisputeRules, emit_notification: emitNotification,
  request_magic_link: requestMagicLink, consume_magic_link: consumeMagicLink,
  expire_unpaid_orders: expireUnpaidOrders, quota_low_alerts: quotaLowAlerts,
  run_cron_jobs: async (e) => ({ expired_orders: await expireUnpaidOrders(e), stale_chats: await closeStaleChats(e), quota_alerts: await quotaLowAlerts(e) }),
}

export async function handleRpc(env: RpcEnv, fn: string, args: Args): Promise<Response> {
  const h = R[fn]
  if (!h) return Response.json({ message: `rpc ${fn} belum diimplementasikan` }, { status: 501 })
  try {
    return Response.json(await h(env, args ?? {}))
  } catch (error) {
    return Response.json({ message: String(error) }, { status: 400 })
  }
}
