// Sa7tein API Worker — target migrasi dari Supabase (docs/backend/MIGRATION-cloudflare.md).
// Kontrak dijaga agar FE bisa berjalan paralel dengan Supabase selama migrasi
// (lihat docs/backend/MIGRATION-versioning.md).
export interface Env {
  DB: D1Database
  KV: KVNamespace
  R2_MENU: R2Bucket
  R2_MERCHANT: R2Bucket
  R2_AVATARS: R2Bucket
  API_VERSION: string
  BACKEND: string
}

const BUCKETS = (env: Env): Record<string, R2Bucket> => ({
  'menu-images': env.R2_MENU,
  'merchant-photos': env.R2_MERCHANT,
  avatars: env.R2_AVATARS,
})

// `/v1/...` dan `/...` dianggap sama (kontrak stabil antar versi).
function relPath(pathname: string): string {
  return pathname.replace(/^\/v1(?=\/|$)/, '') || '/'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    const path = relPath(pathname)

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

    // Media R2: GET (publik baca) / PUT (unggah). Authz unggah menyusul (C2/C3).
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
  },
} satisfies ExportedHandler<Env>
