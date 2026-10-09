import { Bike, Landmark, Store, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

import { CourierPageHeader } from '../components/courier/CourierPageHeader'
import { CourierBottomNav } from '../components/layout/CourierBottomNav'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { InstallAppCard } from '../components/ui/InstallAppCard'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { money, mockMerchant } from '../data/merchant'
import { courierSelf, isActiveTask } from '../data/courier'
import { courierTipsAvailable } from '../data/courierWallet'
import { toggleOnline, updateCourierProfile } from '../store/slices/courierSlice'
import { logout } from '../store/slices/authSlice'

export default function CourierProfile() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const isOnline = useAppSelector((s) => s.courier.isOnline)
  const tasks = useAppSelector((s) => s.courier.tasks)
  const payouts = useAppSelector((s) => s.courier.payouts)
  const onboarding = useAppSelector((s) => s.courier.onboarding)
  const tipsAvailable = courierTipsAvailable(tasks, payouts)
  const active = tasks.filter(isActiveTask).length
  const [showLogout, setShowLogout] = useState(false)

  // Profil dari onboarding kurir menang atas data contoh, supaya isian
  // pengguna benar-benar terpakai (bukan form mati).
  const name = onboarding?.name || courierSelf.name
  const phone = onboarding?.phone || courierSelf.phone
  const vehicleLabel = onboarding?.vehicle === 'mobil' ? 'Mobil' : 'Motor'
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ name, phone, vehicle: (onboarding?.vehicle ?? 'motor') as 'motor' | 'mobil' })

  // Keluar = keluar dari akun lalu kembali ke layar masuk kurir. Memakai
  // `logout()` dari authSlice, sama seperti Profil customer dan Setelan merchant,
  // bukan state lokal baru.
  const handleLogout = () => {
    dispatch(logout())
    setShowLogout(false)
    navigate('/signin')
  }

  return (
    <div className="app-shell">
      <main className="courier-page">
        <CourierPageHeader eyebrow="Akun" title="Profil" />

        <section className="courier-card courier-identity">
          <span className="courier-avatar" aria-hidden="true">
            <UserRound size={28} strokeWidth={1.75} />
          </span>
          {editing ? (
            <div className="form-group">
              <label className="form-group">
                <span className="form-label">Nama</span>
                <input className="form-control" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">Nomor WA</span>
                <input className="form-control" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </label>
              <label className="form-group">
                <span className="form-label">Kendaraan</span>
                <select className="form-control" value={form.vehicle} onChange={(e) => setForm((f) => ({ ...f, vehicle: e.target.value as 'motor' | 'mobil' }))}>
                  <option value="motor">Motor</option>
                  <option value="mobil">Mobil</option>
                </select>
              </label>
              <div className="courier-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    dispatch(updateCourierProfile({ name: form.name, phone: form.phone, vehicle: form.vehicle }))
                    setEditing(false)
                    toast.success('Profil kurir disimpan')
                  }}
                >
                  Simpan
                </button>
                <button type="button" className="courier-btn-ghost" onClick={() => setEditing(false)}>Batal</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="courier-card-title">{name}</p>
              <p className="courier-card-sub">{phone}</p>
              <p className="courier-card-sub">Kendaraan: {vehicleLabel}</p>
              <button type="button" className="courier-btn-ghost" onClick={() => setEditing(true)}>Edit profil</button>
            </div>
          )}
        </section>

        <section className="courier-card">
          <div className="courier-row">
            <Bike size={20} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="courier-card-title">
                {isOnline ? 'Siap menerima tugas' : 'Sedang tidak siap'}
              </p>
              <p className="courier-card-sub">{active} tugas berjalan</p>
            </div>
          </div>
          <button
            type="button"
            className={`courier-toggle ${isOnline ? 'is-on' : ''}`}
            onClick={() => dispatch(toggleOnline())}
          >
            {isOnline ? 'Jeda dulu' : 'Siap sekarang'}
          </button>
        </section>

        <section className="courier-card">
          <div className="courier-row">
            <Landmark size={20} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="courier-card-title">Dompet tips</p>
              <p className="courier-card-sub">{money(tipsAvailable)} bisa ditarik</p>
            </div>
          </div>
          <Link className="btn btn-primary courier-wallet-cta" to="/wallet">
            Buka dompet
          </Link>
        </section>

        <section className="courier-card">
          <div className="courier-row">
            <Store size={20} strokeWidth={1.75} aria-hidden="true" />
            <div>
              <p className="courier-card-title">{mockMerchant.name}</p>
              <p className="courier-card-sub">
                Buka {mockMerchant.openTime}–{mockMerchant.closeTime}
              </p>
            </div>
          </div>
          <p className="courier-task-meta">
            Kurir toko ini eksklusif milik satu merchant (PRD bab 04).
          </p>
        </section>

        <InstallAppCard />

        <div className="courier-logout">
          <button type="button" className="btn-logout" onClick={() => setShowLogout(true)}>
            Keluar
          </button>
        </div>

        <p className="courier-note">
          Kurir masuk dengan nomor WA (E.164), dasar flow f21-account-auth + f16: kurir karyawan
          merchant yang direkrut setelah toko aktif (C-06). Sesi masih mock, repo ini front-end
          saja (AGENTS.md §1).
        </p>

        <ConfirmSheet
          open={showLogout}
          title="Keluar dari akun kurir?"
          body="Kamu kembali ke layar masuk. Tugas yang sedang berjalan tetap tersimpan di perangkat."
          confirmLabel="Keluar"
          confirmClass="courier-btn-ghost"
          onConfirm={handleLogout}
          onClose={() => setShowLogout(false)}
        />
      </main>
      <CourierBottomNav />
    </div>
  )
}
