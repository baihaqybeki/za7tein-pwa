import { authBase, isBackendConfigured, SUPABASE_ANON_KEY } from './config'

/**
 * Sesi Auth Supabase (email + password) untuk klien. Disimpan di localStorage
 * (kunci `sa7tein:supabase-auth`) supaya `db.ts` bisa memakai `access_token`
 * sebagai Bearer → RLS `app_uid()` berlaku. Tanpa konfigurasi env, semua fungsi
 * no-op (app tetap mock).
 */
export interface SupabaseSession {
  accessToken: string
  refreshToken: string | null
  expiresAt: number
  userId: string
  email: string | null
}

const KEY = 'sa7tein:supabase-auth'

function readSession(): SupabaseSession | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SupabaseSession) : null
  } catch {
    return null
  }
}

function writeSession(session: SupabaseSession | null): void {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // storage tak tersedia — abaikan
  }
}

/** Access token valid (belum kedaluwarsa), atau undefined. */
export function getAccessToken(): string | undefined {
  const s = readSession()
  if (!s) return undefined
  if (s.expiresAt && s.expiresAt < Date.now() / 1000) return undefined
  return s.accessToken
}

export function getCurrentSession(): SupabaseSession | null {
  return readSession()
}

/** Login email + password. Mengembalikan sesi (tersimpan) atau null bila gagal. */
export async function signInWithPassword(email: string, password: string): Promise<SupabaseSession | null> {
  if (!isBackendConfigured) return null
  const res = await fetch(`${authBase()}/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    user?: { id: string; email?: string }
  }
  const session: SupabaseSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    userId: data.user?.id ?? '',
    email: data.user?.email ?? email,
  }
  writeSession(session)
  return session
}

/** Daftar akun baru (email + password). Mengembalikan sesi bila langsung aktif. */
export async function signUpWithPassword(email: string, password: string): Promise<SupabaseSession | null> {
  if (!isBackendConfigured) return null
  const res = await fetch(`${authBase()}/signup`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    user?: { id: string; email?: string }
  }
  if (!data.access_token) return null // butuh konfirmasi email
  const session: SupabaseSession = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    userId: data.user?.id ?? '',
    email: data.user?.email ?? email,
  }
  writeSession(session)
  return session
}

export async function signOutSupabase(): Promise<void> {
  const s = readSession()
  writeSession(null)
  if (!isBackendConfigured || !s) return
  try {
    await fetch(`${authBase()}/logout`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY ?? '', Authorization: `Bearer ${s.accessToken}` },
    })
  } catch {
    // sudah dihapus lokal; kegagalan server diabaikan
  }
}

/** Perbarui access_token dari refresh_token. */
export async function refreshSession(): Promise<SupabaseSession | null> {
  const s = readSession()
  if (!isBackendConfigured || !s?.refreshToken) return null
  const res = await fetch(`${authBase()}/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: s.refreshToken }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number }
  const next: SupabaseSession = {
    ...s,
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? s.refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  }
  writeSession(next)
  return next
}
