import { getCurrentSession } from './auth'
import { dbRpc, dbSelect, dbUpdate } from './db'
import type { AppNotification } from '../types'

/**
 * Akses data referensi ke Supabase PostgREST — paralel dengan data mock Redux.
 * Dipakai bila `VITE_SUPABASE_*` diisi; kalau tidak, `dbSelect` mengembalikan [].
 */
export interface DbMerchant {
  id: number
  store_name: string
  store_address: string | null
  photo: string | null
  store_status: 'open' | 'busy' | 'closed'
  tenant_status: string
  rating_avg: number | string
  rating_count: number
  open_time: string | null
  close_time: string | null
  latitude: number | null
  longitude: number | null
}

export interface DbMenu {
  id: number
  merchant_id: number
  name: string
  description: string | null
  price_jod: number | string
  category: string | null
  cook_minutes: number | null
  stock: number | null
  image: string | null
  available: boolean
}

export interface DbNotification {
  id: number
  user_id: number
  kind: string
  title: string
  body: string | null
  sound: string
  read: boolean
  audience: string | null
  created_at: string
}

/** Ubah profil merchant milik sesi (store_name/phone/address/jam operasional). */
export async function updateMyMerchant(patch: {
  store_name?: string
  store_phone?: string
  store_address?: string
  photo?: string
  open_time?: string
  close_time?: string
  store_status?: string
}): Promise<boolean> {
  const uid = await resolveMyUserId()
  if (!uid) return false
  const rows = await dbSelect<{ id: number }>('merchants', { query: { select: 'id', user_id: `eq.${uid}` } })
  const mid = rows[0]?.id
  if (!mid) return false
  try {
    await dbUpdate('merchants', { id: `eq.${mid}` }, patch)
    return true
  } catch {
    return false
  }
}

/** Resolve `users.id` (bigint) dari sesi auth (uuid) — untuk RLS & push. */export async function resolveMyUserId(): Promise<number | null> {
  const s = getCurrentSession()
  if (!s) return null
  const rows = await dbSelect<{ id: number }>('users', {
    query: { select: 'id', auth_user_id: `eq.${s.userId}` },
  })
  return rows[0]?.id ?? null
}

export interface DbMerchantSearch {
  id: number
  store_name: string
  photo: string | null
  store_status: string
  rating_avg: number | string
  rating_count: number
  open_time: string | null
  close_time: string | null
  min_price_jod: number | string | null
}

/** Cari merchant (nama/rating/harga) lewat RPC `search_merchants`.
 *  Tanpa filter & tanpa kata kunci → pakai `browse_merchants` (coverage + kuota, PRD aktif). */
export async function searchMerchants(params: {
  query?: string
  minRating?: number
  priceMin?: number
  priceMax?: number
}): Promise<DbMerchantSearch[]> {
  const browseMode =
    !params.query?.trim() && params.minRating == null && params.priceMin == null && params.priceMax == null
  if (browseMode) {
    const rows = await dbRpc<
      Array<{
        id: number
        store_name: string
        photo: string | null
        store_status: string
        rating_avg: number | string
        rating_count: number
      }>
    >('browse_merchants', { p_sort: 'rating', p_limit: 50 })
    return (rows ?? []).map((r) => ({
      id: r.id,
      store_name: r.store_name,
      photo: r.photo,
      store_status: r.store_status,
      rating_avg: r.rating_avg,
      rating_count: r.rating_count,
      open_time: null,
      close_time: null,
      min_price_jod: null,
    }))
  }
  const rows = await dbRpc<DbMerchantSearch[]>('search_merchants', {
    p_query: params.query ?? null,
    p_min_rating: params.minRating ?? null,
    p_price_min: params.priceMin ?? null,
    p_price_max: params.priceMax ?? null,
  })
  return rows ?? []
}

/** Merchant yang tayang (tenant approved), ringkas untuk daftar. */
export function fetchMerchants(): Promise<DbMerchant[]> {
  return dbSelect<DbMerchant>('merchants', {
    query: {
      select: 'id,store_name,store_address,photo,store_status,tenant_status,rating_avg,rating_count,open_time,close_time,latitude,longitude',
      tenant_status: 'eq.approved',
      order: 'rating_avg.desc',
    },
  })
}

/** Menu satu merchant (katalog). */
export function fetchMenus(merchantId?: number): Promise<DbMenu[]> {
  return dbSelect<DbMenu>('menus', {
    query: {
      select: 'id,merchant_id,name,description,price_jod,category,cook_minutes,stock,image,available',
      ...(merchantId != null ? { merchant_id: `eq.${merchantId}` } : {}),
      order: 'category.asc,name.asc',
    },
  })
}

/** Inbox notifikasi satu user (audience dipakai UI memfilter peran). */
export function fetchNotifications(userId: number): Promise<DbNotification[]> {
  return dbSelect<DbNotification>('notifications', {
    query: { user_id: `eq.${userId}`, order: 'created_at.desc', limit: 50 },
  })
}

/** Tulis notifikasi — INSERT memicu Database Webhook → Edge Function `send-push`. */
export async function pushNotificationRow(row: {
  userId: number
  kind: AppNotification['kind'] | 'courier'
  title: string
  body?: string
  sound?: string
  audience?: AppNotification['audience']
}): Promise<void> {
  const { dbInsert } = await import('./db')
  await dbInsert('notifications', {
    user_id: row.userId,
    kind: row.kind,
    title: row.title,
    body: row.body ?? null,
    sound: row.sound ?? 'default',
    audience: row.audience ?? null,
  })
}

/** Master zona (tabel `zones`). `polygon` = array [[lat,lng], ...]. */
export interface DbZone {
  id: number
  code: string
  name: string
  polygon: [number, number][]
}

/** Baca master zona (publik). */
export function fetchZones(): Promise<DbZone[]> {
  return dbSelect<DbZone>('zones', { query: { select: 'id,code,name,polygon', order: 'id.asc' } })
}

/**
 * Simpan/perbarui master zona lewat RPC `ops_upsert_zone` (Super Admin).
 * Mengembalikan id zona, atau null bila gagal.
 */
export async function upsertZone(input: {
  id?: number
  code: string
  name: string
  polygon: [number, number][]
}): Promise<number | null> {
  return dbRpc<number>('ops_upsert_zone', {
    p_code: input.code,
    p_name: input.name,
    p_polygon: input.polygon,
    p_id: input.id ?? null,
  })
}

/** Kategori menu — taksonomi ops (DEC-88104, api-spec §17.3.6). Baca-saja di FE. */
export interface DbMenuCategory {
  id: number
  label: string
  slug: string
  icon: string | null
  sort_order: number
  is_active: boolean
}

export function fetchMenuCategories(): Promise<DbMenuCategory[]> {
  return dbSelect<DbMenuCategory>('menu_categories', {
    query: { select: 'id,label,slug,icon,sort_order,is_active', order: 'sort_order.asc' },
  })
}
