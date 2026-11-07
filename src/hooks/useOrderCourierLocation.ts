import { useEffect, useState } from 'react'

import { fetchOrderCourierLocation, type OrderCourierLocation } from '../api/liveLocation'

/**
 * Ambil lokasi kurir untuk sebuah order secara berkala (default 10 dtk) selama
 * komponen terpasang. Untuk realtime penuh, ganti polling dengan `/ws`.
 */
export function useOrderCourierLocation(orderId: number | null, intervalMs = 10000) {
  const [location, setLocation] = useState<OrderCourierLocation | null>(null)

  useEffect(() => {
    if (orderId == null) {
      setLocation(null)
      return
    }
    let alive = true
    const tick = async () => {
      const loc = await fetchOrderCourierLocation(orderId)
      if (alive) setLocation(loc)
    }
    void tick()
    const id = window.setInterval(tick, intervalMs)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [orderId, intervalMs])

  return location
}
