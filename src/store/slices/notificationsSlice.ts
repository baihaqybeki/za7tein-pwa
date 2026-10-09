// Daftar notifikasi ada di store, bukan di state lokal halaman inbox. Badge di
// lonceng beranda membaca dari sini juga, jadi menandai satu notifikasi terbaca
// pasti ikut menurunkan badge — angka dan daftarnya tidak bisa berbeda.
import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { mockNotifications, DEFAULT_NOTIFICATION_SOUND } from '../../data/notifications'
import type { AppNotification, PushSubscriptionRecord } from '../../types'

interface NotificationsState {
  items: AppNotification[]
  /** Subscription push aktif (mock, M8). Null = belum mendaftar. */
  subscription: PushSubscriptionRecord | null
  /** Audio push aktif? (preferensi; dipetakan ke push_subscriptions.sound_enabled). */
  soundEnabled: boolean
  /** Nada terpilih (key dari NOTIFICATION_SOUNDS). */
  sound: string
}

const initialState: NotificationsState = {
  items: mockNotifications,
  subscription: null,
  soundEnabled: true,
  sound: DEFAULT_NOTIFICATION_SOUND,
}

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    markRead(state, action: PayloadAction<string>) {
      const item = state.items.find((n) => n.id === action.payload)
      if (item) item.unread = false
    },
    markAllRead(state) {
      state.items.forEach((n) => {
        n.unread = false
      })
    },
    /** Daftar push (mock): menyimpan subscription, bukan mengirim notifikasi. */
    registerPush(state, action: PayloadAction<{ subscription: PushSubscriptionRecord }>) {
      state.subscription = action.payload.subscription
    },
    clearPush(state) {
      state.subscription = null
    },
    /**
     * Tambah satu notifikasi ke kotak masuk. Dipakai aksi lintas peran (kurir
     * "Tiba" → customer dapat notif) — satu store, pola sama seperti sengketa
     * yang dibaca lintas peran. Web Push asli tetap di luar scope (R-PUSH-01).
     */
    pushNotification(state, action: PayloadAction<AppNotification>) {
      state.items.unshift(action.payload)
    },
    setSoundEnabled(state, action: PayloadAction<boolean>) {
      state.soundEnabled = action.payload
    },
    setSound(state, action: PayloadAction<string>) {
      state.sound = action.payload
    },
  },
})

export const {
  markRead,
  markAllRead,
  registerPush,
  clearPush,
  pushNotification,
  setSoundEnabled,
  setSound,
} = notificationsSlice.actions

export const selectUnreadCount = (items: AppNotification[]) =>
  items.filter((n) => n.unread).length

export default notificationsSlice.reducer
