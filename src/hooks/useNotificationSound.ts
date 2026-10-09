import { useEffect, useRef } from 'react'

import { playNotificationSound } from '../lib/notificationSound'
import { useAppSelector } from './useAppStore'

/**
 * Bunyikan nada saat notifikasi baru masuk (jumlah item bertambah), mematuhi
 * preferensi `soundEnabled`/`sound` dari store. Dipasang sekali di shell
 * customer; mock — Web Push asli tetap di luar scope (R-PUSH-01, AGENTS §1).
 */
export function useNotificationSound(): void {
  const enabled = useAppSelector((s) => s.notifications.soundEnabled)
  const sound = useAppSelector((s) => s.notifications.sound)
  const count = useAppSelector((s) => s.notifications.items.length)
  const prev = useRef(count)

  useEffect(() => {
    if (count > prev.current && enabled) playNotificationSound(sound)
    prev.current = count
  }, [count, enabled, sound])
}
