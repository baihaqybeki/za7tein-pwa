import type { AppNotification } from '../types'

/** Web Notifications API tersedia? (tidak di semua peramban/konteks). */
export function pushSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

/** Minta izin notifikasi OS. Aman dipanggil walau API tak ada. */
export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!pushSupported()) return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

/**
 * Kirim satu notifikasi ke OS (push nyata) bila izin sudah `granted`.
 * Ini pengiriman sisi-klien (showNotification) — cukup untuk showcase; Web Push
 * asli (server → service worker) tetap di luar scope (AGENTS §1, R-PUSH-01).
 * Gagal senyap.
 */
export function deliverPush(notification: AppNotification): void {
  if (!pushSupported() || Notification.permission !== 'granted') return
  try {
    new Notification(notification.title, {
      body: notification.body,
      tag: notification.id,
      // Ikon memakai mark repo (aset lokal, bukan URL eksternal).
      icon: '/icons/sa7tein-192x192.png',
    })
  } catch {
    // Konstruktor Notification bisa melempar di sebagian konteks — abaikan.
  }
}
