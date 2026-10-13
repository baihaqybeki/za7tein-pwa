import { getAccessToken } from './auth'
import { isBackendConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export type Bucket = 'menu-images' | 'merchant-photos' | 'avatars'

/**
 * Unggah berkas ke Supabase Storage, kembalikan URL publik. `userId` menjadi
 * folder pertama (kebijakan RLS `storage.objects`: tulis hanya folder sendiri).
 * Null bila backend tak dikonfigurasi atau gagal.
 */
export async function uploadToBucket(bucket: Bucket, file: File, userId: number | string): Promise<string | null> {
  if (!isBackendConfigured || !SUPABASE_URL) return null
  const token = getAccessToken() ?? SUPABASE_ANON_KEY ?? ''
  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${userId}/${Date.now()}-${safe}`
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY ?? '',
        Authorization: `Bearer ${token}`,
        'x-upsert': 'true',
      },
      body: file,
    })
    if (!res.ok) return null
    return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`
  } catch {
    return null
  }
}
