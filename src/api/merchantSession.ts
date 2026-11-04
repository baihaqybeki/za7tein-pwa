/**
 * Sesi merchant ke backend: login (Worker magic-link) + resolve merchant milik akun.
 * Tujuan: jangan pernah default ke merchant mock yang mungkin sudah dihapus di DB.
 */
import { CF_API_URL, isBackendConfigured } from './config'
import { resolveMyUserId } from './reference'
import { dbSelect } from './db'

const TOKEN_KEY = 'sa7tein_cf_token'

export function cfToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}
function setCfToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}
export function clearCfToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function isWorkerConfigured(): boolean {
  return Boolean(CF_API_URL)
}

export interface ResolvedMerchant {
  id: number
  store_name: string
  store_phone?: string | null
  store_address?: string | null
  photo?: string | null
  latitude?: number | null
  longitude?: number | null
  open_time?: string | null
  close_time?: string | null
}

/** Login merchant ke Worker (magic-link; token dikembalikan backend untuk dev). */
export async function workerSignIn(email: string): Promise<boolean> {
  if (!CF_API_URL) return false
  try {
    const ml = await fetch(`${CF_API_URL}/auth/magic-link`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, role: 'merchant' }),
    })
    if (!ml.ok) return false
    const { token } = (await ml.json()) as { token?: string }
    if (!token) return false
    const v = await fetch(`${CF_API_URL}/auth/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!v.ok) return false
    const { access_token } = (await v.json()) as { access_token?: string }
    if (!access_token) return false
    setCfToken(access_token)
    return true
  } catch {
    return false
  }
}

/** Merchant milik akun yang login (Worker), atau null. */
export async function resolveWorkerMerchant(): Promise<ResolvedMerchant | null> {
  const token = cfToken()
  if (!CF_API_URL || !token) return null
  try {
    const me = await fetch(`${CF_API_URL}/auth/me`, { headers: { authorization: `Bearer ${token}` } })
    if (!me.ok) return null
    const { id } = (await me.json()) as { id: number }
    const res = await fetch(
      `${CF_API_URL}/rest/v1/merchants?select=id,store_name,store_phone,store_address,photo,latitude,longitude,open_time,close_time&user_id=eq.${id}&limit=1`,
      { headers: { authorization: `Bearer ${token}` } },
    )
    if (!res.ok) return null
    const rows = (await res.json()) as ResolvedMerchant[]
    return rows[0] ?? null
  } catch {
    return null
  }
}

/** Cadangan: merchant milik akun di Supabase (legacy). */
export async function resolveSupabaseMerchant(): Promise<ResolvedMerchant | null> {
  if (!isBackendConfigured) return null
  const uid = await resolveMyUserId()
  if (!uid) return null
  const rows = await dbSelect<ResolvedMerchant>('merchants', {
    query: {
      select: 'id,store_name,store_phone,store_address,photo,latitude,longitude,open_time,close_time',
      user_id: `eq.${uid}`,
    },
  })
  return rows[0] ?? null
}
