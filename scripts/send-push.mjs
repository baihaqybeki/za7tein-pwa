#!/usr/bin/env node
/**
 * Pengirim push lokal untuk dev — membaca `.env.local`, tanpa deploy.
 * Jalur produksi tetap Webhook → Edge Function `send-push`.
 *
 * Butuh `web-push` (devDependency) + rahasia di `.env.local`:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 *
 * Pakai:
 *   node scripts/send-push.mjs --title "Pesanan siap" --body "Sedang dimasak" --url /customer/orders
 *   node scripts/send-push.mjs --user 1 --title "Halo" --body "Untuk user 1 saja"
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(file = '.env.local') {
  try {
    for (const line of readFileSync(resolve(process.cwd(), file), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // .env.local opsional
  }
}

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

loadEnv()

const URL = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT = 'mailto:support@sa7tein.app' } = process.env

if (!URL || !KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum diisi di .env.local')
  process.exit(1)
}

let webpush
try {
  webpush = (await import('web-push')).default
} catch {
  console.error('Dependency "web-push" belum dipasang — jalankan: npm i -D web-push@3.6.7')
  process.exit(1)
}
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

const userId = arg('user')
const payload = JSON.stringify({
  title: arg('title', 'Sa7tein'),
  body: arg('body', ''),
  url: arg('url', '/customer/home'),
})

const query = userId ? `&user_id=eq.${userId}` : ''
const res = await fetch(`${URL}/rest/v1/push_subscriptions?select=id,endpoint,p256dh,auth${query}`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})
const subs = await res.json()
if (!Array.isArray(subs) || subs.length === 0) {
  console.log('Tidak ada push_subscriptions.')
  process.exit(0)
}

let sent = 0
const expired = []
for (const s of subs) {
  try {
    await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
    sent += 1
  } catch (err) {
    const code = err?.statusCode
    if (code === 404 || code === 410) expired.push(s.id)
    else console.error('gagal', code, err?.message)
  }
}
if (expired.length > 0) {
  await fetch(`${URL}/rest/v1/push_subscriptions?id=in.(${expired.join(',')})`, {
    method: 'DELETE',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
}
console.log(`terkirim=${sent} · kedaluwarsa dibuang=${expired.length}`)
