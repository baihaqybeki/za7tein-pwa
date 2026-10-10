import { restBase, SUPABASE_ANON_KEY, isBackendConfigured } from './config'

/** Nilai filter PostgREST, mis. { tenant_status: 'eq.approved', id: 'in.(1,2)' }. */
export type DbQuery = Record<string, string | number | boolean>

interface DbOptions {
  /** Filter/urutan/limit PostgREST sebagai query string, mis. `select=id,name&order=id`. */
  query?: DbQuery
  /** JWT akses (Supabase Auth) untuk data non-publik. */
  token?: string
  /** Prefer header, mis. `return=representation`. */
  prefer?: string
}

function headers(token?: string, prefer?: string): HeadersInit {
  return {
    apikey: SUPABASE_ANON_KEY ?? '',
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY ?? ''}`,
    'Content-Type': 'application/json',
    ...(prefer ? { Prefer: prefer } : {}),
  }
}

function qs(query?: DbQuery): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) params.set(k, String(v))
  const s = params.toString()
  return s ? `?${s}` : ''
}

/** SELECT sederhana dari PostgREST. Mengembalikan array (bisa kosong). */
export async function dbSelect<T = unknown>(table: string, opts: DbOptions = {}): Promise<T[]> {
  if (!isBackendConfigured) return []
  const res = await fetch(`${restBase()}/${table}${qs(opts.query)}`, { headers: headers(opts.token) })
  if (!res.ok) throw new Error(`GET ${table} ${res.status}`)
  return res.json() as Promise<T[]>
}

/** INSERT satu baris. `Prefer: return=minimal` (tak menarik balik baris). */
export async function dbInsert(table: string, row: unknown, opts: DbOptions = {}): Promise<void> {
  if (!isBackendConfigured) return
  const res = await fetch(`${restBase()}/${table}`, {
    method: 'POST',
    headers: headers(opts.token, opts.prefer ?? 'return=minimal'),
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`POST ${table} ${res.status}`)
}

/** DELETE dengan filter (wajib ada query agar tak menghapus semua). */
export async function dbDelete(table: string, opts: DbOptions = {}): Promise<void> {
  if (!isBackendConfigured) return
  const res = await fetch(`${restBase()}/${table}${qs(opts.query)}`, {
    method: 'DELETE',
    headers: headers(opts.token),
  })
  if (!res.ok) throw new Error(`DELETE ${table} ${res.status}`)
}

/** Login Supabase Auth (email + password) → access_token. */
export async function signIn(email: string, password: string): Promise<string | null> {
  if (!isBackendConfigured) return null
  const { authBase } = await import('./config')
  const res = await fetch(`${authBase()}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token?: string }
  return data.access_token ?? null
}
