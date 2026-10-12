import { ChevronLeft, Clock, MapPin, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { cookMinutesFor } from '../data/foods'
import { mockMerchant, STORE_STATUS_LABEL } from '../data/merchant'
import { jodToIdr, money } from '../data/currency'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { useCatalog } from '../hooks/useCatalog'
import { useRemoteCatalog } from '../hooks/useRemoteCatalog'
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
  const remote = useRemoteCatalog()
  const rm = remote.source === 'remote' ? remote.merchant : null

  const name = rm?.store_name ?? mockMerchant.name
  const photo = rm?.photo ?? mockMerchant.logo
  const rating = rm ? Number(rm.rating_avg) : mockMerchant.rating
  const reviewCount = rm?.rating_count ?? mockMerchant.reviewCount
  const openTime = rm?.open_time ? rm.open_time.slice(0, 5) : mockMerchant.openTime
  const closeTime = rm?.close_time ? rm.close_time.slice(0, 5) : mockMerchant.closeTime

  const menuRows = rm
    ? remote.menus.slice(0, 8).map((m) => ({
        id: String(m.id),
        name: m.name,
        image: m.image ?? '',
        cook: m.cook_minutes ?? 15,
        priceIdr: jodToIdr(Number(m.price_jod)),
      }))
    : popular.slice(0, 8).map((m) => ({
        id: m.id,
        name: m.name,
        image: m.image,
        cook: cookMinutesFor(m),
        priceIdr: m.price,
      }))
  const avgCook = menuRows.length
    ? Math.round(menuRows.reduce((sum, m) => sum + m.cook, 0) / menuRows.length)
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
            <img className="merchant-profile__logo" src={photo} alt={name} />
          </header>

          <section className="merchant-profile__card">
            <div className="merchant-profile__title-row">
              <h1 className="merchant-profile__name">{name}</h1>
              <span className={`store-status store-status--${status}`} aria-live="polite">
                {STORE_STATUS_LABEL[status]}
              </span>
            </div>
            <p className="merchant-profile__meta">
              <Star size={14} fill="currentColor" aria-hidden="true" /> {rating.toFixed(1)}{' '}
              ({reviewCount}) ·{' '}
              <Clock size={14} aria-hidden="true" /> buka {openTime}–{closeTime} ·{' '}
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
              {menuRows.map((menu) => (
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
                        <Clock size={13} strokeWidth={1.75} aria-hidden="true" /> ±{menu.cook} menit masak
                      </span>
                    </span>
                    <span className="merchant-menu-row__price">{money(menu.priceIdr)}</span>
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
