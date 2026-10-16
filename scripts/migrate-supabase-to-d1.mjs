// =============================================================================
// Sa7tein — migrasi data Supabase (PostgREST) -> Cloudflare D1
// =============================================================================
// Reusable. Baca tabel dari cloudflare/schema.sql, ambil kolom D1 via PRAGMA,
// tarik data Supabase (service role), tulis INSERT OR REPLACE ke D1 (chunk).
//
// Env:
//   SUPABASE_URL, SUPABASE_SERVICE_KEY, CF_TOKEN, CF_ACCOUNT, D1_ID
// Pakai:  node scripts/migrate-supabase-to-d1.mjs [table ...]
// =============================================================================

import { readFileSync } from 'node:fs'

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  CF_TOKEN,
  CF_ACCOUNT,
  D1_ID,
} = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CF_TOKEN || !CF_ACCOUNT || !D1_ID) {
  console.error('Butuh SUPABASE_URL, SUPABASE_SERVICE_KEY, CF_TOKEN, CF_ACCOUNT, D1_ID')
  process.exit(2)
}

const filter = process.argv.slice(2)
const schema = readFileSync('cloudflare/schema.sql', 'utf8')
const tables = [...schema.matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/g)].map((m) => m[1]).filter((t) => filter.length === 0 || filter.includes(t))

function sqlLit(v) {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL'
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`
  return `'${String(v).replace(/'/g, "''")}'`
}

async function d1(sql) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/d1/database/${D1_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  })
  const json = await res.json()
  if (!json.success) throw new Error(`D1: ${JSON.stringify(json.errors)}`)
  return json.result
}

async function d1Columns(table) {
  const r = await d1(`PRAGMA table_info('${table}')`)
  return (r?.[0]?.results ?? []).map((c) => c.name)
}

async function supabaseRows(table) {
  const rows = []
  const page = 1000
  for (let offset = 0; ; offset += page) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${page}&offset=${offset}`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    })
    if (!res.ok) {
      const t = await res.text()
      if (res.status === 404) return rows
      throw new Error(`Supabase ${table}: ${res.status} ${t.slice(0, 120)}`)
    }
    const batch = await res.json()
    rows.push(...batch)
    if (batch.length < page) break
  }
  return rows
}

let total = 0
for (const table of tables) {
  const cols = await d1Columns(table)
  if (!cols.length) {
    console.log(`skip  ${table} (tabel D1 tak ada)`)
    continue
  }
  const rows = await supabaseRows(table)
  if (!rows.length) {
    console.log(`empty ${table}`)
    continue
  }
  const chunk = 200
  let written = 0
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk)
    const stmts = slice.map((row) => {
      const useCols = cols.filter((c) => c in row)
      const vals = useCols.map((c) => sqlLit(row[c])).join(',')
      return `INSERT OR REPLACE INTO ${table} (${useCols.join(',')}) VALUES (${vals});`
    })
    await d1(stmts.join('\n'))
    written += slice.length
  }
  total += written
  console.log(`ok    ${table}: ${written} baris`)
}
console.log(`\nTotal ${total} baris dimigrasikan ke D1.`)
