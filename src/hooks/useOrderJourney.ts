import { useEffect, useState } from 'react'

import { fetchOrderJourney, resolveOrderId, type Journey } from '../api/orderJourney'

/** Ambil journey pesanan dari backend bila `param` (id/kode) tersedia. */
export function useOrderJourney(param: string | null): Journey | null {
  const [journey, setJourney] = useState<Journey | null>(null)

  useEffect(() => {
    let alive = true
    if (!param) {
      setJourney(null)
      return
    }
    void (async () => {
      const id = await resolveOrderId(param)
      if (!id) return
      const data = await fetchOrderJourney(id)
      if (alive) setJourney(data)
    })()
    return () => {
      alive = false
    }
  }, [param])

  return journey
}
