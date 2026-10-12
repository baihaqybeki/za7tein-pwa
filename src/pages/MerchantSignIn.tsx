import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Link, useNavigate } from 'react-router-dom'

import { signInWithPassword } from '../api/auth'
import { isBackendConfigured } from '../api/config'
import { AuthLayout } from '../components/ui/AuthLayout'
import { AUTH_PHOTO, AUTH_ROLE_LABEL } from '../data/auth'
import { useAppDispatch } from '../hooks/useAppStore'
import { merchantSignInSchema, type MerchantSignInFormData } from '../lib/schemas'
import { signIn } from '../store/slices/authSlice'

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
    // Bila backend dikonfigurasi, autentikasi nyata ke Supabase Auth.
    if (isBackendConfigured) {
      const session = await signInWithPassword(data.email, data.password)
      if (!session) {
        toast.error('Email atau kata sandi salah')
        return
      }
      dispatch(signIn('/merchant'))
      toast.success('Masuk sebagai merchant (Supabase Auth)')
      navigate('/')
      return
    }
    // Mode demo (tanpa env backend).
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
