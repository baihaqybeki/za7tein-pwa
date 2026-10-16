// Klien Postgres via Cloudflare Hyperdrive (target Supabase Postgres yang sama).
import postgres from 'postgres'

export interface HyperdriveBinding {
  connectionString: string
}

/** Satu klien per request; Hyperdrive menangani pooling. `prepare:false` wajib di Hyperdrive. */
export function pg(hyperdrive: HyperdriveBinding) {
  return postgres(hyperdrive.connectionString, { max: 1, prepare: false, fetch_types: false })
}
