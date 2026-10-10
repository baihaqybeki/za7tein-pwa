import { dbSelect } from './db'
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
