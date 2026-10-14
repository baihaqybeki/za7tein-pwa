// Ringkasan checkout: subtotal + ongkir zona, metode bayar PRD (COD / transfer),
// dan unggah bukti transfer untuk pesanan transfer.
import { ChevronLeft, Check } from 'lucide-react'

import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { ExchangeRateNote } from '../components/ui/ExchangeRateNote'
import { WalletTopUpGate } from '../components/ui/WalletTopUpGate'
import {
  PAYMENT_METHODS,
  PLATFORM_FEE_CUSTOMER_IDR,
  deliveryFeeFor,
  formatDistance,
  isDeliverable,
  money,
  needsTopUpGate,
  zoneFor,
} from '../data/merchant'
import { mockUser } from '../data/user'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { selectSubtotal, setTransferProof, createOrderHold } from '../store/slices/cartSlice'
import { applyHoldEvent } from '../store/slices/walletSlice'

export default function PaymentAmount() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const fileRef = useRef<HTMLInputElement>(null)

  const items = useAppSelector((s) => s.cart.items)
  const stored = useAppSelector((s) => s.cart.addresses)
  const addresses = Array.isArray(stored) ? stored : mockUser.addresses
  const addressId = useAppSelector((s) => s.cart.selectedAddressId)
  const paymentId = useAppSelector((s) => s.cart.selectedPaymentId)
  const proof = useAppSelector((s) => s.cart.transferProof)

  const subtotal = selectSubtotal(items)
  const address = addresses.find((a) => a.id === addressId) ?? addresses[0]
  const zone = address ? zoneFor(address) : null
  const deliverable = address ? isDeliverable(address) : false
  const fee = address ? deliveryFeeFor(address) : 0
  const total = subtotal + fee + PLATFORM_FEE_CUSTOMER_IDR
  const method = PAYMENT_METHODS.find((m) => m.id === paymentId) ?? PAYMENT_METHODS[0]
  const needsProof = method.id === 'dana_va'
  const walletAvailable = useAppSelector((s) => s.wallet.balance.available)
  const gated = needsTopUpGate(walletAvailable)
  /**
   * COD memakai hold dari saldo wallet (R-COD-01), jadi nominal order harus
   * benar-benar tersedia. Gate 3,5 JOD cuma ambang akun baru — bukan jaminan
   * saldo cukup untuk order ini.
   */
  const holdShort = method.id === 'cod' && walletAvailable < total
  const canPay =
    deliverable && items.length > 0 && (!needsProof || proof !== null) && !gated && !holdShort

  const pickProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    dispatch(setTransferProof(file.name))
    toast.success('Bukti transfer diunggah')
  }

  const pay = () => {
    if (!deliverable) {
      toast.error('Alamat di luar area antar')
      return
    }
    if (items.length === 0) {
      toast.error('Keranjang masih kosong')
      return
    }
    if (needsProof && !proof) {
      toast.error('Unggah bukti transfer dulu')
      return
    }
    if (gated) {
      toast.error('Saldo di bawah 3,5 JOD — top-up dulu')
      return
    }
    if (holdShort) {
      toast.error('Saldo tidak cukup untuk hold COD')
      return
    }
    if (method.id === 'cod') {
      // Order COD dibuat → saldo ditahan. Satu transisi = satu entry hold.
      dispatch(createOrderHold({ amountIdr: total }))
      dispatch(applyHoldEvent({ event: 'hold_created', amountIdr: total }))
    }
    navigate('/order-placed')
  }

  return (
    <>
      <div className="app-shell">
        <main>
          <div className="payment-amount-screen">
            <header className="payment-amount-header">
              <button type="button" className="btn-back" aria-label="Go back" onClick={() => navigate(-1)}>
                <ChevronLeft size={24} strokeWidth={1.75} />
              </button>
              <h1 className="payment-amount-title">
                Checkout
              </h1>
            </header>
            <div className="payment-amount-content">
              {address ? (
                <div className="order-summary-section">
                  <h2 className="section-title">Antar ke</h2>
                  <div className="summary-item">
                    <span>{address.building}</span>
                    <span className="zone-fee">{address.floor} · {address.unit}</span>
                  </div>
                  <div className="summary-item">
                    <span className={deliverable ? 'zone-badge' : 'zone-badge zone-badge--blocked'}>
                      {deliverable ? `Zona ${zone!.label} · ${zone!.area}` : 'Di luar area antar'}
                    </span>
                    <span className="zone-fee">
                      {deliverable
                        ? `${formatDistance(address.distanceMeters)} dari toko`
                        : `${formatDistance(address.distanceMeters)}, di luar area antar`}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="order-summary-section">
                  <h2 className="section-title">Antar ke</h2>
                  <div className="summary-item">
                    <span>Belum ada alamat pengantaran</span>
                    <span className="zone-fee">Kembali untuk menambah</span>
                  </div>
                </div>
              )}

              <div className="order-summary-section">
                <h2 className="section-title">
                  Order Summary
                </h2>
                <div className="summary-item">
                  <span>
                    Order Amount
                  </span>
                  <span>
                    {money(subtotal)}
                  </span>
                </div>
                <div className="summary-item">
                  <span>
                    Ongkir {deliverable && zone ? `(Zona ${zone.label})` : ''}
                  </span>
                  <span>
                    {deliverable ? money(fee) : '—'}
                  </span>
                </div>
                <div className="summary-item">
                  <span>
                    Biaya Layanan
                  </span>
                  <span>
                    {money(PLATFORM_FEE_CUSTOMER_IDR)}
                  </span>
                </div>
                <div className="summary-item">
                  <span>
                    Discount
                  </span>
                  <span>
                    {money(0)}
                  </span>
                </div>
                <div className="summary-divider" />
                <div className="summary-total">
                  <span>
                    Total Payment
                  </span>
                  <span>
                    {money(total)}
                  </span>
                </div>
                <ExchangeRateNote />
              </div>

              <div className="payment-method-display">
                <h2 className="section-title">
                  Payment Method
                </h2>
                <div className="payment-method-card">
                  <div className="payment-method-row">
                    <span className="payment-method-label">{method.label}</span>
                    <button type="button" className="payment-change-btn" onClick={() => navigate('/payment-selection')}>
                      Ganti
                    </button>
                  </div>
                  <p className="payment-method-note">
                    {method.description}
                  </p>

                  {needsProof ? (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="proof-input"
                        onChange={pickProof}
                      />
                      <button
                        type="button"
                        className={proof ? 'proof-upload proof-upload--done' : 'proof-upload'}
                        onClick={() => fileRef.current?.click()}
                      >
                        {proof ? (
                          <>
                            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
                            {proof}
                          </>
                        ) : (
                          'Unggah Bukti Transfer'
                        )}
                      </button>
                      <p className="payment-method-note">
                        {proof
                          ? 'Bukti terunggah. Pesanan diteruskan ke toko untuk diverifikasi.'
                          : 'Pesanan tidak bisa dikirim sebelum bukti transfer diunggah.'}
                      </p>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
            <WalletTopUpGate />
            {holdShort ? (
              <p className="wallet-warning" role="status">
                Saldo tersedia {money(walletAvailable)} — kurang dari {money(total)} yang perlu
                di-hold untuk COD.
              </p>
            ) : null}
            <div className="payment-amount-footer">
              <button className="btn btn-primary pay-btn" disabled={!canPay} onClick={pay}>
                {gated
                  ? 'Top-up dulu · saldo kurang'
                  : holdShort
                    ? 'Saldo kurang untuk hold COD'
                    : method.id === 'cod'
                      ? `Pesan — ${money(total)}`
                      : `Bayar — ${money(total)}`}
              </button>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
