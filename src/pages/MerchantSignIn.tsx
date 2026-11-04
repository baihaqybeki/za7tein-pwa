import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

import { signInWithPassword } from '../api/auth'
import { isBackendConfigured } from '../api/config'
import {
  clearCfToken,
  isWorkerConfigured,
  resolveSupabaseMerchant,
  resolveWorkerMerchant,
  workerSignIn,
} from '../api/merchantSession'
import { AuthLayout } from '../components/ui/AuthLayout'
import { AUTH_PHOTO, AUTH_ROLE_LABEL } from '../data/auth'
import { useAppDispatch } from '../hooks/useAppStore'
import { merchantSignInSchema, type MerchantSignInFormData } from '../lib/schemas'
import { signIn } from '../store/slices/authSlice'
import { setMerchantIdentity } from '../store/slices/merchantSlice'

export default function MerchantSignIn() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [showPassword, setShowPassword] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<MerchantSignInFormData>({ resolver: zodResolver(merchantSignInSchema) })

  const onSubmit = async (data: MerchantSignInFormData) => {
    // 1) Worker (Cloudflare): magic-link + resolve merchant milik akun.
    if (isWorkerConfigured()) {
      const ok = await workerSignIn(data.email)
      if (!ok) {
        toast.error('Gagal masuk. Periksa email merchant Anda.')
        return
      }
      const merchant = await resolveWorkerMerchant()
      if (!merchant) {
        clearCfToken()
        toast.error('Akun ini tidak terhubung ke merchant mana pun.')
        return
      }
      dispatch(
        setMerchantIdentity({
          id: merchant.id,
          name: merchant.store_name,
          phone: merchant.store_phone ?? undefined,
          address: merchant.store_address ?? undefined,
          photo: merchant.photo ?? undefined,
          lat: merchant.latitude ?? undefined,
          lng: merchant.longitude ?? undefined,
          openTime: merchant.open_time?.slice(0, 5),
          closeTime: merchant.close_time?.slice(0, 5),
        }),
      )
      dispatch(signIn('/merchant'))
      toast.success(`Masuk: ${merchant.store_name}`)
      navigate('/')
      return
    }
    // 2) Supabase (legacy): password + resolve merchant milik akun.
    if (isBackendConfigured) {
      const session = await signInWithPassword(data.email, data.password)
      if (!session) {
        toast.error('Email atau kata sandi salah')
        return
      }
      const merchant = await resolveSupabaseMerchant()
      if (!merchant) {
        toast.error('Akun ini tidak terhubung ke merchant mana pun.')
        return
      }
      dispatch(
        setMerchantIdentity({
          id: merchant.id,
          name: merchant.store_name,
          phone: merchant.store_phone ?? undefined,
          address: merchant.store_address ?? undefined,
          photo: merchant.photo ?? undefined,
          lat: merchant.latitude ?? undefined,
          lng: merchant.longitude ?? undefined,
          openTime: merchant.open_time?.slice(0, 5),
          closeTime: merchant.close_time?.slice(0, 5),
        }),
      )
      dispatch(signIn('/merchant'))
      toast.success(`Masuk: ${merchant.store_name}`)
      navigate('/')
      return
    }
    // 3) Mode demo (tanpa env backend).
    dispatch(signIn('/merchant'))
    toast.success('Mode demo: masuk sebagai merchant')
    navigate('/')
  }

  return (
    <AuthLayout
      photo={AUTH_PHOTO.merchant}
      role={AUTH_ROLE_LABEL.merchant}
      title="Masuk merchant"
      subtitle="Kelola order, menu, dan kurir tokomu dari satu tempat."
      tagline="Fee merchant 0,15 JOD per porsi, ongkir 100% merchant. Merchant baru dapat modal saldo 5 JOD, non-tunai dan tidak bisa ditarik."
    >
      <form className="auth-form" noValidate onSubmit={handleSubmit(onSubmit)}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            className={`auth-input${errors.email ? ' is-error' : ''}`}
            placeholder="toko@contoh.com"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            {...register('email')}
          />
          {errors.email ? (
            <span className="auth-error" role="alert">
              {errors.email.message}
            </span>
          ) : null}
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Kata sandi
          </label>
          <div className="auth-input-wrap">
            <input
              id="password"
              className={`auth-input${errors.password ? ' is-error' : ''}`}
              placeholder="Kata sandi akun toko"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              aria-invalid={errors.password ? true : undefined}
              {...register('password')}
            />
            <button
              type="button"
              className="auth-reveal"
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? <EyeOff size={20} strokeWidth={1.75} /> : <Eye size={20} strokeWidth={1.75} />}
            </button>
          </div>
          {errors.password ? (
            <span className="auth-error" role="alert">
              {errors.password.message}
            </span>
          ) : null}
        </div>

        <button type="submit" className="auth-submit" disabled={isSubmitting}>
          Masuk
        </button>
      </form>

      <p className="auth-switch">
        Belum punya akun toko? <Link to="/signup">Daftar</Link>
      </p>
    </AuthLayout>
  )
}
