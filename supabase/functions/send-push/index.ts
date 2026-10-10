// Edge Function `send-push` — dipanggil Database Webhook (INSERT public.notifications).
//
// Alur: notifications INSERT → webhook → function ini → VAPID → FCM → perangkat.
// Membaca push_subscriptions milik notifications.user_id, menandatangani payload
// dengan kunci VAPID, mengantar, lalu menghapus langganan kedaluwarsa (404/410).
//
// Deploy: `npm run push:deploy` (butuh Supabase CLI + `supabase link`).
// Rahasia (VAPID_*) di-set lewat `supabase secrets set`. SUPABASE_URL dan
// SUPABASE_SERVICE_ROLE_KEY disuntik platform otomatis.
import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:support@sa7tein.app'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

/** Tautan klik mengikuti audience (selaras dengan FE). */
const URL_BY_AUDIENCE: Record<string, string> = {
  customer: '/customer/home',
  merchant: '/merchant',
  courier: '/courier',
  cs: '/admin',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  try {
    const payload = await req.json()
    // Webhook mengirim { type, table, record, old_record }. Terima juga record langsung.
    const row = payload?.record ?? payload
    if (!row?.user_id) return json({ error: 'no user_id in record' }, 400)

    const { data: subs, error } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', row.user_id)
    if (error) return json({ error: error.message }, 500)
    if (!subs || subs.length === 0) return json({ sent: 0, note: 'no subscriptions' })

    const body = JSON.stringify({
      title: row.title ?? 'Sa7tein',
      body: row.body ?? '',
      url: URL_BY_AUDIENCE[row.audience] ?? '/customer/home',
      sound: row.sound ?? 'default',
      tag: `n-${row.id}`,
    })

    let sent = 0
    const expired: number[] = []
    for (const s of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        )
        sent += 1
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        // Langganan hilang/kedaluwarsa → buang.
        if (code === 404 || code === 410) expired.push(s.id)
        else console.error('push failed', code, (err as Error)?.message)
      }
    }

    if (expired.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', expired)
    }
    return json({ sent, expired: expired.length })
  } catch (err) {
    return json({ error: (err as Error)?.message ?? 'unknown' }, 500)
  }
})
