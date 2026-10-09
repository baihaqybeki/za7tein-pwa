import { Star } from 'lucide-react'
import { STORE_STATUS_LABEL, mockMerchant, money } from '../data/merchant'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

import CustomerHomeHero from '../components/customer/CustomerHomeHero'
import { HomePromoCarousel } from '../components/customer/HomePromoCarousel'
import { BottomNav } from '../components/layout/BottomNav'
import { AddToCartButton } from '../components/ui/AddToCartButton'
import { CurrencyConverter } from '../components/ui/CurrencyConverter'
import { FoodCard } from '../components/ui/FoodCard'
import { useAppSelector } from '../hooks/useAppStore'
import { useCatalog } from '../hooks/useCatalog'
import { useNotificationSound } from '../hooks/useNotificationSound'
import { selectUnreadCount } from '../store/slices/notificationsSlice'

export default function Home() {
  const navigate = useNavigate()
  const user = useAppSelector((s) => s.auth.user)
  const unreadNotifications = useAppSelector((s) => selectUnreadCount(s.notifications.items))
  const locationLabel = useAppSelector((s) => s.ui.locationLabel)
  const storeStatus = useAppSelector((s) => s.ui.storeStatus)
  const [category, setCategory] = useState('all')
  const { categories, deals, popular } = useCatalog()
  useNotificationSound()

  const visiblePopular =
    category === 'all' ? popular : popular.filter((f) => f.category === category)

  return (
    <div className="app-shell">
    <div className="home-screen-wrapper">
      <div className="home-screen">
        <CustomerHomeHero
          avatarUrl={user?.avatar}
          avatarAlt={user?.name ?? ''}
          location={locationLabel}
          notificationCount={unreadNotifications}
          onOpenProfile={() => navigate('/profile')}
          onChangeLocation={() => toast.success('Change delivery location')}
          onOpenNotifications={() => navigate('/notifications')}
          onOpenFilters={() => navigate('/filter')}
          onSubmitSearch={() => navigate('/search')}
        />

        <div className="home-content">
          <Link className="home-store-link" to="/store-profile">
            <img className="home-store-link__logo" src={mockMerchant.logo} alt="" width={44} height={44} />
            <span className="home-store-link__body">
              <span className="home-store-link__name">{mockMerchant.name}</span>
              <span className="home-store-link__rating">
                <Star size={12} fill="currentColor" aria-hidden="true" /> {mockMerchant.rating.toFixed(1)} (
                {mockMerchant.reviewCount}) · {mockMerchant.openTime}–{mockMerchant.closeTime}
              </span>
              <span className={`store-status store-status--${storeStatus}`}>
                {STORE_STATUS_LABEL[storeStatus]}
              </span>
            </span>
            <span className="home-store-link__cta">Profil toko</span>
          </Link>

          <div className="categories-section">
            <h2 className="section-title s7-parallax--title">Categories</h2>
            <div className="categories-scroll" role="list">
              {categories.map((c) => {
                const Icon = c.icon
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="listitem"
                    className={`category-btn ${category === c.id ? 'active' : ''}`}
                    aria-pressed={category === c.id}
                    onClick={() => setCategory(c.id)}
                  >
                    {Icon ? <Icon size={16} strokeWidth={2} aria-hidden="true" /> : null}
                    {c.label}
                  </button>
                )
              })}
            </div>
          </div>

          <CurrencyConverter />

          <div className="deals-section">
            <div className="section-header">
              <h2 className="section-title s7-parallax--title">Super Deals</h2>
              <Link className="see-all-link" to="/search">
                See All
              </Link>
            </div>
            <div className="food-cards-scroll h-scroll-strip" role="list">
              {deals.map((food, i) => (
                <FoodCard
                  key={food.id}
                  food={food}
                  style={{ '--stagger-index': i }}
                  className="stagger-in"
                  onOpen={(f) => navigate(`/menu-detail/${f.id}`)}
                />
              ))}
            </div>
          </div>

          <HomePromoCarousel deals={deals} />

          <div className="hot-deals-section">
            <div className="section-header">
              <h2 className="section-title s7-parallax--title">Hot Deals</h2>
              <Link className="see-all-link" to="/search">
                See All
              </Link>
            </div>
            <div className="hot-deals-list" role="list">
              {visiblePopular.map((food) => (
                <div
                  key={food.id}
                  className="hot-deal-card"
                  role="article"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/menu-detail/${food.id}`)}
                >
                  <div className="hot-deal-image" style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      alt={food.name}
                      loading="lazy"
                      width={80}
                      height={80}
                      src={food.image}
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 12 }}
                    />
                  </div>
                  <div className="hot-deal-info">
                    <span className="hot-deal-title">{food.name}</span>
                    <div className="hot-deal-meta">
                      {food.deliveryTime} • {food.distance}
                    </div>
                    <div className="hot-deal-rating">
                      <Star size={14} fill="currentColor" />
                      {food.rating} ({food.reviewCount} Reviews)
                    </div>
                    <div className="hot-deal-price">{money(food.price)}</div>
                  </div>
                  <AddToCartButton food={food} className="hot-deal-add" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
    </div>
  )
}
