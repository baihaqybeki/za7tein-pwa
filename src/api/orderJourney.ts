import { CF_API_URL } from './config'
import { cfToken } from './merchantSession'

export interface JourneyOrder {
  id: number
  code: string
  status: string
  payment_status: string
  payment_method: string
  total_jod: number
  total_idr: number
  placed_at: string | null
  paid_at: string | null
  otp_verified: number
  courier_id: number | null
  created_at: string
}
export interface JourneyItem { id: number; name: string; qty: number; unit_price_jod: number; line_total_jod: number }
export interface JourneyHistory { from_status: string | null; to_status: string; actor_id: number | null; at: string }
export interface JourneyCheckpoint { kind: string; latitude: number | null; longitude: number | null; at: string }
export interface JourneyNotification { audience: string; kind: string; title: string; body: string | null; read: number; created_at: string }
export interface JourneyCourier { id: number; name: string; latitude: number | null; longitude: number | null; last_seen_at: string | null }
export interface Journey {
  order: JourneyOrder
  items: JourneyItem[]
  history: JourneyHistory[]
  checkpoints: JourneyCheckpoint[]
  notifications: JourneyNotification[]
  payments: Array<Record<string, unknown>>
  courier: JourneyCourier | null
  chat: Record<string, unknown> | null
}

function auth(): Record<string, string> {
  const token = cfToken()
  return token ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { 'content-type': 'application/json' }
}

export async function fetchOrderJourney(orderId: number): Promise<Journey | null> {
  if (!CF_API_URL) return null
  try {
    const res = await fetch(`${CF_API_URL}/rest/v1/rpc/order_journey`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ p_order_id: orderId }),
    })
    if (!res.ok) return null
    return (await res.json()) as Journey
  } catch {
    return null
  }
}

/** Terima id numerik atau kode pesanan (SA-…). */
export async function resolveOrderId(orderParam: string): Promise<number | null> {
  if (/^\d+$/.test(orderParam)) return Number(orderParam)
  if (!CF_API_URL) return null
  try {
    const res = await fetch(`${CF_API_URL}/rest/v1/orders?select=id&code=eq.${encodeURIComponent(orderParam)}&limit=1`)
    if (!res.ok) return null
    const rows = (await res.json()) as { id: number }[]
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}
