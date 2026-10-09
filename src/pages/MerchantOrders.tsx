import { useState } from 'react'
import { Check, ChevronRight, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link, useSearchParams } from 'react-router-dom'

import { MerchantBottomNav } from '../components/layout/MerchantBottomNav'
import { MerchantPageHeader } from '../components/merchant/MerchantPageHeader'
import { JourneyLine } from '../components/JourneyLine'
import { BottomSheet } from '../components/ui/BottomSheet'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { BATCH_STATUS_LABEL } from '../data/batches'
import { COURIER_STATUS_LABEL } from '../data/courier'
import { HOLD_STATUS_COPY, formatDistance, money, zoneLabel } from '../data/merchant'
import { QUEUE_TABS, ordersForStatuses, orderStatusLabel, type QueueTabId } from '../data/merchantOrders'
import {
  addOrderToBatch,
  assignBatchCourier,
  assignCourier,
  closeBatch,
  setCookMinutes,
  setOrderStatus,
  startBatchDelivery,
} from '../store/slices/merchantSlice'
import type { MerchantOrderStatus, OrderStage } from '../types'

/**
 * Status order merchant → tahap Journey Line.
 *
 * `MerchantOrderStatus` lebih lebar dari `OrderStage`: `masuk` belum masuk rel,
 * dan `selesai`/`ditolak`/`batal` sudah keluar dari rel. Pemetaannya eksplisit
 * (bukan cast) supaya menambah status baru memaksa keputusan di sini, bukan
 * diam-diam salah render.
 */
const JOURNEY_STAGE: Partial<Record<MerchantOrderStatus, OrderStage>> = {
  diterima: 'diterima',
  dimasak: 'dimasak',
  diantar: 'diantar',
  tiba: 'tiba',
  selesai: 'tiba',
}

/* Estimasi masak sebagai pilihan tetap, bukan slider. Slider adalah kontrol
   desktop (tarik presisi) dan di ponsel terasa seperti form web; segmented
   control adalah pola native untuk rentang kecil yang diskret. */
const COOK_OPTIONS = [15, 25, 35] as const
const DEFAULT_COOK_MINUTES = 25

export default function MerchantOrders() {
  const dispatch = useAppDispatch()
  const orders = useAppSelector((s) => s.merchant.orders)
  const couriers = useAppSelector((s) => s.merchant.couriers)
  const batches = useAppSelector((s) => s.merchant.batches)
  const [params] = useSearchParams()
  /* Tab awal bisa datang dari tautan (?tab=batal), dipakai legenda donut di
     dashboard: potongan "Batal/tolak 1 order" harus mendarat di daftar yang
     benar-benar berisi order batal, bukan di tab pertama. Nilai yang tidak
     dikenal jatuh ke tab pertama supaya tautan lama tidak membuat layar kosong. */
  const [tab, setTab] = useState<QueueTabId>(() => {
    const dariTautan = params.get('tab')
    return QUEUE_TABS.some((t) => t.id === dariTautan) ? (dariTautan as QueueTabId) : 'masuk'
  })
  const [detailId, setDetailId] = useState<string | null>(null)
  /* Konfirmasi 2-langkah: aksi yang keluar rel / menahan uang tidak boleh
     terjadi karena satu sentuhan salah (ConfirmSheet, pola yang sama dengan
     panel CS). Id disimpan, bukan objek, supaya tetap valid setelah re-render. */
  const [rejectId, setRejectId] = useState<string | null>(null)
  const [dispatchId, setDispatchId] = useState<string | null>(null)
  const [cancelId, setCancelId] = useState<string | null>(null)

  const activeTab = QUEUE_TABS.find((t) => t.id === tab) ?? QUEUE_TABS[0]
  const visible = ordersForStatuses(orders, activeTab.statuses)
  const detailOrder = orders.find((o) => o.id === detailId) ?? null
  const detailCourier = detailOrder ? couriers.find((c) => c.id === detailOrder.courierId) : undefined
  const codeOf = (id: string | null) => orders.find((o) => o.id === id)?.code ?? ''

  const receiveOrder = (id: string, code: string) => {
    dispatch(setOrderStatus({ id, status: 'diterima' }))
    // F12: order yang diterima masuk ke batch aktif (dibuat bila belum ada).
    dispatch(addOrderToBatch({ orderId: id }))
    toast.success(`Order ${code} diterima — masuk batch`)
  }

  const confirmReject = () => {
    if (!rejectId) return
    const order = orders.find((o) => o.id === rejectId)
    dispatch(setOrderStatus({ id: rejectId, status: 'ditolak' }))
    toast.success(`Order ${order?.code ?? ''} ditolak`)
    setRejectId(null)
  }

  const confirmDispatch = () => {
    if (!dispatchId) return
    const order = orders.find((o) => o.id === dispatchId)
    dispatch(setOrderStatus({ id: dispatchId, status: 'diantar' }))
    toast.success(`Order ${order?.code ?? ''} siap dan diserahkan ke kurir`)
    setDispatchId(null)
  }

  const confirmCancel = () => {
    if (!cancelId) return
    const order = orders.find((o) => o.id === cancelId)
    dispatch(setOrderStatus({ id: cancelId, status: 'batal' }))
    toast.success(`Order ${order?.code ?? ''} dibatalkan — dana hold dikembalikan`)
    setCancelId(null)
  }

  /* Ringkasan item untuk baris antrean: satu baris, dipotong dengan elipsis.
     Daftar lengkap dengan harga ada di sheet detail. */
  const itemSummary = (order: (typeof orders)[number]) =>
    order.items.map((item) => `${item.quantity}× ${item.name}`).join(', ')

  return (
    <div className="app-shell">
      <main className="merchant-page">
        <MerchantPageHeader eyebrow="Antrean dapur" title="Order" />

        {batches.length > 0 ? (
          <section className="merchant-card">
            <div className="merchant-row">
              <div>
                <p className="merchant-card-title">Batch pengantaran</p>
                {batches.map((b) => (
                  <p key={b.id} className="merchant-card-sub">
                    {BATCH_STATUS_LABEL[b.status]} · {b.orderIds.length} order
                    {b.courierId
                      ? ` · ${couriers.find((c) => c.id === b.courierId)?.name ?? b.courierId}`
                      : ''}
                  </p>
                ))}
              </div>
            </div>
            <div className="merchant-actions">
              {batches.map((b) => (
                <span key={b.id} style={{ display: 'contents' }}>
                  {b.status === 'prepare' ? (
                    <button
                      type="button"
                      className="merchant-btn-ghost"
                      onClick={() => {
                        dispatch(closeBatch({ id: b.id }))
                        toast.success('Batch ditutup')
                      }}
                    >
                      Tutup batch
                    </button>
                  ) : null}
                  {b.status === 'waitingCourier' ? (
                    <button
                      type="button"
                      className="merchant-btn-ghost"
                      onClick={() => {
                        const c = couriers.find((x) => x.status !== 'offline') ?? couriers[0]
                        if (c) {
                          dispatch(assignBatchCourier({ batchId: b.id, courierId: c.id }))
                          toast.success(`Batch ditugaskan ke ${c.name}`)
                        }
                      }}
                    >
                      Assign kurir
                    </button>
                  ) : null}
                  {b.status === 'waitingDelivery' ? (
                    <button
                      type="button"
                      className="merchant-btn-ghost"
                      onClick={() => {
                        dispatch(startBatchDelivery({ id: b.id }))
                        toast.success('Batch mulai diantar')
                      }}
                    >
                      Mulai antar
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div className="merchant-tabs" role="tablist">
          {QUEUE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tab}
              className={`merchant-tab ${t.id === tab ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="merchant-tab-count">
                {ordersForStatuses(orders, t.statuses).length}
              </span>
            </button>
          ))}
        </div>

        {visible.length === 0 ? (
          <p className="merchant-empty">Belum ada order di tab ini.</p>
        ) : (
          visible.map((order) => {
            return (
              <article key={order.id} className="merchant-order-card">
                {/* Baris antrean: satu baris yang dipindai cepat, bukan satu
                    layar. Detail lengkap (journey, item, alamat) ada di sheet. */}
                <button
                  type="button"
                  className="merchant-order-row"
                  onClick={() => setDetailId(order.id)}
                >
                  <img
                    className="merchant-buyer-avatar"
                    src={order.buyerAvatar}
                    alt={`Profil ${order.customerName}`}
                    width={40}
                    height={40}
                  />
                  <span className="merchant-order-row-body">
                    <span className="merchant-order-code">{order.code}</span>
                    <span className="merchant-order-sub">
                      {order.customerName} · {order.placedAt}
                    </span>
                    <span className="merchant-order-row-items">{itemSummary(order)}</span>
                  </span>
                  <span className="merchant-order-row-end">
                    <span className={`merchant-badge merchant-badge-${order.status}`}>
                      {orderStatusLabel(order.status)}
                    </span>
                    <span className="merchant-order-row-total">{money(order.total)}</span>
                  </span>
                  <ChevronRight
                    size={18}
                    strokeWidth={1.75}
                    className="merchant-order-row-chevron"
                    aria-hidden="true"
                  />
                </button>

                {order.status === 'masuk' ? (
                  <div className="merchant-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => receiveOrder(order.id, order.code)}
                    >
                      Terima
                    </button>
                    <button
                      type="button"
                      className="merchant-btn-ghost"
                      onClick={() => setRejectId(order.id)}
                    >
                      Tolak
                    </button>
                  </div>
                ) : null}
              </article>
            )
          })
        )}
      </main>

      <BottomSheet
        open={detailOrder !== null}
        title={detailOrder ? `Pesanan ${detailOrder.code}` : ''}
        onClose={() => setDetailId(null)}
      >
        {detailOrder ? (
          <>
            <div className="merchant-order-head">
              <div className="merchant-order-buyer">
                <img
                  className="merchant-buyer-avatar"
                  src={detailOrder.buyerAvatar}
                  alt={`Profil ${detailOrder.customerName}`}
                  width={40}
                  height={40}
                />
                <div>
                  <p className="merchant-order-code">{detailOrder.code}</p>
                  <p className="merchant-order-sub">
                    {detailOrder.customerName} · {detailOrder.placedAt}
                  </p>
                </div>
              </div>
              <div className="merchant-order-head-right">
                <div
                  className="merchant-order-rating"
                  aria-label={`Rating pembeli ${detailOrder.buyerRating} dari 5`}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={12}
                      strokeWidth={1.75}
                      color="var(--star)"
                      fill={i < detailOrder.buyerRating ? 'var(--star)' : 'none'}
                    />
                  ))}
                </div>
                <span className={`merchant-badge merchant-badge-${detailOrder.status}`}>
                  {orderStatusLabel(detailOrder.status)}
                </span>
              </div>
            </div>

            {/* Journey Line: komponen yang sama dengan layar customer dan tugas
                kurir — status pesanan tetap satu model lintas peran
                (AGENTS.md §9: turunkan, jangan gambar ulang). Order `masuk`
                belum punya tahap, dan order ditolak/batal sudah keluar dari
                rel, jadi keduanya tidak menampilkan journey. */}
            {JOURNEY_STAGE[detailOrder.status] ? (
              <JourneyLine stage={JOURNEY_STAGE[detailOrder.status] as OrderStage} />
            ) : null}

            <ul className="merchant-order-items">
              {detailOrder.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.quantity}× {item.name}
                  </span>
                  <span>{money(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>

            <p className="merchant-order-meta">
              {detailOrder.address} · {formatDistance(detailOrder.distanceMeters)} · Zona{' '}
              {zoneLabel(detailOrder.zone)} · {detailOrder.paymentMethod === 'cod' ? 'COD' : 'Transfer'}
            </p>
            <p className="merchant-order-total">Total {money(detailOrder.total)}</p>

            {detailOrder.status === 'masuk' ? (
              <div className="merchant-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => receiveOrder(detailOrder.id, detailOrder.code)}
                >
                  Terima
                </button>
                <button
                  type="button"
                  className="merchant-btn-ghost"
                  onClick={() => {
                    setDetailId(null)
                    setRejectId(detailOrder.id)
                  }}
                >
                  Tolak
                </button>
              </div>
            ) : null}

            {detailOrder.status === 'diterima' || detailOrder.status === 'dimasak' ? (
              <div className="merchant-cook">
                <div className="merchant-cook-head">
                  <span>Estimasi masak</span>
                  <strong>{detailOrder.cookMinutes ?? DEFAULT_COOK_MINUTES} menit</strong>
                </div>
                <div
                  className="merchant-cook-segments"
                  role="group"
                  aria-label={`Estimasi masak ${detailOrder.code}`}
                >
                  {COOK_OPTIONS.map((minutes) => {
                    const active = (detailOrder.cookMinutes ?? DEFAULT_COOK_MINUTES) === minutes
                    return (
                      <button
                        key={minutes}
                        type="button"
                        className={active ? 'is-active' : ''}
                        aria-pressed={active}
                        onClick={() => dispatch(setCookMinutes({ id: detailOrder.id, minutes }))}
                      >
                        {minutes}
                      </button>
                    )
                  })}
                </div>

                <div className="merchant-assign">
                  <span className="merchant-assign-label">Kurir</span>
                  <div className="sheet-menu">
                    {couriers.map((item) => {
                      const selected = detailOrder.courierId === item.id
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`sheet-menu__item${selected ? ' is-selected' : ''}`}
                          aria-current={selected}
                          onClick={() =>
                            dispatch(assignCourier({ orderId: detailOrder.id, courierId: item.id }))
                          }
                        >
                          <span>{item.name}</span>
                          <span className="sheet-menu__note">
                            {COURIER_STATUS_LABEL[item.status] ?? item.status}
                          </span>
                          {selected ? <Check size={18} strokeWidth={1.75} aria-hidden="true" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <p className="merchant-card-sub">
                  {detailCourier
                    ? `Hold ${HOLD_STATUS_COPY.cut.label}: potongan dikunci sampai OTP`
                    : HOLD_STATUS_COPY.held.note}
                </p>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setDetailId(null)
                    setDispatchId(detailOrder.id)
                  }}
                >
                  Siap diantar
                </button>

                <button
                  type="button"
                  className="merchant-btn-ghost merchant-signout"
                  onClick={() => {
                    setDetailId(null)
                    setCancelId(detailOrder.id)
                  }}
                >
                  Batalkan pesanan
                </button>
              </div>
            ) : null}

            {/* Lane guard (f12): order yang sudah di jalan bisa macet. Merchant
                hanya punya dua jalan keluar — ganti kurir (di blok cook) atau
                batalkan dan kembalikan dana hold. */}
            {detailOrder.status === 'diantar' ? (
              <button
                type="button"
                className="merchant-btn-ghost merchant-signout"
                onClick={() => {
                  setDetailId(null)
                  setCancelId(detailOrder.id)
                }}
              >
                Batalkan pesanan
              </button>
            ) : null}

            {detailOrder.status === 'selesai' ? (
              <div className="merchant-actions">
                <Link
                  className="merchant-btn-ghost"
                  to={`/dispute?order=${detailOrder.code}&by=merchant`}
                  onClick={() => setDetailId(null)}
                >
                  Ajukan Sengketa
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </BottomSheet>

      {/* Konfirmasi 2-langkah untuk aksi yang keluar rel atau menahan uang. */}
      <ConfirmSheet
        open={rejectId !== null}
        title="Tolak pesanan?"
        body={`Pesanan ${codeOf(rejectId)} keluar dari antrean dan tidak bisa dikembalikan dari halaman ini.`}
        confirmLabel="Tolak pesanan"
        onConfirm={confirmReject}
        onClose={() => setRejectId(null)}
      />

      <ConfirmSheet
        open={dispatchId !== null}
        title="Serahkan ke kurir?"
        body={`Pesanan ${codeOf(dispatchId)} ditandai siap diantar. Kurir menerima tugas dan pelanggan melihat statusnya berjalan.`}
        confirmLabel="Siap diantar"
        onConfirm={confirmDispatch}
        onClose={() => setDispatchId(null)}
      />

      <ConfirmSheet
        open={cancelId !== null}
        title="Batalkan pesanan?"
        body={`Pesanan ${codeOf(cancelId)} dibatalkan dan dana hold dikembalikan ke pelanggan. Kamu tidak menerima pembayaran untuk order ini.`}
        confirmLabel="Batalkan & refund"
        onConfirm={confirmCancel}
        onClose={() => setCancelId(null)}
      />

      <MerchantBottomNav />
    </div>
  )
}
