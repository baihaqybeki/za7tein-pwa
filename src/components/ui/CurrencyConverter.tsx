import { ArrowUpDown } from 'lucide-react'
import { useState } from 'react'

import { idrToJodAt, jodToIdrAt } from '../../data/currency'
import { useDailyExchangeRate } from '../../hooks/useDailyExchangeRate'
import { ExchangeRateNote } from './ExchangeRateNote'

type Direction = 'idr-jod' | 'jod-idr'

/** Baca angka dari input bebas: terima koma atau titik, buang sisanya. */
function parseAmount(raw: string): number {
  const normalized = raw.replace(/[^\d.,]/g, '').replace(',', '.')
  const value = Number.parseFloat(normalized)
  return Number.isFinite(value) && value >= 0 ? value : 0
}

/** IDR tanpa simbol — simbol ada di label, angka tetap rata kanan. */
function formatIdr(value: number): string {
  return Math.round(value).toLocaleString('id-ID')
}

/** JOD 2 desimal dengan koma (kebiasaan ID), tanpa sufiks. */
function formatJod(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

/**
 * Kartu konversi kurs IDR↔JOD di Home customer (dua arah + tombol tukar).
 *
 * Memakai rate harian dari `useDailyExchangeRate` (hit sekali sehari) dan
 * menutup kartu dengan `ExchangeRateNote` yang memuat disclaimer wajib
 * (R-CURR-01). Angka konversi hanya tampilan — tidak ada state nominal JOD.
 */
export function CurrencyConverter() {
  const { rate } = useDailyExchangeRate()
  const [direction, setDirection] = useState<Direction>('idr-jod')
  const [raw, setRaw] = useState('')

  const amount = parseAmount(raw)
  const fromCode = direction === 'idr-jod' ? 'IDR' : 'JOD'
  const toCode = direction === 'idr-jod' ? 'JOD' : 'IDR'

  const converted =
    direction === 'idr-jod'
      ? idrToJodAt(amount, rate.rate)
      : jodToIdrAt(amount, rate.rate)

  const targetValue =
    amount === 0
      ? ''
      : direction === 'idr-jod'
        ? formatJod(converted)
        : formatIdr(converted)

  const swap = () => {
    setDirection((d) => (d === 'idr-jod' ? 'jod-idr' : 'idr-jod'))
    setRaw(amount === 0 ? '' : String(converted))
  }

  return (
    <section className="currency-converter" aria-label="Konversi kurs IDR dan JOD">
      <div className="currency-converter-head">
        <h2 className="currency-converter-title">Konversi Kurs</h2>
        <span className="currency-converter-hint">Diperbarui sekali sehari</span>
      </div>

      <div className="currency-converter-row">
        <div className="currency-converter-field">
          <label htmlFor="currency-from">Jumlah ({fromCode})</label>
          <input
            id="currency-from"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="currency-converter-swap"
          aria-label="Tukar arah konversi"
          onClick={swap}
        >
          <ArrowUpDown size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>

        <div className="currency-converter-field">
          <label htmlFor="currency-to">Hasil ({toCode})</label>
          <input
            id="currency-to"
            type="text"
            readOnly
            tabIndex={-1}
            placeholder="0"
            value={targetValue}
          />
        </div>
      </div>

      <ExchangeRateNote rate={rate.rate} fetchedAt={rate.fetchedAt} />
    </section>
  )
}
