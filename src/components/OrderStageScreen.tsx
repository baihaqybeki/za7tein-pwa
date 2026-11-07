import { ChevronLeft, Crosshair, MapPin, MessageCircle, Phone, Scale, Star, Store, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { DeliveryActionCard, DeliveryStepper } from './DeliveryCheckpoints'
import { JourneyLine } from './JourneyLine'

import {
  DELIVERY_OTP_DEMO,
  COURIER_ACTION_LABEL,
} from '../data/courier'
import { DISPUTE_WINDOW_HOURS, RESOLUTIONS, disputeStatusLabel, resolvedOrderToken } from '../data/admin'
import { BottomSheet } from './ui/BottomSheet'
import {
  HOLD_EVENT_LABEL,
  HOLD_STATUS_COPY,
  ORDER_STAGES,
  formatDistance,
  merchantDeliveryConfig,
  mockCouriers,
  mockMerchant,
  mockOrder,
  money,
  zoneFor,
} from '../data/merchant'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { useLeafletMap } from '../hooks/useLeafletMap'
import { useTick } from '../hooks/useTick'
import { useOrderJourney } from '../hooks/useOrderJourney'
import { OrderJourneyPanel } from './OrderJourneyPanel'
import {
  advanceDelivery,
  cancelOrder,
  completeDelivery,
  matchCourier,
  settleOrderHold,
} from '../store/slices/cartSlice'
import { requestAppeal } from '../store/slices/adminSlice'
import { applyHoldEvent } from '../store/slices/walletSlice'
import type { OrderStage } from '../types'

/**
 * Layar tahap pesanan.
 *
 * Versi hasil porting menaruh peta setinggi hampir seluruh layar di belakang
 * panel melengkung, jadi bagian yang paling menonjol justru yang paling
 * sedikit informasinya — sementara status pesanan, satu-satunya hal yang
 * dicari orang, terdorong ke bawah lipatan. Di sini urutannya dibalik:
 * status lebih dulu, peta menyesuaikan tahap.
 *
 * Kelima rute order memakai komponen ini. Sebelumnya `/order-tracking`,
 * `/order-delivery`, `/order-delivered`, dan `/order-success` adalah empat
 * salinan markup portingan yang sama — hanya beda prefix kelas dan nomor
 * pesanan — sehingga perbaikan desain harus diulang empat kali dan salah
 * satunya pasti tertinggal. Sekarang tahapnya yang berbeda, tampilannya satu.
 */

const IconStore = () => <Store size={20} strokeWidth={1.75} aria-hidden="true" />

const IconCourier = () => <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />

const IconPin = () => <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />

const IconPhone = () => <Phone size={16} strokeWidth={1.75} aria-hidden="true" />

const IconChat = () => <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />

const IconBack = () => <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />

const IconRecenter = () => <Crosshair size={20} strokeWidth={1.75} aria-hidden="true" />

const IconScale = () => <Scale size={16} strokeWidth={1.75} aria-hidden="true" />

/* ── Teks per tahap ──────────────────────────────────────────────────────── */

const STATUS: Record<
  OrderStage,
  { label: string; etaLabel: string; eta: string; courier: string }
> = {
  diterima: {
    label: 'Pesanan diterima',
    etaLabel: 'Estimasi siap',
    eta: mockOrder.readyEstimate,
    courier: 'Menunggu konfirmasi toko',
  },
  dimasak: {
    label: 'Sedang dimasak',
    etaLabel: 'Estimasi siap',
    eta: mockOrder.readyEstimate,
    courier: 'Menunggu pesanan siap',
  },
  diantar: {
    label: 'Sedang diantar',
    etaLabel: 'Estimasi tiba',
    eta: mockOrder.arriveEstimate,
    courier: 'Menuju alamatmu',
  },
  tiba: {
    label: 'Pesanan tiba',
    etaLabel: 'Tiba pukul',
    eta: mockOrder.arriveEstimate,
    courier: 'Pesanan sudah diterima',
  },
}

type Props = {
  /**
   * Tahap yang ditampilkan rute ini. Kalau dikosongkan, tahapnya dibaca dari
   * store — itu yang dipakai `/order-placed`, karena halaman itu muncul tepat
   * setelah memesan dan tahapnya masih bergerak.
   */
  stage?: OrderStage
}

export default function OrderStageScreen({ stage: fixedStage }: Props) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [params] = useSearchParams()
  const orderParam = params.get('order')
  const journey = useOrderJourney(orderParam)
  const rawStage = useAppSelector((s) => s.cart.orderStage)
  const addresses = useAppSelector((s) => s.cart.addresses)
  const selectedAddressId = useAppSelector((s) => s.cart.selectedAddressId)
  // Hold COD (F2/M4) hanya berlaku untuk pesanan COD; metodenya dibaca dari store
  // supaya detail order menampilkan lifecycle yang benar, bukan selalu.
  const paymentId = useAppSelector((s) => s.cart.selectedPaymentId)
  const holdStatus = useAppSelector((s) => s.cart.holdStatus)
  const holdAmount = useAppSelector((s) => s.cart.holdAmountIdr)
  const holdLedger = useAppSelector((s) => s.cart.holdLedger)
  const deliveryCheckpoint = useAppSelector((s) => s.cart.deliveryCheckpoint)
  const deliveryCheckpointAt = useAppSelector((s) => s.cart.deliveryCheckpointAt)
  const gpsSnapshot = useAppSelector((s) => s.cart.gpsSnapshot)
  const orderCompletedAt = useAppSelector((s) => s.cart.orderCompletedAt)
  // Sengketa hidup di `admin.disputes` — satu sumber untuk order yang sama,
  // dibaca juga oleh antrean panel CS. Jadi order detail tidak menyimpan
  // salinan status yang bisa berbeda dengan yang diputuskan CS.
  const disputes = useAppSelector((s) => s.admin.disputes)
  const dispute = disputes.find((d) => d.orderCode === mockOrder.code)
  const isDisputed = dispute?.status === 'open' || dispute?.status === 'investigating'
  const resolutionToken = dispute?.resolution ? resolvedOrderToken(dispute.resolution) : null
  const { now } = useTick()
  // Kurir sudah tiba? Itu checkpoint kurir (slice terpisah), dipakai supaya
  // customer melihat kartu OTP tanpa harus menekan tombol demo dulu. Satu store,
  // pola sama seperti sengketa yang dibaca lintas peran.
  const courierArrived = useAppSelector((s) =>
    s.courier.tasks.some((t) => t.checkpoint === 'tiba'),
  )
  // Banding (F8 → F22): pihak yang mengajukan sengketa bisa meminta SA meninjau
  // putusan level-1 CS. Satu banding per sengketa.
  const appeal = dispute?.appeal
  const appealDecided = Boolean(appeal?.verdict)
  const canAppeal = Boolean(dispute && resolutionToken && !appeal)
  const [appealOpen, setAppealOpen] = useState(false)
  const [appealNote, setAppealNote] = useState('')

  // State tersimpan bisa berasal dari bentuk sebelum tahap pesanan ada, jadi
  // nilainya divalidasi di sini. Tanpa ini STATUS[undefined] melempar dan
  // seluruh halaman gagal dirender. `?stage=` menang atas semuanya supaya
  // tiap tahap bisa diperiksa tanpa mengubah kode.
  const sah = (v: string | null | undefined): v is OrderStage =>
    !!v && ORDER_STAGES.some((s) => s.id === v)

  const override = params.get('stage')
  const mockStage: OrderStage = sah(override) ? override : fixedStage ?? (sah(rawStage) ? rawStage : 'dimasak')
  const stageFromServer = (status: string): OrderStage => {
    const st = status.toLowerCase()
    if (st === 'waitingcourier') return 'diterima'
    if (st === 'delivery') return 'diantar'
    if (st === 'done') return 'tiba'
    return 'dimasak'
  }
  const stage: OrderStage = journey ? stageFromServer(journey.order.status) : mockStage

  // Pengantaran satu-satunya tahap di mana peta memang layak dominan.
  const isDelivery = stage === 'diantar'
  const { recenter } = useLeafletMap('order-map', isDelivery ? 'delivery' : 'preview')

  const address = addresses.find((a) => a.id === selectedAddressId) ?? addresses[0] ?? null
  const courier = mockCouriers[0]
  const copy = STATUS[stage]
  const zone = address ? zoneFor(address) : null
  // building menyimpan "Kompleks — Tower" dalam satu string; dipisah supaya
  // baris pertama menyebut kompleksnya dan baris kedua unitnya, seperti PRD.
  const [alamatKompleks, alamatTower] = address
    ? address.building.split(' — ')
    : ['', '']

  // Aksi mock lifecycle hold: satu tombol menggerakkan cartSlice (status +
  // ledger) dan wallet (perpindahan dana) bersamaan, karena satu transisi PRD
  // memang satu event status + satu entry ledger.
  const isCod = paymentId === 'cod'
  const holdCopy = HOLD_STATUS_COPY[holdStatus]

  const advanceHold = () => {
    if (holdStatus === 'held') {
      dispatch(matchCourier())
      dispatch(applyHoldEvent({ event: 'hold_cut', amountIdr: holdAmount }))
    } else if (holdStatus === 'cut') {
      dispatch(settleOrderHold())
      dispatch(applyHoldEvent({ event: 'hold_settled', amountIdr: holdAmount }))
    }
  }

  const cancelHold = () => {
    if (holdStatus !== 'held' && holdStatus !== 'cut') return
    dispatch(cancelOrder())
    dispatch(
      applyHoldEvent({
        event: holdStatus === 'held' ? 'hold_released' : 'hold_reversed',
        amountIdr: holdAmount,
      }),
    )
  }

  // OTP pengiriman (F5). Kode benar menutup pengiriman; kalau hold COD sudah
  // di-cut, OTP yang sama juga menyelesaikan hold — satu serah terima fisik.
  const deliveryAction = COURIER_ACTION_LABEL[deliveryCheckpoint]

  // Window sengketa 24 jam (M6) dihitung dari order selesai. Order yang belum
  // lewat alur checkpoint dianggap masih di dalam window — mock, bukan aturan
  // final (kategori + window masih OQ-29).
  const disputeWindowOpen =
    !orderCompletedAt ||
    now - new Date(orderCompletedAt).getTime() < DISPUTE_WINDOW_HOURS * 3_600_000

  // Sisi customer menampilkan OTP, kurir yang memasukkannya (C-09). Layar ini
  // menyediakan aksi demo supaya alur bisa diselesaikan tanpa peran kurir —
  // sama seperti tombol checkpoint lain di sini yang juga demo.
  const completeDeliveryDemo = () => {
    dispatch(completeDelivery())
    if (holdStatus === 'cut') {
      dispatch(settleOrderHold())
      dispatch(applyHoldEvent({ event: 'hold_settled', amountIdr: holdAmount }))
    }
    toast.success('OTP terverifikasi — pengiriman selesai (demo)')
    // Pengiriman selesai = pesanan tiba: layar perayaan yang menyalurkan ke
    // rating kurir (F19). Sebelumnya tidak ada yang membuka rute ini. Kode order
    // ikut dibawa supaya layar rating dan tip terikat ke order yang sama.
    navigate(`/order-arrived?order=${mockOrder.code}`)
  }

  const mapBlock = (
    <div className={`track-map track-map--${isDelivery ? 'delivery' : 'preview'}`}>
      <div id="order-map" className="order-map-container" />
      {isDelivery ? (
        <button
          className="track-recenter"
          aria-label="Pusatkan peta"
          type="button"
          onClick={recenter}
        >
          <IconRecenter />
        </button>
      ) : null}
    </div>
  )

  useEffect(() => {
    document.body.className = 'sa7tein-track-page'
    return () => {
      document.body.className = ''
    }
  }, [])

  return (
    <div className="app-shell">
      <main>
        <div className="track-screen">
          <header className="track-header">
            <button
              className="track-back"
              aria-label="Kembali"
              type="button"
              onClick={() => navigate(-1)}
            >
              <IconBack />
            </button>
            <div className="track-header-text">
              <h1 className="track-title">Pesanan</h1>
              <span className="track-ref">#{journey?.order.code ?? mockOrder.code}</span>
            </div>
          </header>

          {isDelivery ? mapBlock : null}

          {journey ? <OrderJourneyPanel journey={journey} /> : null}

          <section className="track-status" aria-live="polite">
            <p className="track-status-label">{copy.label}</p>
            <p className="track-status-eta">{copy.etaLabel}</p>
            <p className="track-status-time">{copy.eta}</p>
          </section>

          <JourneyLine stage={stage} />

          {/* Hold COD via wallet (R-COD-01, F2). Muncul di detail order supaya
              transisinya terlihat di tempat orang mencari status pesanan. */}
          {isCod ? (
            <section className="track-section">
              <h2 className="track-section-title">Hold COD</h2>
              <div className="hold-card" data-hold-status={holdStatus}>
                <div className="hold-card__head">
                  <span className={`hold-status hold-status--${holdStatus}`}>
                    {holdCopy.label}
                  </span>
                  <span className="hold-card__amount">{money(holdAmount)}</span>
                </div>
                <p className="hold-card__note">{holdCopy.note}</p>
                {isDisputed && (holdStatus === 'held' || holdStatus === 'cut') ? (
                  <p className="hold-card__note">
                    Hold dibekukan sampai panel CS memutuskan sengketa (F8).
                  </p>
                ) : null}
                {!isDisputed && (holdCopy.action || holdCopy.cancel) ? (
                  <div className="hold-card__actions">
                    {holdCopy.action ? (
                      <button className="track-action" type="button" onClick={advanceHold}>
                        {holdCopy.action}
                      </button>
                    ) : null}
                    {holdCopy.cancel ? (
                      <button className="track-action" type="button" onClick={cancelHold}>
                        {holdCopy.cancel}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {holdLedger.length > 0 ? (
                  <ol className="hold-ledger" aria-label="Ledger hold">
                    {holdLedger.map((entry) => (
                      <li key={entry.id} className="hold-ledger__row">
                        <span>{HOLD_EVENT_LABEL[entry.event]}</span>
                        <span>
                          {new Date(entry.at).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : null}
              </div>
            </section>
          ) : null}

          {isDelivery ? null : mapBlock}

          <section className="track-section">
            <h2 className="track-section-title">Toko</h2>
            <div className="track-row">
              <span className="track-icon">
                <IconStore />
              </span>
              <div className="track-row-text">
                <p className="track-row-name">{mockMerchant.name}</p>
                <p className="track-row-note">
                  Buka {mockMerchant.openTime}–{mockMerchant.closeTime}
                </p>
              </div>
            </div>
          </section>

          <section className="track-section">
            <h2 className="track-section-title">Kurir</h2>
            <div className="track-row">
              <span className="track-icon">
                <IconCourier />
              </span>
              <div className="track-row-text">
                <p className="track-row-name">
                  {courier.name}
                  <span className="track-rating">
                    <Star size={12} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />
                    {mockOrder.courierRating}
                  </span>
                </p>
                <p className="track-row-note">{copy.courier}</p>
              </div>
              <div className="track-actions">
                <a className="track-action" href={`tel:${courier.phone}`}>
                  <IconPhone />
                  Hubungi
                </a>
                <button
                  className="track-action"
                  type="button"
                  onClick={() => navigate('/order-chat')}
                >
                  <IconChat />
                  Chat
                </button>
              </div>
            </div>
          </section>

          {address ? (
            <section className="track-section">
              <h2 className="track-section-title">Tujuan</h2>
              <div className="track-row">
                <span className="track-icon">
                  <IconPin />
                </span>
                <div className="track-row-text">
                  <p className="track-row-name">{alamatKompleks}</p>
                  <p className="track-row-note">
                    {[alamatTower, address.floor, address.unit].filter(Boolean).join(' · ')}
                  </p>
                  <p className="track-row-meta">
                    {address.address} · {formatDistance(address.distanceMeters)}
                    {zone
                      ? ` · Zona ${zone.label} · ongkir ${money(merchantDeliveryConfig.ongkirIdr)}`
                      : ' · di luar jangkauan'}
                  </p>
                </div>
              </div>
            </section>
          ) : null}

          {/* Checkpoint pengiriman (F5/M5). Tombolnya aksi demo supaya timer SLA
              dan alur OTP bisa dilihat dari sisi customer; di produksi aksi ini
              milik kurir (layar kurir memakai komponen yang sama). Customer
              hanya menampilkan OTP, kurir yang memasukkannya (C-09). */}
          <section className="track-section">
            <h2 className="track-section-title">Checkpoint pengiriman</h2>
            <DeliveryStepper checkpoint={deliveryCheckpoint} />
            {deliveryCheckpoint === 'selesai' ? (
              <p className="track-row-note">
                Pengiriman selesai — OTP terverifikasi, order tidak menggantung.
              </p>
            ) : (
              <DeliveryActionCard
                checkpoint={deliveryCheckpoint}
                startedAt={deliveryCheckpointAt}
                now={now}
                otpDisplayCode={DELIVERY_OTP_DEMO}
                otpStep={deliveryCheckpoint === 'tiba' || courierArrived}
                autoSettlePaused={isDisputed}
                evidence={
                  deliveryCheckpoint === 'tiba' && gpsSnapshot ? (
                    <p className="courier-card-sub">
                      Bukti: GPS {gpsSnapshot.lat.toFixed(5)}, {gpsSnapshot.lng.toFixed(5)} · foto
                      serah terima (mock)
                    </p>
                  ) : null
                }
                actions={
                  deliveryAction ? (
                    <button
                      type="button"
                      className="btn btn-primary courier-primary"
                      onClick={() =>
                        dispatch(
                          advanceDelivery({
                            gps: address ? { lat: address.lat, lng: address.lng } : undefined,
                          }),
                        )
                      }
                    >
                      {deliveryAction}
                    </button>
                  ) : deliveryCheckpoint === 'tiba' ? (
                    <button
                      type="button"
                      className="btn btn-primary courier-primary"
                      onClick={completeDeliveryDemo}
                    >
                      Selesaikan (demo kurir)
                    </button>
                  ) : null
                }
              />
            )}
          </section>

          {/* Sengketa (F8/M6): 1× per order, window 24 jam dari order selesai.
              Antrean putusannya ada di panel CS (`/admin`), bukan konsol Super
              Admin terpisah. */}
          {stage === 'tiba' || dispute ? (
            <section className="track-section">
              <h2 className="track-section-title">Sengketa</h2>
              <div className="track-row">
                <span className="track-icon">
                  <Scale size={20} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <div className="track-row-text">
                  {dispute ? (
                    <>
                      <p className="track-row-name">
                        {dispute.category}
                        <span className={`admin-badge admin-badge--${dispute.status}`}>
                          {disputeStatusLabel[dispute.status]}
                        </span>
                      </p>
                      <p className="track-row-note">
                        Diajukan {dispute.filedAt} oleh{' '}
                        {dispute.filedBy === 'customer' ? 'customer' : 'merchant'} · 1× per order.
                      </p>
                      {resolutionToken ? (
                        <p className="track-row-meta">
                          Order {resolutionToken} ·{' '}
                          {RESOLUTIONS.find((r) => r.id === dispute.resolution)?.label}
                          {dispute.partialPercent ? ` (${dispute.partialPercent}%)` : ''}
                        </p>
                      ) : (
                        <p className="track-row-meta">
                          Hold dibekukan sampai panel CS memutuskan.
                        </p>
                      )}
                      {appeal ? (
                        <p className="track-row-meta">
                          {appealDecided
                            ? `Banding ditinjau SA: ${
                                appeal.verdict === 'upheld'
                                  ? 'putusan CS diperkuat'
                                  : 'putusan diubah'
                              }`
                            : 'Banding menunggu tinjauan SA.'}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="track-row-name">Pesanan tidak sesuai?</p>
                      <p className="track-row-note">
                        1× per order, window {DISPUTE_WINDOW_HOURS} jam setelah pesanan selesai.
                      </p>
                    </>
                  )}
                </div>
                {!dispute ? (
                  <div className="track-actions">
                    <button
                      className="track-action"
                      type="button"
                      disabled={!disputeWindowOpen}
                      onClick={() => navigate(`/dispute?order=${mockOrder.code}&by=customer`)}
                    >
                      <IconScale />
                      {disputeWindowOpen ? 'Ajukan' : 'Window lewat'}
                    </button>
                  </div>
                ) : null}
                {canAppeal ? (
                  <div className="track-actions">
                    <button
                      className="track-action"
                      type="button"
                      onClick={() => setAppealOpen(true)}
                    >
                      <IconScale />
                      Banding
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}
        </div>
      </main>

      <BottomSheet
        open={appealOpen}
        title="Ajukan banding ke Super Admin"
        onClose={() => setAppealOpen(false)}
      >
        <p className="sheet-field-label">
          Putusan level-1 CS tetap berlaku sampai SA memutuskan.
        </p>
        <textarea
          className="sheet-textarea"
          value={appealNote}
          onChange={(event) => setAppealNote(event.target.value)}
          placeholder="Kenapa putusan ini perlu ditinjau ulang?"
          rows={3}
          aria-label="Alasan banding"
        />
        <div className="sheet-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              if (!dispute) return
              dispatch(requestAppeal({ id: dispute.id, note: appealNote }))
              toast.success('Banding dikirim ke Super Admin')
              setAppealNote('')
              setAppealOpen(false)
            }}
          >
            Kirim banding
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
