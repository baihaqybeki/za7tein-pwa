import { useEffect, useState } from 'react'

import { isBackendConfigured } from '../api/config'
import { searchMerchants, type DbMerchantSearch } from '../api/reference'

/**
 * Cari merchant berdasarkan nama (debounce 250ms) via RPC `search_merchants`.
 * Mengembalikan [] saat env backend kosong / tanpa hasil.
 */
export function useMerchantSearch(query: string): { results: DbMerchantSearch[]; loading: boolean } {
  const [state, setState] = useState<{ results: DbMerchantSearch[]; loading: boolean }>({
    results: [],
    loading: false,
  })

  useEffect(() => {
    if (!isBackendConfigured) {
      setState({ results: [], loading: false })
      return
    }
    setState((s) => ({ ...s, loading: true }))
    const timer = setTimeout(async () => {
      const results = await searchMerchants({ query: query.trim() })
      setState({ results, loading: false })
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  return state
}
