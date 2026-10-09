import {
  MOCK_EXCHANGE_RATE,
  RATE_DISCLAIMER,
  moneyPlain,
  syncedLabel,
} from '../../data/currency'

interface ExchangeRateNoteProps {
  /** Rate yang ditampilkan; default rate mock statis (flow F10). */
  rate?: number
  /** ISO waktu sync; default `fetchedAt` rate mock statis. */
  fetchedAt?: string
}

/**
 * Widget kurs IDR↔JOD: rate, waktu sync terakhir, dan disclaimer (M1, flow F10).
 * Dipasang di layar uang (checkout) — bukan di setiap halaman, karena angkanya
 * sama di semua tempat.
 *
 * `rate`/`fetchedAt` opsional agar kartu konverter Home bisa memasang rate
 * hariannya sendiri tanpa menggandakan salinan teks disclaimer.
 */
export function ExchangeRateNote({
  rate = MOCK_EXCHANGE_RATE.rate,
  fetchedAt = MOCK_EXCHANGE_RATE.fetchedAt,
}: ExchangeRateNoteProps) {
  return (
    <p className="exchange-rate-note">
      1 JOD = {moneyPlain(rate)} · sync terakhir {syncedLabel(fetchedAt)} ·{' '}
      {RATE_DISCLAIMER}
    </p>
  )
}
