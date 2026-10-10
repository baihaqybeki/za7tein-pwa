/**
 * Push klien: re-export helper dari `src/lib/push.ts` + informasi spec/kontrak.
 * `subscribePush` aktif hanya bila env VAPID/Supabase diisi (lihat `./config`).
 */
import { API_SPEC_URL } from './config'

export { subscribePush, deliverPush, requestPushPermission, pushSupported } from '../lib/push'
export { API_SPEC_URL, isBackendConfigured, SUPABASE_URL, VAPID_PUBLIC_KEY } from './config'

/** Endpoint kontrak OpenAPI (Swagger UI) untuk dokumentasi/uji manual. */
export const SPEC_UI_URL = API_SPEC_URL
export const SPEC_FILE_URL = `${API_SPEC_URL}/openapi.yaml`
