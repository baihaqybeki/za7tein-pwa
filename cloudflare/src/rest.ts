// Subset PostgREST read di atas D1 (SQLite).
export interface RestEnv {
  DB: D1Database
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
    else if (raw.startsWith('eq.')) (parts.push(`${col} = ?`), binds.push(raw.slice(3)))
    else if (raw.startsWith('neq.')) (parts.push(`${col} <> ?`), binds.push(raw.slice(4)))
    else if (raw.startsWith('gte.')) (parts.push(`${col} >= ?`), binds.push(raw.slice(4)))
    else if (raw.startsWith('lte.')) (parts.push(`${col} <= ?`), binds.push(raw.slice(4)))
    else if (raw.startsWith('ilike.')) (parts.push(`${col} LIKE ?`), binds.push(`%${raw.slice(6).replace(/%/g, '')}%`))
    else if (raw.startsWith('in.(') && raw.endsWith(')')) {
      const vals = raw.slice(4, -1).split(',').map((v) => v.replace(/^"|"$/g, ''))
      parts.push(`${col} IN (${vals.map(() => '?').join(',')})`)
      binds.push(...vals)
    }
  }
  return { clause: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', binds }
}

export async function handleRest(env: RestEnv, table: string, params: URLSearchParams): Promise<Response> {
  try {
    const select = params.get('select') || '*'
    const cols = select === '*' ? '*' : select.split(',').map((c) => ident(c.trim())).join(',')
    const { clause, binds } = where(params)
    const order = params.get('order')
    const orderSql = order ? ` ORDER BY ${order.split(',').map((t) => { const [c, d] = t.split('.'); return `${ident(c)} ${d === 'desc' ? 'DESC' : 'ASC'}` }).join(', ')}` : ''
    const limit = Math.min(Number(params.get('limit')) || 100, 1000)
    const offset = Number(params.get('offset')) || 0
    const { results } = await env.DB.prepare(`SELECT ${cols} FROM ${ident(table)}${clause}${orderSql} LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all()
    return Response.json(results ?? [])
  } catch (error) {
    return Response.json({ code: 'PGRST', message: String(error) }, { status: 400 })
  }
}
