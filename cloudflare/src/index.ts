// Sa7tein API Worker (backend) — D1 + R2. Kontrak: docs/backend/CONSUME-cloudflare.md.
// C3 auth (JWT) · C5 realtime (DO) · tulis generik + authz + embed + count.
import { handleRest, type RestEnv, type RestIdentity } from './rest'
import { handleRpc, type RpcEnv } from './rpc'
import { handleAuth, identity, type AuthEnv } from './auth'
import { RealtimeHub } from './realtime'

export { RealtimeHub }

export interface Env extends RestEnv, RpcEnv, AuthEnv {
  KV: KVNamespace
  R2_MENU: R2Bucket
  R2_MERCHANT: R2Bucket
  R2_AVATARS: R2Bucket
  REALTIME: DurableObjectNamespace
  API_VERSION: string
  BACKEND: string
  ALLOWED_ORIGIN: string
}

const BUCKETS = (env: Env): Record<string, R2Bucket> => ({
  'menu-images': env.R2_MENU,
  'merchant-photos': env.R2_MERCHANT,
  avatars: env.R2_AVATARS,
})

const relPath = (p: string): string => p.replace(/^\/v1(?=\/|$)/, '') || '/'

const WRITE_RPCS = new Set([
  'reserve_quota', 'consume_quota', 'release_quota', 'create_order', 'complete_order', 'cancel_order',
  'assign_batch', 'auto_sort_batch', 'close_batch', 'start_batch', 'dispatch_partner', 'respond_assignment', 'create_refund', 'send_chat_message',
  'buy_quota_package', 'set_courier_status', 'close_batch', 'submit_review', 'reply_review',
  'open_dispute', 'resolve_dispute', 'appeal_dispute', 'snapshot_dispute_rules', 'emit_notification',
  'my_order_otp', 'verify_order_otp', 'update_courier_location', 'pay_order', 'accept_order', 'reject_order', 'pickup_order', 'arrive_order',
])
const AUTH_RPCS = new Set(['courier_location'])
const OPS_RPCS = new Set(['issue_sp', 'ops_set_platform_params'])
const READ_RPCS = new Set(['fx_rate_latest', 'price_order', 'compute_discounts', 'check_coverage', 'browse_merchants', 'search_merchants'])

function cors(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,apikey,x-api-key,prefer',
    'access-control-max-age': '86400',
    vary: 'Origin',
  }
}

async function broadcast(env: Env, topic: string, payload: unknown): Promise<void> {
  try {
    const stub = env.REALTIME.get(env.REALTIME.idFromName(topic))
    await stub.fetch('https://do/broadcast', { method: 'POST', body: JSON.stringify(payload) })
  } catch {
    /* best effort */
  }
}

async function route(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url)
  const path = relPath(url.pathname)
  const prefer = request.headers.get('prefer') ?? ''

  if (path === '/health') {
    const cache = caches.default
    const key = new Request('https://cache.internal/health')
    const hit = await cache.match(key)
    if (hit) return hit
    let db: string
    try {
      await env.DB.prepare('select 1 as ok').first()
      db = 'ok'
    } catch (error) {
      db = `error: ${error instanceof Error ? error.message : String(error)}`
    }
    const res = Response.json({ ok: true, service: 'sa7tein-api-cf', backend: env.BACKEND, api: env.API_VERSION, db })
    const copy = new Response(res.body, res)
    copy.headers.set('cache-control', 'public, max-age=60')
    ctx.waitUntil(cache.put(key, copy.clone()))
    return copy
  }
  if (path === '/version') return Response.json({ api: env.API_VERSION, backend: env.BACKEND, schema: 'd1' })

  if (path.startsWith('/auth/')) return handleAuth(env, path, request)

  if (path === '/ws') {
    const topic = url.searchParams.get('topic') ?? 'orders'
    return env.REALTIME.get(env.REALTIME.idFromName(topic)).fetch(request)
  }

  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)
  if (rpc && request.method === 'POST') {
    const fn = rpc[1]
    const id = await identity(request, env)
    if ((WRITE_RPCS.has(fn) || AUTH_RPCS.has(fn)) && !id) return Response.json({ message: 'unauthorized — login dulu' }, { status: 401 })
    if (OPS_RPCS.has(fn) && !(id && ['cs', 'superadmin'].includes(id.role))) return Response.json({ message: 'forbidden — ops only' }, { status: 403 })
    const args = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (READ_RPCS.has(fn)) {
      const cache = caches.default
      const key = new Request(`https://cache.internal/rpc/${fn}?a=${encodeURIComponent(JSON.stringify(args))}`)
      const hit = await cache.match(key)
      if (hit) return hit
      const res = await handleRpc(env, fn, args, id)
      if (res.ok) {
        const copy = new Response(res.body, res)
        copy.headers.set('cache-control', 'public, max-age=30, stale-while-revalidate=60')
        ctx.waitUntil(cache.put(key, copy.clone()))
        return copy
      }
      return res
    }
    const res = await handleRpc(env, fn, args, id)
    if (WRITE_RPCS.has(fn) && res.status < 400) await broadcast(env, 'orders', { type: 'rpc', fn, at: Date.now() })
    return res
  }

  const table = path.match(/^\/rest\/v1\/([a-z_]+)$/)
  if (table) {
    const tbl = table[1]
    const countExact = prefer.includes('count=exact')
    if (request.method === 'GET') {
      const cache = caches.default
      const cacheKey = new Request(url.toString(), { method: 'GET' })
      const hit = await cache.match(cacheKey)
      if (hit) return hit
      const res = await handleRest(env, tbl, url.searchParams, undefined, countExact)
      if (res.ok) {
        const copy = new Response(res.body, res)
        copy.headers.set('cache-control', 'public, max-age=60, stale-while-revalidate=120')
        ctx.waitUntil(cache.put(cacheKey, copy.clone()))
        return copy
      }
      return res
    }
    if (['POST', 'PATCH', 'DELETE'].includes(request.method)) {
      const id = await identity(request, env)
      if (!id) return Response.json({ message: 'unauthorized' }, { status: 401 })
      const body = request.method === 'DELETE' ? null : await request.json().catch(() => ({}))
      const res = await handleRest(env, tbl, url.searchParams, {
        method: request.method as 'POST' | 'PATCH' | 'DELETE',
        body,
        identity: id as RestIdentity,
        prefer,
      })
      if (res.status < 400) await broadcast(env, tbl, { type: request.method.toLowerCase(), table: tbl, at: Date.now() })
      return res
    }
  }

  const media = path.match(/^\/media\/([^/]+)\/(.+)$/)
  if (media) {
    const bucket = BUCKETS(env)[media[1]]
    if (!bucket) return new Response('unknown bucket', { status: 404 })
    const key = decodeURIComponent(media[2])
    if (request.method === 'GET') {
      const cache = caches.default
      const cacheKey = new Request(request.url, { method: 'GET' })
      const hit = await cache.match(cacheKey)
      if (hit) return hit
      const object = await bucket.get(key)
      if (!object) return new Response('not found', { status: 404 })
      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('etag', object.httpEtag)
      headers.set('cache-control', 'public, max-age=86400, immutable')
      const res = new Response(object.body, { headers })
      ctx.waitUntil(cache.put(cacheKey, res.clone()))
      return res
    }
    const id = await identity(request, env)
    if (!id) return Response.json({ message: 'unauthorized' }, { status: 401 })
    if (request.method === 'PUT' || request.method === 'POST') {
      const contentType = request.headers.get('content-type') ?? 'application/octet-stream'
      await bucket.put(key, request.body, { httpMetadata: { contentType } })
      return Response.json({ ok: true, key, bucket: media[1] }, { status: 201 })
    }
    if (request.method === 'DELETE') {
      await bucket.delete(key)
      return new Response(null, { status: 204 })
    }
    return new Response('method not allowed', { status: 405 })
  }

  return new Response('Not Found', { status: 404 })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const headers = cors(env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const res = await route(request, env, ctx)
    if (res.status === 101) return res
    const merged = new Headers(res.headers)
    for (const [k, v] of Object.entries(headers)) merged.set(k, v)
    return new Response(res.body, { status: res.status, headers: merged })
  },
} satisfies ExportedHandler<Env>
