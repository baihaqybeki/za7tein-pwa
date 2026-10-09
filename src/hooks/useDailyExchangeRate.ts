import { useState } from 'react'

import { fetchDailyRate } from '../data/currency'
import type { ExchangeRate } from '../types'

/** Cache kurs harian di peramban: satu nilai per hari, bukan per kunjungan. */
const STORAGE_KEY = 'sa7tein:exchange-rate'

type DailyRateState = {
  rate: ExchangeRate
  /** `refreshed` = hit baru hari ini; `cached` = memakai hasil hari yang sama. */
  status: 'refreshed' | 'cached'
}

function readCache(): ExchangeRate | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ExchangeRate>
    if (typeof parsed.rate !== 'number' || typeof parsed.fetchedAt !== 'string') return null
    return parsed as ExchangeRate
  } catch {
    return null
  }
}

function writeCache(rate: ExchangeRate): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rate))
  } catch {
    // Mode privat / storage penuh: cukup pakai nilai in-memory, jangan gagalkan render.
  }
}

function isSameDay(iso: string, now: Date): boolean {
  return new Date(iso).toDateString() === now.toDateString()
}

/**
 * Kurs untuk hari ini — "hit" sekali per hari kalender.
 *
 * Lazy initializer: kalau cache hari ini ada, pakai itu; kalau tidak (atau sudah
 * berganti hari), ambil rate baru lalu simpan. Hasilnya objek polos, konsisten
 * dengan hook lain di repo.
 *
 * Catatan: flow F10 menaruh sinkron kurs di backend 1×24 jam; hit sisi client ini
 * adalah kompromi showcase karena repo tanpa backend — lihat UNRESOLVED di README
 * flow F10.
 */
export function useDailyExchangeRate(): DailyRateState {
  const [state] = useState<DailyRateState>(() => {
    const now = new Date()
    const cached = readCache()
    if (cached && isSameDay(cached.fetchedAt, now)) {
      return { rate: cached, status: 'cached' }
    }
    const fresh = fetchDailyRate(now)
    writeCache(fresh)
    return { rate: fresh, status: 'refreshed' }
  })

  return state
}
