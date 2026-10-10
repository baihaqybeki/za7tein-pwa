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

const env = import.meta.env as unknown as Record<string, string | undefined>
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_ANON = env.VITE_SUPABASE_ANON_KEY
const VAPID_PUBLIC = env.VITE_VAPID_PUBLIC_KEY

/** VAPID public key (base64url) → Uint8Array untuk `applicationServerKey`. */
function urlBase64ToUint8Array(base64: string): BufferSource {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(normalized)
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i)
  return out
}

export type SubscribeResult = 'ok' | 'unsupported' | 'denied' | 'unconfigured'

/**
 * Langganan Web Push nyata: SW subscribe (VAPID) lalu simpan ke
 * `push_subscriptions` lewat PostgREST. Hanya aktif bila env VAPID/Supabase
 * diisi (`.env.local`), supaya repo mock tetap jalan tanpa konfigurasi.
 */
export async function subscribePush(userId: number): Promise<SubscribeResult> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported'
  if (!SUPABASE_URL || !SUPABASE_ANON || !VAPID_PUBLIC) return 'unconfigured'
  if ((await requestPushPermission()) !== 'granted') return 'denied'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    })
    const json = sub.toJSON()
    await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys?.p256dh,
        auth: json.keys?.auth,
      }),
    })
    return 'ok'
  } catch {
    return 'denied'
  }
}
