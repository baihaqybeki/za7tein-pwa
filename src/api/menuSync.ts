/**
 * Bridge demo → backend: memetakan merchant mock (mis. `am-1`) ke merchant D1
 * (lookup by pemilik login / nama toko), lalu menyimpan CRUD menu ke Worker.
 * Best-effort: kegagalan tidak memblokir UI lokal (mock tetap jalan).
 */
import { CF_API_URL } from './config'
import { cfToken } from './merchantSession'
import { idrToJod } from '../data/currency'
import type { MenuItem } from '../types'

function authHeaders(): Record<string, string> {
  const token = cfToken()
  return token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' }
}

/** Resolve merchant backend: id numerik langsung; selain itu cari by pemilik/nama. */
export async function resolveBackendMerchantId(idOrMock: string, storeName: string): Promise<number | null> {
  if (!CF_API_URL) return null
  if (/^\d+$/.test(idOrMock)) return Number(idOrMock)
  const token = cfToken()
  if (token) {
    try {
      const me = await fetch(`${CF_API_URL}/auth/me`, { headers: { authorization: `Bearer ${token}` } })
      if (me.ok) {
        const { id } = (await me.json()) as { id: number }
        const r = await fetch(`${CF_API_URL}/rest/v1/merchants?select=id&user_id=eq.${id}&limit=1`, {
          headers: { authorization: `Bearer ${token}` },
        })
        if (r.ok) {
          const rows = (await r.json()) as { id: number }[]
          if (rows[0]) return rows[0].id
        }
      }
    } catch {
      /* ignore */
    }
  }
  try {
    const r = await fetch(`${CF_API_URL}/rest/v1/merchants?select=id&store_name=eq.${encodeURIComponent(storeName)}&limit=1`)
    if (r.ok) {
      const rows = (await r.json()) as { id: number }[]
      if (rows[0]) return rows[0].id
    }
  } catch {
    /* ignore */
  }
  return null
}

function toPayload(item: MenuItem) {
  return {
    name: item.name,
    description: item.description ?? null,
    price_jod: Math.round(idrToJod(item.price) * 1000) / 1000,
    category: item.category,
    image: item.image && !item.image.startsWith('blob:') ? item.image : null,
    available: item.available ? 1 : 0,
    stock: item.stock,
  }
}

export async function syncMenuCreate(merchantId: number, item: MenuItem): Promise<boolean> {
  if (!cfToken()) return false
  try {
    const res = await fetch(`${CF_API_URL}/rest/v1/menus`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ merchant_id: merchantId, ...toPayload(item) }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function syncMenuUpdate(merchantId: number, oldName: string, patch: Partial<MenuItem>): Promise<boolean> {
  if (!cfToken()) return false
  const body: Record<string, unknown> = {}
  if (patch.name != null) body.name = patch.name
  if (patch.description != null) body.description = patch.description
  if (patch.price != null) body.price_jod = Math.round(idrToJod(patch.price) * 1000) / 1000
  if (patch.category != null) body.category = patch.category
  if (patch.image != null && !patch.image.startsWith('blob:')) body.image = patch.image
  if (patch.available != null) body.available = patch.available ? 1 : 0
  if (patch.stock != null) body.stock = patch.stock
  if (!Object.keys(body).length) return false
  try {
    const res = await fetch(
      `${CF_API_URL}/rest/v1/menus?merchant_id=eq.${merchantId}&name=eq.${encodeURIComponent(oldName)}`,
      { method: 'PATCH', headers: authHeaders(), body: JSON.stringify(body) },
    )
    return res.ok
  } catch {
    return false
  }
}

export async function syncMenuDelete(merchantId: number, name: string): Promise<boolean> {
  if (!cfToken()) return false
  try {
    const res = await fetch(
      `${CF_API_URL}/rest/v1/menus?merchant_id=eq.${merchantId}&name=eq.${encodeURIComponent(name)}`,
      { method: 'DELETE', headers: authHeaders() },
    )
    return res.ok
  } catch {
    return false
  }
}
