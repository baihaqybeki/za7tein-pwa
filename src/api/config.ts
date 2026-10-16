/**
 * Konfigurasi klien backend. Semua lewat env Vite (`.env.local` / Vercel) —
 * kunci privat TIDAK pernah ada di sini, hanya kunci publik/anon.
 *
 * Diutamakan `VITE_*`; kalau kosong, app tetap jalan dengan data mock (AGENTS §1).
 */
const env = import.meta.env as unknown as Record<string, string | undefined>

export const SUPABASE_URL = env.VITE_SUPABASE_URL
export const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY
export const VAPID_PUBLIC_KEY = env.VITE_VAPID_PUBLIC_KEY
export const API_SPEC_URL = env.VITE_API_SPEC_URL ?? 'https://sa7tein-api.vercel.app'

/**
 * Versioning migrasi (docs/backend/MIGRATION-versioning.md): selama backend pindah
 * ke Cloudflare, FE bisa berjalan paralel. `VITE_DATA_SOURCE` memilih sumber data:
 * `supabase` (default, PostgREST lama) atau `cloudflare` (Worker `VITE_CF_API_URL`).
 */
export const DATA_SOURCE = env.VITE_DATA_SOURCE ?? 'supabase'
export const CF_API_URL = env.VITE_CF_API_URL

/** Backend (PostgREST) siap dipakai? */
export const isBackendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** Worker Cloudflare siap dipakai? */
export const isCloudflareConfigured = DATA_SOURCE === 'cloudflare' && Boolean(CF_API_URL)

export function cfBase(): string {
  if (!CF_API_URL) throw new Error('VITE_CF_API_URL belum diisi')
  return CF_API_URL
}

export function restBase(): string {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL belum diisi')
  return `${SUPABASE_URL}/rest/v1`
}

export function authBase(): string {
  if (!SUPABASE_URL) throw new Error('VITE_SUPABASE_URL belum diisi')
  return `${SUPABASE_URL}/auth/v1`
}
