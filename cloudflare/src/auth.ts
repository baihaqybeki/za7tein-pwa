// C3 — auth minimal: magic link -> JWT HS256 (tanpa dependensi). Email = stub (token dikembalikan).
export interface AuthEnv {
  DB: D1Database
  JWT_SECRET: string
}
export interface Identity {
  id: number
  role: string
  email: string | null
}

const enc = new TextEncoder()
const b64url = (b: Uint8Array): string => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const b64str = (s: string): string => b64url(enc.encode(s))

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const h = b64str(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const p = b64str(JSON.stringify(payload))
  const sig = await crypto.subtle.sign('HMAC', await key(secret), enc.encode(`${h}.${p}`))
  return `${h}.${p}.${b64url(new Uint8Array(sig))}`
}

export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown> | null> {
  const [h, p, s] = token.split('.')
  if (!h || !p || !s) return null
  const sig = Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
  const ok = await crypto.subtle.verify('HMAC', await key(secret), sig, enc.encode(`${h}.${p}`))
  if (!ok) return null
  try {
    const payload = JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

/** Identitas dari header Authorization: Bearer <jwt>. Null bila tak ada/invalid. */
export async function identity(request: Request, env: AuthEnv): Promise<Identity | null> {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const p = await verifyJwt(token, env.JWT_SECRET)
  if (!p) return null
  return { id: Number(p.sub), role: String(p.role ?? 'customer'), email: (p.email as string) ?? null }
}

const nowIso = (): string => new Date().toISOString()

export async function handleAuth(env: AuthEnv, path: string, request: Request): Promise<Response> {
  if (path === '/auth/magic-link' && request.method === 'POST') {
    const body = (await request.json().catch(() => ({}))) as { email?: string; role?: string }
    if (!body.email) return Response.json({ message: 'email wajib' }, { status: 400 })
    const token = crypto.randomUUID().replace(/-/g, '')
    await env.DB.prepare('INSERT INTO magic_links (email,role,token,expires_at) VALUES (?,?,?,?)')
      .bind(body.email.toLowerCase(), body.role ?? 'customer', token, new Date(Date.now() + 900000).toISOString()).run()
    // Stub: token dikembalikan (pengiriman email nyata menyusul).
    return Response.json({ ok: true, token, note: 'email stub' })
  }
  if (path === '/auth/verify' && request.method === 'POST') {
    const { token } = (await request.json().catch(() => ({}))) as { token?: string }
    const row = await env.DB.prepare('SELECT id,email,role,expires_at,consumed_at FROM magic_links WHERE token=?')
      .bind(token).first<{ id: number; email: string; role: string; expires_at: string; consumed_at: string | null }>()
    if (!row) return Response.json({ message: 'token tidak ditemukan' }, { status: 400 })
    if (row.consumed_at) return Response.json({ message: 'token sudah dipakai' }, { status: 400 })
    if (row.expires_at < nowIso()) return Response.json({ message: 'token kedaluwarsa' }, { status: 400 })
    await env.DB.prepare('UPDATE magic_links SET consumed_at=? WHERE id=?').bind(nowIso(), row.id).run()
    const user = await env.DB.prepare('SELECT id, role, email FROM users WHERE lower(email)=?').bind(row.email).first<{ id: number; role: string; email: string }>()
    const sub = user?.id ?? 0
    const role = user?.role ?? row.role
    const access = await signJwt({ sub, role, email: row.email, exp: Math.floor(Date.now() / 1000) + 86400 }, env.JWT_SECRET)
    return Response.json({ access_token: access, token_type: 'bearer', user: { id: sub, role, email: row.email } })
  }
  if (path === '/auth/me' && request.method === 'GET') {
    const id = await identity(request, env)
    if (!id) return Response.json({ message: 'unauthorized' }, { status: 401 })
    return Response.json(id)
  }
  return Response.json({ message: 'auth: not found' }, { status: 404 })
}
