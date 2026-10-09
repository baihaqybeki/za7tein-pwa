import { zodResolver } from '@hookform/resolvers/zod'
import { Clock, CreditCard, Globe, ImagePlus, LocateFixed, MapPin, Store, Trash2, Wallet } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

import { MerchantBottomNav } from '../components/layout/MerchantBottomNav'
import { MerchantPageHeader } from '../components/merchant/MerchantPageHeader'
import { ConfirmSheet } from '../components/ui/ConfirmSheet'
import { InstallAppCard } from '../components/ui/InstallAppCard'
import { useLeafletMap } from '../hooks/useLeafletMap'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { money } from '../data/currency'
import { mockMerchant } from '../data/merchant'
import { imageFileError } from '../lib/image'
import { merchantStoreSchema, type MerchantStoreFormData } from '../lib/schemas'
import { logout } from '../store/slices/authSlice'
import {
  removeMerchantLogo,
  setMerchantLogo,
  setStoreProfile,
  setStoreDetails,
} from '../store/slices/merchantSlice'

const TIER_LABEL: Record<string, string> = { free: 'Gratis', pro: 'Pro' }

export default function MerchantSettings() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [coords, setCoords] = useState({ lat: mockMerchant.lat, lng: mockMerchant.lng })
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [removePhotoOpen, setRemovePhotoOpen] = useState(false)

  const logo = useAppSelector((state) => state.merchant.logo)
  const storeName = useAppSelector((state) => state.merchant.storeName)
  const storePhone = useAppSelector((state) => state.merchant.storePhone)
  const storeAddress = useAppSelector((state) => state.merchant.storeAddress)
  const storeOpenTime = useAppSelector((state) => state.merchant.storeOpenTime)
  const storeCloseTime = useAppSelector((state) => state.merchant.storeCloseTime)
  const [hours, setHours] = useState({ open: storeOpenTime, close: storeCloseTime })
  const walletBalance = useAppSelector((state) => state.payout.balance)
  const primaryAccount = useAppSelector(
    (state) => state.payout.accounts.find((a) => a.isPrimary) ?? state.payout.accounts[0],
  )
  const logoInputRef = useRef<HTMLInputElement>(null)
  // URL objek yang sedang dipakai; dilepas saat diganti / dihapus / unmount
  // supaya blob tidak menumpuk.
  const logoUrlRef = useRef<string | null>(null)
  useEffect(() => () => { if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current) }, [])

  // Pratinjau lokal dari berkas yang dipilih. Tidak ada unggahan sungguhan —
  // repo ini front-end saja (AGENTS.md §1).
  const onLogoPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const error = imageFileError(file)
    if (error) {
      toast.error(error)
      event.target.value = ''
      return
    }
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current)
    const url = URL.createObjectURL(file)
    logoUrlRef.current = url
    dispatch(setMerchantLogo(url))
    toast.success('Foto toko diperbarui')
  }

  const onLogoRemove = () => {
    if (logoUrlRef.current) {
      URL.revokeObjectURL(logoUrlRef.current)
      logoUrlRef.current = null
    }
    dispatch(removeMerchantLogo())
    toast.success('Foto toko dihapus')
  }

  const { setPosition } = useLeafletMap('merchant-map', 'picker', {
    picker: {
      initial: [mockMerchant.lat, mockMerchant.lng],
      onMove: (lat, lng) => setCoords({ lat, lng }),
    },
  })

  const locateMe = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung lokasi')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords
        setPosition(latitude, longitude)
        toast.success('Lokasi saat ini dipakai')
      },
      () => toast.error('Akses lokasi ditolak — geser pin saja'),
      { enableHighAccuracy: true },
    )
  }

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MerchantStoreFormData>({
    resolver: zodResolver(merchantStoreSchema),
    defaultValues: { name: storeName, phone: storePhone, address: storeAddress },
  })

  // Simpan benar-benar mengubah state, bukan cuma toast "berhasil" (dulu form
  // ini menampilkan sukses padahal tak ada satu pun nilai yang berubah).
  const onSubmit = (data: MerchantStoreFormData) => {
    dispatch(setStoreProfile(data))
    dispatch(setStoreDetails({ openTime: hours.open, closeTime: hours.close, lat: coords.lat, lng: coords.lng }))
    toast.success('Setelan toko disimpan')
  }

  // Keluar = keluar dari akun toko lalu kembali ke layar masuk merchant.
  // Tombol ini sebelumnya tidak punya handler sama sekali: bisa ditekan, tidak
  // melakukan apa pun (kontrol mati, senior-fe HG-06). Pola yang dipakai sama
  // dengan `Profile.tsx` — `logout()` dari authSlice, bukan state lokal baru.
  // Konfirmasi lewat BottomSheet karena ini aksi yang membuang sesi, dan
  // akibatnya ditulis apa adanya supaya tidak mengejutkan.
  const confirmSignOut = () => {
    dispatch(logout())
    setSignOutOpen(false)
    toast.success('Kamu sudah keluar dari akun toko')
    navigate('/signin')
  }

  return (
    <div className="app-shell">
      <main className="merchant-page">
        <MerchantPageHeader eyebrow="Profil & operasional" title="Setelan toko" />

        {/* Foto toko (field D1, f16). Unggah/Ganti/Hapus ditangani di sini dan
            langsung tersimpan ke store — tidak menunggu tombol simpan form teks. */}
        <section className="merchant-card">
          <p className="merchant-card-title">Foto toko</p>
          <p className="merchant-card-sub">Tampil sebagai identitas toko di halaman pelanggan.</p>
          <div className="merchant-image-field">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="d-none"
              onChange={onLogoPick}
            />
            {logo ? (
              <img className="merchant-form-thumb" src={logo} alt="Foto toko" width={64} height={64} />
            ) : (
              <span className="merchant-logo-empty" aria-hidden="true">
                <Store size={24} strokeWidth={1.75} />
              </span>
            )}
            <button
              type="button"
              className="merchant-btn-ghost"
              onClick={() => logoInputRef.current?.click()}
            >
              <ImagePlus size={16} strokeWidth={1.75} />
              {logo ? 'Ganti foto' : 'Unggah foto'}
            </button>
          </div>
          {logo ? (
            <button
              type="button"
              className="merchant-btn-ghost merchant-signout"
              onClick={() => setRemovePhotoOpen(true)}
            >
              <Trash2 size={16} strokeWidth={1.75} />
              Hapus foto
            </button>
          ) : null}
        </section>

        <form className="merchant-card merchant-form" noValidate onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Nama toko
            </label>
            <input
              id="name"
              className={`form-control${errors.name ? ' error' : ''}`}
              {...register('name')}
            />
            {errors.name ? <span className="error-message">{errors.name.message}</span> : null}
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              Nomor HP
            </label>
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              className={`form-control${errors.phone ? ' error' : ''}`}
              {...register('phone')}
            />
            {errors.phone ? <span className="error-message">{errors.phone.message}</span> : null}
          </div>

          <div className="form-group">
            <label htmlFor="address" className="form-label">
              Alamat toko
            </label>
            <input
              id="address"
              className={`form-control${errors.address ? ' error' : ''}`}
              {...register('address')}
            />
            {errors.address ? (
              <span className="error-message">{errors.address.message}</span>
            ) : null}
          </div>

          <div id="merchant-map" className="merchant-map merchant-map--picker" aria-label="Pilih lokasi toko" />
          <p className="merchant-map-hint">Geser pin oranye untuk memilih titik lokasi toko.</p>
          <button type="button" className="merchant-locate" onClick={locateMe}>
            <LocateFixed size={16} strokeWidth={1.75} />
            Pakai lokasi saat ini
          </button>

          <button type="submit" className="btn btn-primary btn-auth" disabled={isSubmitting}>
            Simpan perubahan
          </button>
        </form>

        <section className="merchant-card">
          <div className="merchant-row">
            <MapPin size={20} strokeWidth={1.75} />
            <div>
              <p className="merchant-card-title">Koordinat</p>
              <p className="merchant-card-sub">
                {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            </div>
          </div>
        </section>

        <section className="merchant-card">
          <div className="merchant-row">
            <Clock size={20} strokeWidth={1.75} />
            <div>
              <p className="merchant-card-title">Jam operasional</p>
              <p className="merchant-card-sub">Ubah lalu Simpan perubahan di form atas.</p>
            </div>
          </div>
          <div className="merchant-hours">
            <label className="form-group">
              <span className="form-label">Buka</span>
              <input type="time" className="form-control" value={hours.open} onChange={(e) => setHours((h) => ({ ...h, open: e.target.value }))} />
            </label>
            <label className="form-group">
              <span className="form-label">Tutup</span>
              <input type="time" className="form-control" value={hours.close} onChange={(e) => setHours((h) => ({ ...h, close: e.target.value }))} />
            </label>
          </div>
        </section>

        <section className="merchant-card">
          <div className="merchant-row">
            <Globe size={20} strokeWidth={1.75} />
            <div>
              <p className="merchant-card-title">Paket {TIER_LABEL[mockMerchant.tier]}</p>
              <p className="merchant-card-sub">{mockMerchant.dailyLimit} order / hari</p>
            </div>
          </div>
        </section>

        <section className="merchant-card">
          <div className="merchant-row">
            <Wallet size={20} strokeWidth={1.75} />
            <div>
              <p className="merchant-card-title">Saldo &amp; pencairan</p>
              <p className="merchant-card-sub">{money(walletBalance.available)}</p>
            </div>
          </div>
          <Link className="merchant-btn-ghost merchant-wallet-manage" to="/wallet">
            Buka dompet
          </Link>
        </section>

        <section className="merchant-card">
          <div className="merchant-row">
            <CreditCard size={20} strokeWidth={1.75} />
            <div>
              <p className="merchant-card-title">Rekening pencairan</p>
              <p className="merchant-card-sub">
                {primaryAccount
                  ? `${primaryAccount.bankName} · ${primaryAccount.accountNumber}`
                  : 'Belum ada rekening tujuan'}
              </p>
              <p className="merchant-card-sub">
                {primaryAccount ? `a.n. ${primaryAccount.holderName}` : 'Tambahkan rekening dulu'}
              </p>
            </div>
          </div>
          <Link className="merchant-btn-ghost merchant-wallet-manage" to="/payout-accounts">
            Kelola rekening
          </Link>
        </section>

        <InstallAppCard />

        <button
          type="button"
          className="merchant-btn-ghost merchant-signout"
          onClick={() => setSignOutOpen(true)}
        >
          Keluar
        </button>

        <ConfirmSheet
          open={signOutOpen}
          title="Keluar dari akun toko?"
          body="Pesanan yang sedang berjalan tetap ada, tapi kamu harus masuk lagi untuk mengelolanya."
          confirmLabel="Keluar"
          onConfirm={confirmSignOut}
          onClose={() => setSignOutOpen(false)}
        />

        <ConfirmSheet
          open={removePhotoOpen}
          title="Hapus foto toko?"
          body="Foto toko kembali ke placeholder. Kamu bisa mengunggahnya lagi kapan saja."
          confirmLabel="Hapus foto"
          onConfirm={() => {
            onLogoRemove()
            setRemovePhotoOpen(false)
          }}
          onClose={() => setRemovePhotoOpen(false)}
        />
      </main>
      <MerchantBottomNav />
    </div>
  )
}
