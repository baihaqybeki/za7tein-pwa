import { useEffect, useState } from 'react'

import { isBackendConfigured } from '../api/config'
import { fetchMenus, fetchMerchants, type DbMenu, type DbMerchant } from '../api/reference'

/**
 * Katalog dari Supabase (merchant approved + menunya), dengan fallback ke data
 * mock saat env backend kosong atau fetch gagal. Satu merchant pertama dipakai
 * sebagai profil toko (single-merchant UI saat ini).
 */
export interface RemoteCatalog {
  ready: boolean
  source: 'remote' | 'mock'
  merchant: DbMerchant | null
  menus: DbMenu[]
}

export function useRemoteCatalog(): RemoteCatalog {
  const [state, setState] = useState<RemoteCatalog>({
    ready: false,
    source: 'mock',
    merchant: null,
    menus: [],
  })

  useEffect(() => {
    let alive = true
    if (!isBackendConfigured) {
      setState({ ready: true, source: 'mock', merchant: null, menus: [] })
      return
    }
    ;(async () => {
      try {
        const merchants = await fetchMerchants()
        const merchant = merchants[0] ?? null
        const menus = merchant ? await fetchMenus(merchant.id) : []
        if (alive) setState({ ready: true, source: merchant ? 'remote' : 'mock', merchant, menus })
      } catch {
        if (alive) setState({ ready: true, source: 'mock', merchant: null, menus: [] })
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return state
}
