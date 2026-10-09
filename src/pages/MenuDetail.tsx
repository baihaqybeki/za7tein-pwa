import { useState } from 'react'
import { ChevronLeft, Clock3, Minus, Plus, ShoppingCart, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { cookMinutesFor, modifierExtra, modifierSummary } from '../data/foods'
import { useCatalog } from '../hooks/useCatalog'
import { menuDetailReviews } from '../data/reviews'
import { useAppDispatch } from '../hooks/useAppStore'
import { FavoriteButton } from '../components/ui/FavoriteButton'
import { addItem } from '../store/slices/cartSlice'
import { money } from '../data/merchant'
import { moneyPlain } from '../data/currency'
import type { ModifierGroup } from '../types'

const TRUNCATE_AT = 96

export default function MenuDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { items, getFood } = useCatalog()
  const [quantityByFood, setQuantityByFood] = useState<Record<string, number>>({})
  const [expanded, setExpanded] = useState(false)
  const [chosenByFood, setChosenByFood] = useState<Record<string, string[]>>({})

  const food = getFood(id ?? '') ?? items[0]
  const quantity = quantityByFood[food.id] ?? 1
  const defaults = food.modifierGroups
    ?.filter((group) => group.type === 'single')
    .map((group) => group.options.find((option) => option.id === 'medium')?.id ?? group.options[0].id) ?? []
  const chosen = chosenByFood[food.id] ?? defaults
  const longDescription = food.description.length > 100
  const shownDescription =
    longDescription && !expanded
      ? `${food.description.slice(0, TRUNCATE_AT)}…`
      : food.description

  // Pilihan disimpan per menu agar pergantian :id tidak membawa state menu lain.
  const setQuantity = (update: (current: number) => number) =>
    setQuantityByFood((previous) => ({
      ...previous,
      [food.id]: update(previous[food.id] ?? 1),
    }))

  const toggle = (group: ModifierGroup, optionId: string) => {
    setChosenByFood((previous) => {
      const prev = previous[food.id] ?? defaults
      if (group.type === 'single') {
        const cleared = prev.filter((id) => !group.options.some((o) => o.id === id))
        return { ...previous, [food.id]: [...cleared, optionId] }
      }
      return {
        ...previous,
        [food.id]: prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      }
    })
  }

  const extras = modifierExtra(food.modifierGroups, chosen)
  const unitPrice = food.price + extras

  const addToCart = () => {
    const summary = modifierSummary(food.modifierGroups, chosen)
    dispatch(addItem({ food, quantity, unitPrice, modifiers: summary || undefined }))
    toast.success(`${quantity} × ${food.name}${summary ? ` (${summary})` : ''} masuk keranjang`)
  }

  return (
    <>
      <div className="app-shell">
        <main>
          <div className="menu-detail-screen">
            <div className="menu-detail-hero s7-parallax--media">
              <img
                alt={food.name}
                className="menu-detail-hero-image"
                src={food.image}
                style={{
                  position: 'absolute',
                  height: '100%',
                  width: '100%',
                  inset: 0,
                  objectFit: 'cover',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background:
                    'linear-gradient(rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0) 50%)',
                  pointerEvents: 'none',
                }}
              />
              <div className="menu-detail-header">
                <button
                  type="button"
                  className="btn-back"
                  aria-label="Go back"
                  onClick={() => navigate(-1)}
                >
                  <ChevronLeft size={24} strokeWidth={1.75} />
                </button>
                <h1 className="menu-detail-title">Menu Detail</h1>
                <FavoriteButton id={food.id} name={food.name} className="favorite-header-btn" size={24} />
              </div>
            </div>

            <div className="menu-detail-content">
              <div className="menu-detail-name-price">
                <h2 className="menu-detail-name">{food.name}</h2>
                <span className="menu-detail-price">{money(unitPrice)}</span>
              </div>

              <div className="menu-info-badges" role="list" aria-label="Food details">
                <div className="info-badge" role="listitem">
                  <ShoppingCart size={22} strokeWidth={1.75} />
                  <span>Ongkir per zona</span>
                </div>
                <div className="info-badge" role="listitem">
                  <Clock3 size={18} strokeWidth={1.75} />
                  <span>{food.deliveryTime}</span>
                </div>
                <div className="info-badge" role="listitem">
                  <Clock3 size={18} strokeWidth={1.75} />
                  <span>±{cookMinutesFor(food)} menit masak</span>
                </div>
                <div className="info-badge" role="listitem">
                  <Star size={16} strokeWidth={1.75} color="var(--star)" fill="var(--star)" />
                  <span>{food.rating}</span>
                </div>
              </div>

              <Link className="menu-store-link" to="/store-profile">
                Lihat profil toko
              </Link>

              <div className="menu-description-section">
                <h3 className="description-title s7-parallax--title">Description</h3>
                <div className="menu-description-wrapper">
                  <p className="menu-description">
                    <span className="description-bold">{food.name} </span>
                    <span className="description-text">{shownDescription}</span>
                  </p>
                  {longDescription ? (
                    <button
                      type="button"
                      className="read-more-btn"
                      aria-expanded={expanded}
                      onClick={() => setExpanded((v) => !v)}
                    >
                      {expanded ? 'Show Less' : 'Read More...'}
                    </button>
                  ) : null}
                </div>
              </div>

              {food.modifierGroups?.map((group) => (
                <div className="modifier-group" key={group.id} role="group" aria-label={group.name}>
                  <h3 className="modifier-group-title">{group.name}</h3>
                  {group.options.map((opt) => {
                    const active = chosen.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`modifier-option${active ? ' active' : ''}`}
                        aria-pressed={active}
                        onClick={() => toggle(group, opt.id)}
                      >
                        <span className={`modifier-box${group.type === 'multi' ? ' modifier-box--multi' : ''}${active ? ' active' : ''}`} />
                        <span className="modifier-option-label">{opt.label}</span>
                        {opt.extraPrice > 0 ? (
                          <span className="modifier-option-price">+{money(opt.extraPrice)}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}

              <div className="menu-reviews-section">
                <div className="reviews-header">
                  <h3 className="reviews-title s7-parallax--title">Reviews ({food.reviewCount})</h3>
                  <Link className="see-all-link" to="/reviews">
                    See All
                  </Link>
                </div>
                <div className="reviews-list">
                  {menuDetailReviews.map((review) => (
                    <div className="review-card s7-parallax--card" key={review.id}>
                      <img
                        alt={review.name}
                        width={52}
                        height={52}
                        className="reviewer-avatar"
                        src={review.avatar}
                      />
                      <div className="review-content">
                        <div className="reviewer-info">
                          <span className="reviewer-name">{review.name}</span>
                          <div className="review-rating">
                            <Star size={16} strokeWidth={1.75} color="var(--star)" fill="var(--star)" />
                            <span className="rating-value">{review.rating}</span>
                          </div>
                        </div>
                        <p className="review-text">{review.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="menu-detail-actions">
              <div className="quantity-selector" role="group" aria-label="Select quantity">
                <button
                  type="button"
                  className="quantity-btn quantity-minus"
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                >
                  <Minus size={24} strokeWidth={1.75} />
                </button>
                <span className="quantity-value" aria-live="polite" aria-atomic="true">
                  {quantity}
                </span>
                <button
                  type="button"
                  className="quantity-btn quantity-plus"
                  aria-label="Increase quantity"
                  onClick={() => setQuantity((q) => q + 1)}
                >
                  <Plus size={24} strokeWidth={1.75} />
                </button>
              </div>
              <button
                type="button"
                className="add-to-cart-btn"
                aria-label={`Tambah ${quantity} ${food.name} ke keranjang, total ${moneyPlain(unitPrice * quantity)}`}
                onClick={addToCart}
              >
                <ShoppingCart size={20} strokeWidth={1.75} />
                <span>Tambah ke Keranjang — {money(unitPrice * quantity)}</span>
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
