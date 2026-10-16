// Sa7tein API Worker — target migrasi dari Supabase (lihat docs/backend/MIGRATION-cloudflare.md).
// Tahap awal: health check membuktikan binding D1/R2 hidup. Route `/rest/v1/*` dan `/rpc/*`
// menyusul per fase C2.
export interface Env {
  DB: D1Database
  R2: R2Bucket
  KV: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname === '/health') {
      let db: string
      try {
        await env.DB.prepare('select 1 as ok').first()
        db = 'ok'
      } catch (error) {
        db = `error: ${error instanceof Error ? error.message : String(error)}`
      }
      return Response.json({ ok: true, service: 'sa7tein-api-cf', db })
    }
    return new Response('Not Found', { status: 404 })
  },
} satisfies ExportedHandler<Env>
