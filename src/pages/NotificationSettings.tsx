import { ChevronLeft } from 'lucide-react'
// Preferensi notifikasi. Dipindah dari /notifications, karena rute itu
// seharusnya berarti kotak masuk — itulah yang dijanjikan tombol lonceng
// berbadge. Halaman ini yang ditautkan dari menu Profil.
import { useNavigate } from 'react-router-dom'

import toast from 'react-hot-toast'

import { NOTIFICATION_SOUNDS, PUSH_CONTRACT, mockPushSubscription } from '../data/notifications'
import { playNotificationSound } from '../lib/notificationSound'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { clearPush, registerPush, setSound, setSoundEnabled } from '../store/slices/notificationsSlice'


const TOGGLES = [
  { id: 'notifications', label: 'Notifikasi', on: true },
  { id: 'sound', label: 'Suara', on: false },
  { id: 'vibrate', label: 'Getar', on: false },
  { id: 'offers', label: 'Promo & Penawaran', on: true },
  { id: 'payments', label: 'Pembayaran', on: false },
  { id: 'cashback', label: 'Cashback', on: false },
  { id: 'updates', label: 'Pembaruan Aplikasi', on: true },
] as const

export default function NotificationSettings() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const subscription = useAppSelector((s) => s.notifications.subscription)
  const soundEnabled = useAppSelector((s) => s.notifications.soundEnabled)
  const sound = useAppSelector((s) => s.notifications.sound)

  return (
    <div className="app-shell">
      <main>
        <div className="profile-flow-page">
          <div className="profile-flow">
            <header className="profile-flow-header">
              <button
                type="button"
                className="back-btn-profile"
                aria-label="Kembali"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft size={24} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <h1 className="profile-flow-title">Pengaturan Notifikasi</h1>
            </header>

            <main className="profile-flow-main">
              <div className="notifications-list">
                {TOGGLES.map((t) => (
                  <div className="notification-row" key={t.id}>
                    <span className="notification-label">{t.label}</span>
                    <label className="toggle-wrap" htmlFor={`toggle-${t.id}`}>
                      <input
                        id={`toggle-${t.id}`}
                        className="toggle-input"
                        type="checkbox"
                        defaultChecked={t.on}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                ))}
              </div>

              {/* Push (M8). Yang disimulasikan hanya registrasinya: repo ini
                  tidak punya service worker push, jadi tidak ada notifikasi
                  yang benar-benar dikirim — kontraknya ditampilkan, bukan
                  dipura-pura jalan. */}
              <section className="admin-card" aria-label="Registrasi push">
                <p className="admin-card-title">Notifikasi push</p>
                {subscription ? (
                  <>
                    <p className="admin-card-sub">
                      Aktif · {subscription.platform} · kedaluwarsa{' '}
                      {new Date(subscription.expiresAt).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                    <p className="admin-note">Endpoint {subscription.endpoint}</p>
                    <p className="admin-note">
                      Keys {subscription.keys.p256dh} · {subscription.keys.auth}
                    </p>
                    <p className="admin-note">
                      Kontrak payload: maks {PUSH_CONTRACT.maxPayloadKb} KB, TTL wajib,{' '}
                      userVisibleOnly.
                    </p>
                    <button
                      type="button"
                      className="admin-btn-ghost"
                      onClick={() => {
                        dispatch(clearPush())
                        toast.success('Registrasi push dimatikan')
                      }}
                    >
                      Matikan push
                    </button>
                  </>
                ) : (
                  <>
                    <p className="admin-note">
                      Daftarkan perangkat untuk menerima update pesanan tanpa membuka aplikasi.
                      Mock: subscription disimpan di store; pengiriman push belum ada di repo ini.
                    </p>
                    <button
                      type="button"
                      className="btn-profile-primary"
                      onClick={() => {
                        dispatch(
                          registerPush({
                            subscription: mockPushSubscription(
                              navigator.userAgent.includes('Mobile') ? 'mobile-web' : 'web',
                            ),
                          }),
                        )
                        toast.success('Push terdaftar (mock)')
                      }}
                    >
                      Aktifkan push
                    </button>
                  </>
                )}
              </section>

              <section className="admin-card" aria-label="Suara notifikasi">
                <p className="admin-card-title">Suara notifikasi (audio push)</p>
                <div className="notification-row">
                  <span className="notification-label">Aktifkan suara</span>
                  <label className="toggle-wrap" htmlFor="toggle-sound-audio">
                    <input
                      id="toggle-sound-audio"
                      className="toggle-input"
                      type="checkbox"
                      checked={soundEnabled}
                      onChange={(e) => dispatch(setSoundEnabled(e.target.checked))}
                    />
                    <span className="toggle-slider" />
                  </label>
                </div>
                <div className="sound-picker" role="group" aria-label="Pilih nada">
                  {NOTIFICATION_SOUNDS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      className={`sound-chip ${sound === s.key ? 'is-active' : ''}`}
                      aria-pressed={sound === s.key}
                      onClick={() => {
                        dispatch(setSound(s.key))
                        playNotificationSound(s.key)
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="admin-btn-ghost"
                  disabled={!soundEnabled}
                  onClick={() => playNotificationSound(sound)}
                >
                  Coba suara
                </button>
              </section>

              <button
                type="button"
                className="btn-profile-primary"
                onClick={() => {
                  toast.success('Pengaturan disimpan')
                  navigate('/profile')
                }}
              >
                Simpan
              </button>
            </main>
          </div>
        </div>
      </main>
    </div>
  )
}
