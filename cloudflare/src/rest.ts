// Subset PostgREST read langsung ke Postgres via Hyperdrive (C2).
import { pg, type HyperdriveBinding } from './pg'

export interface RestEnv {
  HYPERDRIVE: HyperdriveBinding
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset'])
const ident = (n: string): string => (/^[a-z_][a-z0-9_]*$/.test(n) ? n : (() => { throw new Error(`identifier tidak valid: ${n}`) })())

function where(params: URLSearchParams): { clause: string; binds: unknown[] } {
  const parts: string[] = []
  const binds: unknown[] = []
  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key)) continue
    const col = ident(key)
    if (raw === 'not.is.null') parts.push(`${col} IS NOT NULL`)
    else if (raw === 'is.null') parts.push(`${col} IS NULL`)
    else if (raw.startsWith('eq.')) (parts.push(`${col} = $${binds.length + 1}`), binds.push(raw.slice(3)))
    else if (raw.startsWith('neq.')) (parts.push(`${col} <> $${binds.length + 1}`), binds.push(raw.slice(4)))
    else if (raw.startsWith('gte.')) (parts.push(`${col} >= $${binds.length + 1}`), binds.push(raw.slice(4)))
    else if (raw.startsWith('lte.')) (parts.push(`${col} <= $${binds.length + 1}`), binds.push(raw.slice(4)))
    else if (raw.startsWith('ilike.')) (parts.push(`${col} ILIKE $${binds.length + 1}`), binds.push(`%${raw.slice(6).replace(/%/g, '')}%`))
  }
  return { clause: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', binds }
}

function orderBy(params: URLSearchParams): string {
  const raw = params.get('order')
  if (!raw) return ''
  return ` ORDER BY ${raw.split(',').map((t) => { const [c, d] = t.split('.'); return `${ident(c)} ${d === 'desc' ? 'DESC' : 'ASC'}` }).join(', ')}`
}

export async function handleRest(env: RestEnv, table: string, params: URLSearchParams): Promise<Response> {
  try {
    const select = params.get('select') || '*'
    const cols = select === '*' ? '*' : select.split(',').map((c) => ident(c.trim())).join(',')
    const { clause, binds } = where(params)
    const limit = Math.min(Number(params.get('limit')) || 100, 1000)
    const offset = Number(params.get('offset')) || 0
    const sql = pg(env.HYPERDRIVE)
    const q = `SELECT ${cols} FROM public.${ident(table)}${clause}${orderBy(params)} LIMIT ${limit} OFFSET ${offset}`
    const rows = await sql.unsafe(q, binds)
    return Response.json(rows)
  } catch (error) {
    return Response.json({ code: 'PGRST', message: String(error) }, { status: 400 })
  }
}
