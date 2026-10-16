// =============================================================================
// Sa7tein — e2e API PRD aktif (`sa7tein-mvp-2026-10-11`)
// =============================================================================
// Menjalankan life-cycle order lewat PostgREST/RPC sungguhan (bukan SQL editor).
// Env:
//   SUPABASE_URL           (wajib)  mis. https://xxx.supabase.co
//   SUPABASE_KEY           (wajib)  anon atau service_role
//   SUPABASE_SERVICE_KEY   (opsional; kalau ada dipakai untuk langkah tulis)
//
// Pakai:  SUPABASE_URL=... SUPABASE_KEY=... node scripts/api-e2e.mjs
// =============================================================================

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
if (!URL || !KEY) {
  console.error('Butuh SUPABASE_URL dan (SUPABASE_SERVICE_KEY|SUPABASE_KEY)')
  process.exit(2)
}

let pass = 0
let fail = 0
const rows = []
function check(name, ok, detail = '') {
  rows.push({ name, ok, detail })
  if (ok) pass++
  else fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function rpc(fn, args = {}) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  let body
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) throw new Error(`${fn}: ${res.status} ${text}`)
  return body
}

async function rest(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.asin(Math.sqrt(a))
}

try {
  // ── Baca / hitung
  const rate = Number(await rpc('fx_rate_latest'))
  check('fx_rate_latest', Number.isFinite(rate) && rate > 0, `${rate} IDR/JOD`)

  const price = await rpc('price_order', {
    p_merchant: 1,
    p_items: [{ unit_jod: 2.5, qty: 2 }],
    p_delivery_type: 'regular',
    p_payment_method: 'qris',
  })
  check(
    'price_order (regular/qris)',
    price?.total_idr > 0 && price?.transaction_fee_jod >= 0 && price?.rate_locked === rate,
    `total ${price?.total_jod} JOD = ${price?.total_idr} IDR, Ft ${price?.transaction_fee_jod}`,
  )

  const disc = await rpc('compute_discounts', { p_merchant: 1, p_subtotal_jod: 5 })
  check('compute_discounts', disc && 'discount_merchant_jod' in disc, `Dm ${disc?.discount_merchant_jod} Da ${disc?.discount_applicator_jod}`)

  const merchants = await rpc('browse_merchants', { p_sort: 'rating', p_limit: 50 })
  check('browse_merchants', Array.isArray(merchants) && merchants.length > 0, `${merchants?.length} merchant`)

  // ── Order life-cycle (butuh tulis; anon biasanya diblok RLS)
  const merchantsFull = await rest('merchants?select=id,latitude,longitude&id=eq.1')
  const addresses = await rest('addresses?select=id,latitude,longitude')
  const menus = await rest('menus?select=id,name,price_jod&merchant_id=eq.1&limit=1')
  const m = merchantsFull[0]
  const addr = addresses
    .map((a) => ({ ...a, d: haversine(m.latitude, m.longitude, a.latitude, a.longitude) }))
    .sort((a, b) => a.d - b.d)[0]
  const menu = menus[0]

  const cov = await rpc('check_coverage', { p_merchant: 1, p_lat: addr.latitude, p_lng: addr.longitude })
  check('check_coverage', cov === true, `addr ${addr.id} ${Math.round(addr.d)}m`)

  const kind = await rpc('reserve_quota', { p_merchant: 1, p_is_cod: false })
  check('reserve_quota', kind === 'order' || kind === 'order_cod' || kind === 'none', String(kind))
  if (kind && kind !== 'none') await rpc('release_quota', { p_merchant: 1, p_kind: kind })

  const orderId = await rpc('create_order', {
    p_customer: 1,
    p_merchant: 1,
    p_address: addr.id,
    p_items: [{ menu_id: menu.id, name: menu.name, unit_jod: menu.price_jod, qty: 2 }],
    p_delivery_type: 'regular',
    p_payment_method: 'qris',
    p_note: 'e2e',
  })
  check('create_order', Number.isFinite(orderId), `order ${orderId}`)

  const saved = (await rest(`orders?select=id,status,quota_kind_used,total_idr,transaction_fee_idr,delivery_type&id=eq.${orderId}`))[0]
  check('order tersimpan', saved?.delivery_type === 'regular' && saved?.total_idr > 0, `status ${saved?.status}, kuota ${saved?.quota_kind_used}`)

  const items = await rest(`order_items?select=id&order_id=eq.${orderId}`)
  check('order_items', items.length > 0, `${items.length} item`)

  const chats = await rest(`chats?select=id&order_id=eq.${orderId}`)
  check('chat dibuat', chats.length > 0, `chat ${chats[0]?.id}`)

  const msgId = await rpc('send_chat_message', { p_order: orderId, p_sender: 1, p_body: 'halo e2e' })
  check('send_chat_message', Number.isFinite(msgId), `msg ${msgId}`)

  const batch = await rpc('assign_batch', { p_order: orderId, p_courier: 1 })
  check('assign_batch', Number.isFinite(batch), `batch ${batch}`)
  const route = await rpc('auto_sort_batch', { p_batch: batch })
  check('auto_sort_batch', Array.isArray(route) && route.includes(orderId), `route [${route}]`)

  await rpc('complete_order', { p_order: orderId })
  const done = (await rest(`orders?select=status,payment_status&id=eq.${orderId}`))[0]
  check('complete_order', done?.status === 'done', `status ${done?.status}`)
  const ledger = await rest(`enterprise_ledger?select=id,party&order_id=eq.${orderId}`)
  check('enterprise_ledger', ledger.length === 3, `${ledger.length} entri (${ledger.map((l) => l.party).join(',')})`)

  // ── Cancel + refund
  const order2 = await rpc('create_order', {
    p_customer: 1,
    p_merchant: 1,
    p_address: addr.id,
    p_items: [{ menu_id: menu.id, name: menu.name, unit_jod: menu.price_jod, qty: 1 }],
    p_delivery_type: 'quick',
    p_payment_method: 'dana_balance',
    p_note: 'e2e-cancel',
  })
  check('create_order #2 (quick/dana)', Number.isFinite(order2), `order ${order2}`)
  await rpc('cancel_order', { p_order: order2, p_by: 'customer', p_reason: 'e2e batal' })
  const cancelled = (await rest(`orders?select=status,refund_status&id=eq.${order2}`))[0]
  check('cancel_order', cancelled?.status === 'canceled', `status ${cancelled?.status}`)

  const kpi = await rest('ops_kpis?select=orders_done,orders_canceled,gmv_jod')
  check('ops_kpis', Number.isFinite(Number(kpi[0]?.orders_done)), `done ${kpi[0]?.orders_done}, canceled ${kpi[0]?.orders_canceled}`)
} catch (e) {
  check('exception', false, e.message)
}

console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
