// REST di atas D1: baca (embed + count) + tulis generik (POST/PATCH/DELETE) dengan authz per baris.
export interface RestEnv {
  DB: D1Database
}
export interface RestIdentity {
  id: number
  role: string
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset'])
const ident = (n: string): string => (/^[a-z_][a-z0-9_]*$/.test(n) ? n : (() => { throw new Error(`identifier tidak valid: ${n}`) })())
const isOps = (id: RestIdentity | null): boolean => Boolean(id && ['cs', 'superadmin'].includes(id.role))

// Relasi embed yang didukung: base.rel -> { fk kolom di base, target tabel, kolom target }
const RELATIONS: Record<string, Record<string, { fk: string; target: string; targetCol: string }>> = {
  customers: { users: { fk: 'user_id', target: 'users', targetCol: 'id' } },
  order_items: { menus: { fk: 'menu_id', target: 'menus', targetCol: 'id' } },
  orders: {
    merchants: { fk: 'merchant_id', target: 'merchants', targetCol: 'id' },
    customers: { fk: 'customer_id', target: 'customers', targetCol: 'id' },
  },
  couriers: { users: { fk: 'user_id', target: 'users', targetCol: 'id' } },
}

function parseSelect(select: string): { cols: string; embeds: { rel: string; cols: string }[] } {
  const embeds: { rel: string; cols: string }[] = []
  const flat: string[] = []
  for (const part of select.split(',')) {
    const t = part.trim()
    const m = t.match(/^([a-z_]+)\(([^)]*)\)$/)
    if (m) embeds.push({ rel: m[1], cols: m[2] })
    else if (t) flat.push(t)
  }
  return { cols: flat.length ? flat.map(ident).join(',') : '*', embeds }
}

function whereClause(params: URLSearchParams): { clause: string; binds: unknown[] } {
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

/** Apakah identitas boleh menulis baris ini (aproksimasi RLS). */
async function canWrite(env: RestEnv, id: RestIdentity | null, table: string, row: Record<string, unknown>): Promise<boolean> {
  if (!id) return false
  if (isOps(id)) return true
  if (row.user_id != null && Number(row.user_id) === id.id) return true
  const checks: [string, string][] = [
    ['merchants', 'merchant_id'],
    ['customers', 'customer_id'],
    ['couriers', 'courier_id'],
  ]
  for (const [ownerTable, fk] of checks) {
    const val = row[fk]
    if (val == null) continue
    const owner = await env.DB.prepare(`SELECT user_id FROM ${ownerTable} WHERE id = ?`).bind(Number(val)).first<{ user_id: number }>()
    if (owner && Number(owner.user_id) === id.id) return true
  }
  // Tabel tanpa kolom kepemilikan → izinkan sesi terautentikasi.
  if (!['merchant_id', 'customer_id', 'courier_id', 'user_id'].some((c) => c in row)) return true
  void table
  return false
}

export interface WriteContext {
  method: 'POST' | 'PATCH' | 'DELETE'
  body: unknown
  identity: RestIdentity | null
  prefer: string
}

export async function handleRest(env: RestEnv, table: string, params: URLSearchParams, ctx?: WriteContext, countExact = false): Promise<Response> {
  try {
    if (ctx) return await write(env, table, params, ctx)
    return await read(env, table, params, countExact)
  } catch (error) {
    return Response.json({ code: 'PGRST', message: String(error) }, { status: 400 })
  }
}

async function read(env: RestEnv, table: string, params: URLSearchParams, countExact = false): Promise<Response> {
  const select = params.get('select') || '*'
  const { cols, embeds } = parseSelect(select)
  const { clause, binds } = whereClause(params)
  const order = params.get('order')
  const orderSql = order ? ` ORDER BY ${order.split(',').map((t) => { const [c, d] = t.split('.'); return `${ident(c)} ${d === 'desc' ? 'DESC' : 'ASC'}` }).join(', ')}` : ''
  const limit = Math.min(Number(params.get('limit')) || 100, 1000)
  const offset = Number(params.get('offset')) || 0
  const { results } = await env.DB.prepare(`SELECT ${cols} FROM ${ident(table)}${clause}${orderSql} LIMIT ? OFFSET ?`).bind(...binds, limit, offset).all<Record<string, unknown>>()
  const rows = results ?? []

  for (const e of embeds) {
    const rel = RELATIONS[table]?.[e.rel]
    if (!rel) continue
    const ids = [...new Set(rows.map((r) => r[rel.fk]).filter((v) => v != null))]
    if (!ids.length) continue
    const targetCols = e.cols ? e.cols.split(',').map((c) => ident(c.trim())).join(',') : '*'
    const placeholders = ids.map(() => '?').join(',')
    const relRows = await env.DB.prepare(`SELECT ${targetCols}, ${ident(rel.targetCol)} as __k FROM ${ident(rel.target)} WHERE ${ident(rel.targetCol)} IN (${placeholders})`).bind(...ids).all<Record<string, unknown>>()
    const byId = new Map((relRows.results ?? []).map((r) => [Number(r.__k), r]))
    for (const r of rows) r[e.rel] = byId.get(Number(r[rel.fk])) ?? null
  }
  if (countExact) {
    const total = (await env.DB.prepare(`SELECT COUNT(*) c FROM ${ident(table)}${clause}`).bind(...binds).first<{ c: number }>())?.c ?? 0
    const start = rows.length ? offset : 0
    const end = rows.length ? offset + rows.length - 1 : 0
    return Response.json(rows, { headers: { 'content-range': `${start}-${end}/${total}` } })
  }
  return Response.json(rows)
}

async function write(env: RestEnv, table: string, params: URLSearchParams, ctx: WriteContext): Promise<Response> {
  if (!ctx.identity) return Response.json({ message: 'unauthorized' }, { status: 401 })
  const returning = ctx.prefer.includes('return=representation')

  if (ctx.method === 'POST') {
    const items = Array.isArray(ctx.body) ? ctx.body : [ctx.body]
    const created: Record<string, unknown>[] = []
    for (const raw of items) {
      const row = (raw ?? {}) as Record<string, unknown>
      if (!(await canWrite(env, ctx.identity, table, row))) return Response.json({ message: 'forbidden' }, { status: 403 })
      const cols = Object.keys(row).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c))
      const sql = `INSERT INTO ${ident(table)} (${cols.map(ident).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      const res = await env.DB.prepare(sql).bind(...cols.map((c) => row[c])).run()
      if (returning) {
        const got = await env.DB.prepare(`SELECT * FROM ${ident(table)} WHERE rowid = ?`).bind(res.meta.last_row_id).first()
        if (got) created.push(got as Record<string, unknown>)
      }
    }
    return returning ? Response.json(created, { status: 201 }) : new Response(null, { status: 201 })
  }

  const { clause, binds } = whereClause(params)
  if (!clause) return Response.json({ message: 'filter wajib untuk PATCH/DELETE' }, { status: 400 })
  const existing = (await env.DB.prepare(`SELECT * FROM ${ident(table)}${clause}`).bind(...binds).all<Record<string, unknown>>()).results ?? []
  for (const row of existing) {
    if (!(await canWrite(env, ctx.identity, table, row))) return Response.json({ message: 'forbidden' }, { status: 403 })
  }

  if (ctx.method === 'PATCH') {
    const patch = (ctx.body ?? {}) as Record<string, unknown>
    const cols = Object.keys(patch).filter((c) => /^[a-z_][a-z0-9_]*$/.test(c))
    if (!cols.length) return new Response(null, { status: 204 })
    await env.DB.prepare(`UPDATE ${ident(table)} SET ${cols.map((c) => `${ident(c)} = ?`).join(', ')}${clause}`).bind(...cols.map((c) => patch[c]), ...binds).run()
    if (!returning) return new Response(null, { status: 204 })
    const rows = (await env.DB.prepare(`SELECT * FROM ${ident(table)}${clause}`).bind(...binds).all()).results ?? []
    return Response.json(rows)
  }

  await env.DB.prepare(`DELETE FROM ${ident(table)}${clause}`).bind(...binds).run()
  return new Response(null, { status: 204 })
}
