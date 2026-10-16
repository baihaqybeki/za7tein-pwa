// Sa7tein API Worker (backend) — D1 + R2. Kontrak: docs/backend/CONSUME-cloudflare.md.
// FE punya URL sendiri (deploy terpisah) → cross-origin, jadi CORS wajib.
import { handleRest, type RestEnv } from './rest'
import { handleRpc, type RpcEnv } from './rpc'

export interface Env extends RestEnv, RpcEnv {
  KV: KVNamespace
  R2_MENU: R2Bucket
  R2_MERCHANT: R2Bucket
  R2_AVATARS: R2Bucket
  API_VERSION: string
  BACKEND: string
  ALLOWED_ORIGIN: string
}

const BUCKETS = (env: Env): Record<string, R2Bucket> => ({
  'menu-images': env.R2_MENU,
  'merchant-photos': env.R2_MERCHANT,
  avatars: env.R2_AVATARS,
})

// `/v1/...` dan `/...` setara (kontrak stabil antar versi).
const relPath = (p: string): string => p.replace(/^\/v1(?=\/|$)/, '') || '/'

function cors(env: Env): Record<string, string> {
  return {
    'access-control-allow-origin': env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization,apikey,x-api-key,prefer',
    'access-control-max-age': '86400',
    vary: 'Origin',
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
  if (path === '/version') {
    return Response.json({ api: env.API_VERSION, backend: env.BACKEND, schema: 'd1' })
  }

  const rpc = path.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/)
  if (rpc && request.method === 'POST') {
    const args = await request.json().catch(() => ({}))
    return handleRpc(env, rpc[1], args as Record<string, unknown>)
  }
  const table = path.match(/^\/rest\/v1\/([a-z_]+)$/)
  if (table && request.method === 'GET') {
    return handleRest(env, table[1], url.searchParams)
  }

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
