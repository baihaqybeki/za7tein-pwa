import type { ExchangeRate } from '../types'

/**
 * Kurs IDR→JOD — satu-satunya sumber di repo (R-CURR-01, flow F10).
 *
 * Semua nominal disimpan **IDR** (source of truth); JOD hanya untuk tampilan dan
 * tidak pernah jadi nilai transaksi. Sync live belum ada (OQ-26: provider belum
 * diputuskan; OQ-28: umur fallback belum ditentukan), jadi ini rate mock yang
 * disebut milestone M1: 1 JOD = Rp23.000.
 */
export const MOCK_EXCHANGE_RATE: ExchangeRate = {
  base: 'JOD',
  quote: 'IDR',
  rate: 23000,
  fetchedAt: '2026-09-23T06:00:00+07:00',
  source: 'Mock',
}

/** Kalimat wajib di dekat nominal JOD (R-CURR-01). */
export const RATE_DISCLAIMER = 'kurs estimasi, mengikuti kurs harian'

/**
 * Simulasi "hit" harian pengganti API kurs (OQ-26 belum diputuskan).
 *
 * Rate bergeser deterministik per tanggal (±1,5% dari basis) supaya angka
 * munasabah berbeda tiap hari tanpa sumber eksternal. Di produksi, sumber ini
 * diganti `exchange_rates` dari sinkron backend (flow F10) — lihat UNRESOLVED.
 */
export const RATE_DAILY_DRIFT = 0.015

/**
 * Rate untuk sebuah tanggal — deterministik, bulat ke IDR penuh.
 *
 * Dipakai `fetchDailyRate()`; dipisah supaya bisa diuji tanpa `Date` global.
 */
export function dailyRate(date: Date): number {
  const key = date.toDateString()
  let hash = 0
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0
  }
  const frac = (Math.abs(hash) % 1000) / 1000
  const drift = (frac - 0.5) * 2 * RATE_DAILY_DRIFT
  return Math.round(MOCK_EXCHANGE_RATE.rate * (1 + drift))
}

/**
 * Satu "hit" kurs harian (mock). Di produksi ini panggilan sinkron 1×24 jam
 * ke provider kurs; di repo ini hasilnya dihitung lokal lalu di-cache hook
 * `useDailyExchangeRate` supaya benar-benar sekali per hari.
 */
export function fetchDailyRate(date = new Date()): ExchangeRate {
  return {
    base: 'JOD',
    quote: 'IDR',
    rate: dailyRate(date),
    fetchedAt: date.toISOString(),
    source: 'Mock harian',
  }
}

/** IDR saja — untuk tempat sempit (label tombol, aria-label) yang tak muat pasangan. */
export function moneyPlain(idr: number): string {
  return 'Rp' + Math.round(idr).toLocaleString('id-ID')
}

/** IDR→JOD pada rate tertentu, 2 desimal — pembulatan hanya di layer tampilan. */
export function idrToJodAt(idr: number, rate: number): number {
  if (!rate) return 0
  return Number((idr / rate).toFixed(2))
}

/** JOD→IDR pada rate tertentu, bulat ke IDR penuh. */
export function jodToIdrAt(value: number, rate: number): number {
  if (!rate) return 0
  return Math.round(value * rate)
}

/** Padanan JOD, dibulatkan 2 desimal — pembulatan hanya di layer tampilan. */
export function idrToJod(idr: number): number {
  return idrToJodAt(idr, MOCK_EXCHANGE_RATE.rate)
}

/**
 * Kembalikan nominal JOD ke IDR utuh. Dipakai untuk konstanta yang PRD tetapkan
 * dalam JOD (fee, ambang top-up) supaya state tetap IDR (R-CURR-01).
 */
export function jodToIdr(value: number): number {
  return jodToIdrAt(value, MOCK_EXCHANGE_RATE.rate)
}

/** Nominal JOD, mis. `1,09 JOD`. */
export function jod(value: number): string {
  return `${value.toFixed(2).replace('.', ',')} JOD`
}

/**
 * Nominal uang untuk UI: IDR + padanan JOD, mis. `Rp25.000 · ±1,09 JOD`.
 *
 * Nol dilewatkan tanpa padanan — `Rp0 · ±0,00 JOD` cuma menambah bising di baris
 * diskon/biaya yang memang kosong.
 */
export function money(idr: number): string {
  if (idr === 0) return moneyPlain(idr)
  return `${moneyPlain(idr)} · ±${jod(idrToJod(idr))}`
}

/**
 * Nominal uang dari angka yang tersimpan dalam JOD: IDR (source of truth) +
 * padanan JOD, mis. `Rp80.500 · ±3,50 JOD`. Dipakai konsol CS, yang angka
 * mock-nya ditulis dalam JOD — konversinya sekali di sini, bukan di tiap layar
 * (R-CURR-01).
 */
export function moneyFromJod(valueJod: number): string {
  return money(jodToIdr(valueJod))
}

/** Waktu sync terakhir untuk sebuah ISO timestamp — mis. `23 Sep, 06.00`. */
export function syncedLabel(fetchedAt: string): string {
  return new Date(fetchedAt).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Waktu sync terakhir rate mock statis — mis. `23 Sep, 06.00`. */
export function rateSyncedLabel(): string {
  return syncedLabel(MOCK_EXCHANGE_RATE.fetchedAt)
}
