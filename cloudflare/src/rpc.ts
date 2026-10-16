// RPC → memanggil fungsi Postgres existing (supabase/31-47) via Hyperdrive.
import { pg, type HyperdriveBinding } from './pg'

export interface RpcEnv {
  HYPERDRIVE: HyperdriveBinding
}

// Fungsi yang mengembalikan tabel (dibaca `select * from`), sisanya skalar/void.
const TABLE_FUNCS = new Set(['browse_merchants', 'search_merchants', 'ops_revenue_daily'])
// Argumen yang bertipe jsonb (perlu cast).
const JSONB_ARGS = new Set(['p_items', 'p_polygon', 'p_exclude_for'])

export async function handleRpc(env: RpcEnv, fn: string, args: Record<string, unknown>): Promise<Response> {
  if (!/^[a-z_][a-z0-9_]*$/.test(fn)) return Response.json({ message: 'fn tidak valid' }, { status: 400 })
  const sql = pg(env.HYPERDRIVE)
  try {
    const entries = Object.entries(args ?? {}).filter(([k]) => /^p_[a-z0-9_]+$/.test(k))
    const named = entries.map(([k], i) => `${k} => $${i + 1}`).join(', ')
    const binds = entries.map(([k, v]) => (JSONB_ARGS.has(k) ? sql.json((v ?? null) as never) : v))
    const call = `public.${fn}(${named})`
    if (TABLE_FUNCS.has(fn)) {
      const rows = await sql.unsafe(`select * from ${call}`, binds)
      return Response.json(rows)
    }
    const rows = await sql.unsafe(`select ${call} as result`, binds)
    return Response.json(rows[0]?.result ?? null)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    const code = /does not exist/.test(msg) ? 501 : 400
    return Response.json({ message: msg }, { status: code })
  }
}
