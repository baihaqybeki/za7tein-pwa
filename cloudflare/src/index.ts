// Sa7tein API Worker (backend) — D1 + R2. Kontrak: docs/backend/CONSUME-cloudflare.md.
// C3 auth (JWT HS256 + magic link) · C5 realtime (Durable Object WebSocket).
import { handleRest, type RestEnv } from './rest'
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

// RPC yang mengubah data → wajib login (C3). Ops-only → peran cs/superadmin.
const WRITE_RPCS = new Set([
  'reserve_quota', 'consume_quota', 'release_quota', 'create_order', 'complete_order', 'cancel_order',
  'assign_batch', 'dispatch_partner', 'respond_assignment', 'create_refund', 'send_chat_message',
  'buy_quota_package', 'set_courier_status', 'close_batch', 'submit_review', 'reply_review',
  'open_dispute', 'resolve_dispute', 'appeal_dispute', 'snapshot_dispute_rules', 'emit_notification',
])
const OPS_RPCS = new Set(['issue_sp', 'ops_set_platform_params'])

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

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = relPath(url.pathname)

  if (path === '/health') {
    let db: string
    try {
      await env.DB.prepare('select 1 as ok').first()
      db = 'ok'
    } catch (error) {
      db = `error: ${error instanceof Error ? error.message : String(error)}`
    }
    return Response.json({ ok: true, service: 'sa7tein-api-cf', backend: env.BACKEND, api: env.API_VERSION, db })
  }
  if (path === '/version') return Response.json({ api: env.API_VERSION, backend: env.BACKEND, schema: 'd1' })

  if (path.startsWith('/auth/')) return handleAuth(env, path, request)

  // Realtime: WebSocket ke Durable Object.
  if (path === '/ws') {
    const topic = url.searchParams.get('topic') ?? 'orders'
    const stub = env.REALTIME.get(env.REALTIME.idFromName(topic))
    return stub.fetch(request)
  }

  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)
  if (rpc && request.method === 'POST') {
    const fn = rpc[1]
    const id = await identity(request, env)
    if (WRITE_RPCS.has(fn) && !id) return Response.json({ message: 'unauthorized — login dulu' }, { status: 401 })
    if (OPS_RPCS.has(fn) && !(id && ['cs', 'superadmin'].includes(id.role))) return Response.json({ message: 'forbidden — ops only' }, { status: 403 })
    const args = await request.json().catch(() => ({}))
    const res = await handleRpc(env, fn, args as Record<string, unknown>)
    if (WRITE_RPCS.has(fn) && res.status < 400) await broadcast(env, 'orders', { type: 'rpc', fn, at: Date.now() })
    return res
  }
  const table = path.match(/^\/rest\/v1\/([a-z_]+)$/)
  if (table && request.method === 'GET') return handleRest(env, table[1], url.searchParams)

  const media = path.match(/^\/media\/([^/]+)\/(.+)$/)
  if (media) {
    const bucket = BUCKETS(env)[media[1]]
    if (!bucket) return new Response('unknown bucket', { status: 404 })
    const key = decodeURIComponent(media[2])
    if (request.method === 'GET') {
      const object = await bucket.get(key)
      if (!object) return new Response('not found', { status: 404 })
      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('etag', object.httpEtag)
      return new Response(object.body, { headers })
    }
    if (request.method === 'PUT' || request.method === 'POST') {
      const contentType = request.headers.get('content-type') ?? 'application/octet-stream'
      await bucket.put(key, request.body, { httpMetadata: { contentType } })
      return Response.json({ ok: true, key, bucket: media[1] }, { status: 201 })
    }
    return new Response('method not allowed', { status: 405 })
  }

  return new Response('Not Found', { status: 404 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(env)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const res = await route(request, env)
    const merged = new Headers(res.headers)
    for (const [k, v] of Object.entries(headers)) merged.set(k, v)
    return new Response(res.body, { status: res.status, headers: merged })
  },
} satisfies ExportedHandler<Env>
