import { ChevronLeft, MapPin, Phone } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate, useParams } from 'react-router-dom'

import { JourneyLine } from '../components/JourneyLine'
import { DeliveryActionCard, DeliveryStepper } from '../components/DeliveryCheckpoints'
import { CourierPageHeader } from '../components/courier/CourierPageHeader'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { useTick } from '../hooks/useTick'
import { formatDistance, money, zoneLabel } from '../data/merchant'
import {
  COURIER_ACTION_LABEL,
  COURIER_GUARD_MINUTES,
  elapsedMinutes,
} from '../data/courier'
import { advanceCheckpoint, cancelTask, completeTask } from '../store/slices/courierSlice'

export default function CourierTaskDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const tasks = useAppSelector((s) => s.courier.tasks)
  const { now } = useTick()
  const [otp, setOtp] = useState('')

  const task = tasks.find((t) => t.id === id)

  if (!task) {
    return (
      <div className="app-shell">
        <main className="courier-page">
          <CourierPageHeader title="Tugas tidak ditemukan" eyebrow="Detail tugas" />
          <p className="courier-empty">Tugas ini tidak ada di daftar kurir.</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/')}>
            Kembali ke daftar tugas
          </button>
        </main>
      </div>
    )
  }

  const actionLabel = COURIER_ACTION_LABEL[task.checkpoint]
  const elapsed = elapsedMinutes(task, now)
  const isGuard = task.checkpoint === 'tiba'
  const canCall = isGuard && elapsed >= COURIER_GUARD_MINUTES.call
  const canCancel = isGuard && elapsed >= COURIER_GUARD_MINUTES.batal
  const isFinished = task.checkpoint === 'selesai'
  const isCancelled = task.checkpoint === 'batal'

  // Tanpa OTP yang benar kurir tidak bisa settle (C-09) — validator ada di layar,
  // reducer hanya menyelesaikan setelah kode cocok.
  function submitOtp() {
    if (!task) return
    if (otp !== task.otp) {
      toast.error('Kode OTP tidak cocok')
      return
    }
    dispatch(completeTask({ id: task.id }))
    toast.success('Pesanan selesai — hold settled')
  }

  // Maju satu checkpoint. Saat langkah berikutnya "Tiba", kirim satu notifikasi
  // ke kotak masuk customer (mock, R-PUSH-01): satu store, pola sama seperti
  // sengketa yang dibaca lintas peran. Web Push asli tetap di luar scope.
  function advance() {
    if (!task) return
    // Notifikasi journey (kurir berangkat/tiba ke customer, merchant) dipicu
    // terpusat oleh `journeyBridge` di store, bukan di sini.
    dispatch(advanceCheckpoint({ id: task.id }))
  }

  return (
    <div className="app-shell">
      <main className="courier-page">
        <CourierPageHeader
          eyebrow="Detail tugas"
          title={`#${task.code}`}
          action={
            <button
              className="courier-back"
              type="button"
              aria-label="Kembali"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          }
        />

        <section className="courier-card">
          <div className="courier-row">
            <MapPin size={20} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="courier-card-title">{task.customerName}</p>
              <p className="courier-card-sub">
                {task.address} · {task.floor} · {task.unit}
              </p>
            </div>
          </div>
          <p className="courier-task-meta">
            {formatDistance(task.distanceMeters)} · Zona {zoneLabel(task.zone)} ·{' '}
            {task.paymentMethod === 'cod' ? `COD ${money(task.total)}` : `Transfer ${money(task.total)}`}
          </p>
          <p className="courier-task-meta">
            {task.paymentMethod === 'cod'
              ? 'Tagih tunai ke customer saat serah terima.'
              : 'Cek bukti transfer customer sebelum serah terima.'}
          </p>
        </section>

        <section className="courier-section">
          <h2 className="courier-section-title">Status pesanan</h2>
          <JourneyLine stage={task.orderStage} />
        </section>

        <section className="courier-section">
          <h2 className="courier-section-title">Checkpoint</h2>
          <DeliveryStepper checkpoint={task.checkpoint} />
        </section>

        {/* Notif customer (flow F13: "Tiba → notif customer"). Web Push tidak
            diimplementasi di repo ini (AGENTS.md §1, R-PUSH-01), jadi ini bukti
            mock bahwa notifikasi terkirim saat kurir tiba dan saat selesai —
            bukan klaim pengiriman sungguhan (HG-12). */}
        {task.checkpoint === 'tiba' || task.checkpoint === 'selesai' ? (
          <p className="courier-notif">
            {task.checkpoint === 'tiba'
              ? `Notif "Kurir sudah sampai" terkirim ke ${task.customerName} (mock).`
              : `Notif "Pesanan selesai" terkirim ke ${task.customerName} (mock).`}
          </p>
        ) : null}

        {isFinished ? (
          <section className="courier-card courier-settled">
            <p className="courier-card-title">Pesanan selesai</p>
            <p className="courier-card-sub">
              OTP terverifikasi → hold settled. Tips kamu {money(task.tip)} masuk dompet.
            </p>
          </section>
        ) : isCancelled ? (
          <section className="courier-card courier-settled">
            <p className="courier-card-title">Tugas dibatalkan</p>
            <p className="courier-card-sub">
              Customer tidak menyerahkan OTP. Penalti customer belum final (UNRESOLVED OQ-14).
            </p>
          </section>
        ) : (
          <DeliveryActionCard
            checkpoint={task.checkpoint}
            startedAt={task.checkpointStartedAt ?? null}
            now={now}
            otp={otp}
            onOtpChange={setOtp}
            onOtpSubmit={submitOtp}
            otpHint={`Kode demo: ${task.otp}`}
            actions={
              <>
                {actionLabel ? (
                  <button
                    type="button"
                    className="btn btn-primary courier-primary"
                    onClick={advance}
                  >
                    {actionLabel}
                  </button>
                ) : null}

                {isGuard ? (
                  <div className="courier-guard">
                    <p className="courier-card-sub">
                      {canCall
                        ? 'Sudah lewat 5 menit — hubungi customer sekarang.'
                        : `Hubungi customer bila menunggu lebih dari ${COURIER_GUARD_MINUTES.call} menit.`}
                    </p>
                    <a className="courier-guard-call" href={`tel:${task.customerPhone}`}>
                      <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
                      Hubungi customer
                    </a>
                    <button
                      type="button"
                      className="courier-btn-ghost"
                      disabled={!canCancel}
                      onClick={() => dispatch(cancelTask({ id: task.id }))}
                    >
                      {canCancel
                        ? 'Batal — customer lalai'
                        : `Batal aktif setelah ${COURIER_GUARD_MINUTES.batal} menit`}
                    </button>
                  </div>
                ) : null}
              </>
            }
          />
        )}
      </main>
    </div>
  )
}
