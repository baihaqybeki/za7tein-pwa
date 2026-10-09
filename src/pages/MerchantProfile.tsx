import { ChevronLeft, Clock, MapPin, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cookMinutesFor } from '../data/foods'
import { mockMerchant, STORE_STATUS_LABEL } from '../data/merchant'
import { money } from '../data/currency'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { useCatalog } from '../hooks/useCatalog'
import { setStoreStatus } from '../store/slices/uiSlice'
import type { StoreStatus } from '../types'

const STATUS_ORDER: StoreStatus[] = ['open', 'busy', 'closed']

/**
 * Profil merchant di sisi customer: identitas toko, jam buka, estimasi masak
 * per menu, dan status toko (buka/sibuk/tutup). Status di sini demo — satu
 * kontrol untuk memperlihatkan ketiga keadaan; di produksi nilainya dari
 * `merchants.store_status`.
 */
export default function MerchantProfile() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const status = useAppSelector((s) => s.ui.storeStatus)
  const { popular } = useCatalog()

  const menus = popular.slice(0, 8)
  const rating =
    menus.length > 0
      ? (menus.reduce((sum, m) => sum + m.rating, 0) / menus.length).toFixed(1)
      : '4.8'
  const avgCook = menus.length
    ? Math.round(menus.reduce((sum, m) => sum + cookMinutesFor(m), 0) / menus.length)
    : 0

  return (
    <div className="app-shell">
      <main>
        <div className="merchant-profile">
          <header className="merchant-profile__hero">
            <button
              type="button"
              className="back-btn-profile merchant-profile__back"
              aria-label="Kembali"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <img className="merchant-profile__logo" src={mockMerchant.logo} alt={mockMerchant.name} />
          </header>

          <section className="merchant-profile__card">
            <div className="merchant-profile__title-row">
              <h1 className="merchant-profile__name">{mockMerchant.name}</h1>
              <span className={`store-status store-status--${status}`} aria-live="polite">
                {STORE_STATUS_LABEL[status]}
              </span>
            </div>
            <p className="merchant-profile__meta">
              <Star size={14} fill="currentColor" aria-hidden="true" /> {rating} ·{' '}
              <Clock size={14} aria-hidden="true" /> buka {mockMerchant.openTime}–{mockMerchant.closeTime} ·{' '}
              <MapPin size={14} aria-hidden="true" /> 1,2 km
            </p>

            <div className="store-status-toggle" role="group" aria-label="Status toko (demo)">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`store-status-toggle__btn ${status === s ? 'is-active' : ''}`}
                  aria-pressed={status === s}
                  onClick={() => dispatch(setStoreStatus(s))}
                >
                  {STORE_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            {status === 'busy' ? (
              <p className="merchant-profile__notice">
                Toko sedang sibuk — estimasi masak bisa lebih lama.
              </p>
            ) : null}
            {status === 'closed' ? (
              <p className="merchant-profile__notice merchant-profile__notice--closed">
                Toko tutup — pesanan tidak dapat dibuat sekarang.
              </p>
            ) : null}
          </section>

          <section className="merchant-profile__menus">
            <h2 className="merchant-profile__menus-title">
              Menu · estimasi masak rata-rata ±{avgCook} menit
            </h2>
            <ul className="merchant-menu-list" role="list">
              {menus.map((menu) => (
                <li key={menu.id}>
                  <button
                    type="button"
                    className="merchant-menu-row"
                    onClick={() => navigate(`/menu-detail/${menu.id}`)}
                  >
                    <img className="merchant-menu-row__img" src={menu.image} alt={menu.name} width={56} height={56} />
                    <span className="merchant-menu-row__body">
                      <span className="merchant-menu-row__name">{menu.name}</span>
                      <span className="merchant-menu-row__cook">
                        <Clock size={13} strokeWidth={1.75} aria-hidden="true" /> ±{cookMinutesFor(menu)} menit masak
                      </span>
                    </span>
                    <span className="merchant-menu-row__price">{money(menu.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
    </div>
  )
}
