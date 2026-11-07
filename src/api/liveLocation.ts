/**
 * Live location kurir (PRD L1: andal hanya saat app kurir terbuka).
 * Kurir: kirim posisi via `update_courier_location`; peserta order: baca
 * `courier_location` (dengan flag `stale` bila > 120 detik).
 */
import { CF_API_URL } from './config'
import { cfToken } from './merchantSession'

function auth(): Record<string, string> {
  const token = cfToken()
  return token
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { 'content-type': 'application/json' }
}

export async function pushCourierLocation(latitude: number, longitude: number): Promise<boolean> {
  if (!cfToken()) return false
  try {
    const res = await fetch(`${CF_API_URL}/rest/v1/rpc/update_courier_location`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ p_lat: latitude, p_lng: longitude }),
    })
    return res.ok
  } catch {
    return false
  }
}

export interface OrderCourierLocation {
  id: number
  name: string
  latitude: number | null
  longitude: number | null
  last_seen_at: string | null
  age_ms: number
  stale: boolean
}

export async function fetchOrderCourierLocation(orderId: number): Promise<OrderCourierLocation | null> {
  if (!cfToken()) return null
  try {
    const res = await fetch(`${CF_API_URL}/rest/v1/rpc/courier_location`, {
      method: 'POST',
      headers: auth(),
      body: JSON.stringify({ p_order_id: orderId }),
    })
    if (!res.ok) return null
    return (await res.json()) as OrderCourierLocation | null
  } catch {
    return null
  }
}

/** Mulai mengirim lokasi kurir selama aktif. Kembalikan fungsi stop. */
export function startCourierLocationWatch(
  onUpdate?: (pos: GeolocationPosition) => void,
  onError?: (err: GeolocationPositionError) => void,
): () => void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return () => {}
  const id = navigator.geolocation.watchPosition(
    (pos) => {
      void pushCourierLocation(pos.coords.latitude, pos.coords.longitude)
      onUpdate?.(pos)
    },
    (err) => onError?.(err),
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  )
  return () => navigator.geolocation.clearWatch(id)
}
