import { Toaster } from 'react-hot-toast'
import { useEffect, type ComponentType, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'

import { StoreProvider } from './store/provider'
import { AppErrorBoundary } from './components/AppErrorBoundary'
import { PullToRefreshIndicator } from './components/layout/PullToRefreshIndicator'
import { InstallPromptSheet } from './components/ui/InstallPromptSheet'
import { useAppSelector } from './hooks/useAppStore'
import { usePageTransition } from './hooks/usePageTransition'

import AccountSetup from './pages/AccountSetup'
import AddNewCard from './pages/AddNewCard'
import AddProfilePhoto from './pages/AddProfilePhoto'
import AddressSelection from './pages/AddressSelection'
import AdminDashboard from './pages/AdminDashboard'
import AdminDisputes from './pages/AdminDisputes'
import AdminLedger from './pages/AdminLedger'
import AdminMerchants from './pages/AdminMerchants'
import AdminOnboarding from './pages/AdminOnboarding'
import ChangePassword from './pages/ChangePassword'
import Checkout from './pages/Checkout'
import CourierProfile from './pages/CourierProfile'
import CourierPayout from './pages/CourierPayout'
import CourierPayoutAccounts from './pages/CourierPayoutAccounts'
import CourierOnboarding from './pages/CourierOnboarding'
import CourierSignIn from './pages/CourierSignIn'
import CourierTaskDetail from './pages/CourierTaskDetail'
import CourierTasks from './pages/CourierTasks'
import CourierTips from './pages/CourierTips'
import CourierWallet from './pages/CourierWallet'
import CreatePassword from './pages/CreatePassword'
import CreatePin from './pages/CreatePin'
import DisputeSubmit from './pages/DisputeSubmit'
import Documentation from './pages/Documentation'
import Faq from './pages/Faq'
import Favorites from './pages/Favorites'
import Filter from './pages/Filter'
import ForgotPassword from './pages/ForgotPassword'
import ForgotPasswordOtp from './pages/ForgotPasswordOtp'
import HelpCenter from './pages/HelpCenter'
import Home from './pages/Home'
import Landing from './pages/Landing'
import Language from './pages/Language'
import MenuDetail from './pages/MenuDetail'
import MerchantProfile from './pages/MerchantProfile'
import MerchantCouriers from './pages/MerchantCouriers'
import MerchantDashboard from './pages/MerchantDashboard'
import MerchantMenu from './pages/MerchantMenu'
import MerchantOnboarding from './pages/MerchantOnboarding'
import MerchantOrders from './pages/MerchantOrders'
import MerchantPayout from './pages/MerchantPayout'
import MerchantPayoutAccounts from './pages/MerchantPayoutAccounts'
import MerchantPending from './pages/MerchantPending'
import MerchantRebate from './pages/MerchantRebate'
import MerchantReviews from './pages/MerchantReviews'
import MerchantSettings from './pages/MerchantSettings'
import MerchantSignIn from './pages/MerchantSignIn'
import MerchantSignUp from './pages/MerchantSignUp'
import MerchantWallet from './pages/MerchantWallet'
import NotificationSettings from './pages/NotificationSettings'
import Notifications from './pages/Notifications'
import Offline from './pages/Offline'
import Onboarding from './pages/Onboarding'
import OrderArrived from './pages/OrderArrived'
import OrderChat from './pages/OrderChat'
import OrderPlaced from './pages/OrderPlaced'
import PaymentAccount from './pages/PaymentAccount'
import PaymentAmount from './pages/PaymentAmount'
import PaymentSelection from './pages/PaymentSelection'
import PersonalData from './pages/PersonalData'
import PinSuccess from './pages/PinSuccess'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Profile from './pages/Profile'
import RatingDriver from './pages/RatingDriver'
import Reviews from './pages/Reviews'
import SaAppeals from './pages/SaAppeals'
import SaAudit from './pages/SaAudit'
import SaDashboard from './pages/SaDashboard'
import SaLedger from './pages/SaLedger'
import SaMerchantDetail from './pages/SaMerchantDetail'
import SaProfit from './pages/SaProfit'
import SaRoles from './pages/SaRoles'
import SaSwitches from './pages/SaSwitches'
import SaUsers from './pages/SaUsers'
import SaTax from './pages/SaTax'
import SaZones from './pages/SaZones'
import Search from './pages/Search'
import Security from './pages/Security'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import Verification from './pages/Verification'
import WalletBalance from './pages/WalletBalance'
import WalletPayout from './pages/WalletPayout'
import WalletTopUp from './pages/WalletTopUp'
import YourCard from './pages/YourCard'

// Tiap peran punya prefix URL sendiri dan BrowserRouter basename sendiri, jadi
// satu deployment bisa melayani beberapa PWA yang diinstall terpisah.
const ROLE_BASES = ['/customer', '/merchant', '/courier', '/admin'] as const
type RoleBase = (typeof ROLE_BASES)[number]

function roleFromPath(pathname: string): RoleBase | null {
  return (
    ROLE_BASES.find(
      (base) => pathname === base || pathname.startsWith(`${base}/`),
    ) ?? null
  )
}

const webRoutes: [string, ComponentType][] = [
  ['/', Landing],
  ['/documentation', Documentation],
]

/**
 * Layar yang isinya form masuk. Modal pasang aplikasi tidak boleh muncul di
 * sini: terukur, klik ke `.auth-submit` mendarat di `.install-prompt-box`
 * sehingga tombol masuk tak bisa ditekan sama sekali.
 */
const AUTH_FORM_PATHS = new Set([
  '/signin',
  '/signup',
  '/forgot-password',
  '/forgot-password-otp',
  '/create-password',
  '/verification',
])

// Pelanggan — dipasang di /customer/*.
const customerRoutes: [string, ComponentType][] = [
  ['/onboarding', Onboarding],
  ['/account-setup', AccountSetup],
  ['/signin', SignIn],
  ['/signup', SignUp],
  ['/forgot-password', ForgotPassword],
  ['/forgot-password-otp', ForgotPasswordOtp],
  ['/create-password', CreatePassword],
  ['/verification', Verification],
  ['/home', Home],
  ['/search', Search],
  ['/filter', Filter],
  ['/favorites', Favorites],
  ['/menu-detail/:id', MenuDetail],
  ['/store-profile', MerchantProfile],
  ['/checkout', Checkout],
  ['/address-selection', AddressSelection],
  ['/payment-selection', PaymentSelection],
  ['/payment-amount', PaymentAmount],
  ['/order-placed', OrderPlaced],
  ['/order-chat', OrderChat],
  ['/order-arrived', OrderArrived],
  ['/dispute', DisputeSubmit],
  ['/rating-driver', RatingDriver],
  ['/profile', Profile],
  ['/wallet', WalletBalance],
  ['/wallet/top-up', WalletTopUp],
  ['/wallet/payout', WalletPayout],
  ['/personal-data', PersonalData],
  ['/add-profile-photo', AddProfilePhoto],
  ['/change-password', ChangePassword],
  ['/create-pin', CreatePin],
  ['/pin-success', PinSuccess],
  ['/security', Security],
  ['/language', Language],
  ['/notifications', Notifications],
  ['/notification-settings', NotificationSettings],
  ['/payment-account', PaymentAccount],
  ['/your-card', YourCard],
  ['/add-new-card', AddNewCard],
  ['/reviews', Reviews],
  ['/faq', Faq],
  ['/help-center', HelpCenter],
  ['/privacy-policy', PrivacyPolicy],
  ['/offline', Offline],
]

// Merchant — dipasang di /merchant/*.
const merchantRoutes: [string, ComponentType][] = [
  ['/signin', MerchantSignIn],
  ['/signup', MerchantSignUp],
  ['/onboarding', MerchantOnboarding],
  ['/pending', MerchantPending],
  ['/', MerchantDashboard],
  ['/orders', MerchantOrders],
  ['/menu', MerchantMenu],
  ['/insentif', MerchantRebate],
  ['/reviews', MerchantReviews],
  ['/couriers', MerchantCouriers],
  ['/settings', MerchantSettings],
  ['/wallet', MerchantWallet],
  ['/payout', MerchantPayout],
  ['/payout-accounts', MerchantPayoutAccounts],
  ['/dispute', DisputeSubmit],
  ['/offline', Offline],
]

// Kurir — dipasang di /courier/*. Masuk lewat nomor WA (E.164): flow
// f21-account-auth + f16 (kurir karyawan merchant, direkrut setelah toko aktif).
// Dijaga `authGate`: beranda kurir hanya terbuka setelah layar masuk, sama
// seperti /merchant/* dan /customer/*.
const courierRoutes: [string, ComponentType][] = [
  ['/onboarding', CourierOnboarding],
  ['/signin', CourierSignIn],
  ['/', CourierTasks],
  ['/task/:id', CourierTaskDetail],
  ['/tips', CourierTips],
  ['/wallet', CourierWallet],
  ['/payout', CourierPayout],
  ['/payout-accounts', CourierPayoutAccounts],
  ['/profile', CourierProfile],
  ['/offline', Offline],
]

// Panel admin (CS) — dipasang di /admin/*. Shell-nya sama dengan role lain (430px).
// Super Admin BUKAN ini: ia role terpisah, website penuh non-PWA.
const adminRoutes: [string, ComponentType][] = [
  ['/', AdminDashboard],
  ['/onboarding', AdminOnboarding],
  ['/disputes', AdminDisputes],
  ['/merchants', AdminMerchants],
  ['/ledger', AdminLedger],
  ['/offline', Offline],
]

// Konsol Super Admin — role terpisah, dipasang di /superadmin/* (keputusan PO
// 2026-09-23: website penuh non-PWA, prefix disiapkan). Lebar penuh karena
// dashboard bertabel, bukan kolom PWA 430px.
const superAdminRoutes: [string, ComponentType][] = [
  ['/', SaDashboard],
  ['/users', SaUsers],
  ['/users/merchant/:id', SaMerchantDetail],
  ['/zones', SaZones],
  ['/roles', SaRoles],
  ['/audit', SaAudit],
  ['/tax', SaTax],
  ['/profit', SaProfit],
  ['/ledger', SaLedger],
  ['/appeals', SaAppeals],
  ['/switches', SaSwitches],
]

function SuperAdminRouter() {
  return (
    <BrowserRouter basename="/superadmin">
      <AppErrorBoundary>
        <Routes>
          {superAdminRoutes.map(([path, Component]) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}

/**
 * Gerbang sesi per peran. Isinya hanya layar sebelum "sudah masuk" menurut flow
 * `f21-account-auth` (onboarding → masuk → nomor WA → verifikasi), plus layar
 * offline. Layar kegagalan (`/account-setup`) ikut dibuka tanpa sesi: layar yang
 * menangani error tidak boleh ikut terkurung di balik gerbang.
 *
 * `/admin` sengaja tidak ada di peta ini — panel CS memang tanpa auth
 * (AGENTS.md §9), sama seperti `/superadmin` yang bukan PWA.
 */
const authGate: Partial<Record<RoleBase, { entry: string; publicPaths: string[] }>> = {
  '/customer': {
    entry: '/onboarding',
    publicPaths: [
      '/onboarding',
      '/signup',
      '/signin',
      '/forgot-password',
      '/forgot-password-otp',
      '/create-password',
      '/verification',
      '/account-setup',
      '/offline',
    ],
  },
  '/merchant': {
    entry: '/signin',
    publicPaths: ['/signin', '/signup', '/onboarding', '/pending', '/offline'],
  },
  '/courier': { entry: '/onboarding', publicPaths: ['/onboarding', '/signin', '/offline'] },
}

interface RoleRouterProps {
  basename: string
  routes: [string, ComponentType][]
  home: string
  /** Rute layar "tidak ada koneksi" role ini; hanya customer yang punya. */
  offlinePath?: string
  /** Tujuan saat belum masuk; tanpa ini role tidak dijaga (panel CS). */
  entry?: string
  /** Rute yang boleh dibuka tanpa sesi. */
  publicPaths?: string[]
}

/**
 * Perilaku lintas-halaman per role: batas galat, dan lompat ke layar offline
 * saat koneksi putus. Harus di dalam `<BrowserRouter>` karena memakai
 * `useNavigate`.
 */
function RoleChrome({ offlinePath, children }: { offlinePath?: string; children: ReactNode }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!offlinePath) return
    const goOffline = () => navigate(offlinePath)
    if (!navigator.onLine) goOffline()
    window.addEventListener('offline', goOffline)
    return () => window.removeEventListener('offline', goOffline)
  }, [navigate, offlinePath])

  return <AppErrorBoundary>{children}</AppErrorBoundary>
}

/**
 * Gerbang sesi: layar di dalam aplikasi baru terbuka setelah "masuk". Mode demo
 * — `signIn()` cuma menandai flag (AGENTS.md §1), tidak ada verifikasi apa pun.
 * Rute publik dicocokkan dari daftar, bukan lewat `useLocation`, supaya tidak
 * bergantung pada bagaimana router memotong `basename`. Sesi juga dipisah per
 * peran (`s.auth.role`) karena keempat PWA berbagi satu origin.
 */
function AuthGate({
  children,
  entry,
  role,
}: {
  children: ReactNode
  entry: string
  role: string
}) {
  const signedIn = useAppSelector((s) => s.auth.isAuthenticated && s.auth.role === role)
  if (!signedIn) return <Navigate to={entry} replace />
  return <>{children}</>
}

function RoleRouter({ basename, routes, home, offlinePath, entry, publicPaths = [] }: RoleRouterProps) {
  const open = new Set(publicPaths)

  return (
    <BrowserRouter basename={basename}>
      <RoleChrome offlinePath={offlinePath}>
        <PageTransition>
          <Routes>
            {routes.map(([path, Component]) => (
              <Route
                key={path}
                path={path}
                element={
                  entry && !open.has(path) ? (
                    <AuthGate entry={entry} role={basename}>
                      <Component />
                    </AuthGate>
                  ) : (
                    <Component />
                  )
                }
              />
            ))}
            <Route path="*" element={<Navigate to={home} replace />} />
          </Routes>
        </PageTransition>
      </RoleChrome>
    </BrowserRouter>
  )
}

/**
 * Pembungkus gerak antar-halaman. Harus DI DALAM `<BrowserRouter>` karena
 * `useLocation`/`useNavigationType` milik router, dan `key` yang berubah per
 * rute yang memaksa React memasang ulang wadahnya — tanpa itu kelas animasi
 * hanya berganti nama pada elemen yang sama dan animasinya tidak diputar ulang.
 */
function PageTransition({ children }: { children: ReactNode }) {
  const { className, key } = usePageTransition()
  return (
    <div key={key} className={className}>
      <PullToRefreshIndicator />
      {children}
    </div>
  )
}

function WebsiteRouter() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Routes>
          {webRoutes.map(([path, Component]) => (
            <Route key={path} path={path} element={<Component />} />
          ))}
          <Route path="/app" element={<LegacyAppRedirect />} />
          <Route path="/app/*" element={<LegacyAppRedirect />} />
          {customerRoutes.map(([path]) => (
            <Route key={`legacy-${path}`} path={path} element={<LegacyAppRedirect />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  )
}

// Tautan lama: /app/* dan jalur polos (/home, /signin) menuju peran yang benar.
function LegacyAppRedirect() {
  useEffect(() => {
    const { pathname, search, hash } = window.location
    const target = pathname.startsWith('/app')
      ? pathname.replace(/^\/app\/merchant/, '/merchant').replace(/^\/app/, '/customer')
      : `/customer${pathname}`
    window.location.replace(`${target}${search}${hash}`)
  }, [])
  return null
}

export default function App() {
  const { pathname } = window.location
  const role = roleFromPath(pathname)
  const isSuperAdmin = pathname === '/superadmin' || pathname.startsWith('/superadmin/')
  // Jalur tanpa prefix peran, dipakai untuk memutuskan apakah modal pasang
  // aplikasi boleh tampil (lihat AUTH_FORM_PATHS).
  const rolePath = role ? pathname.slice(role.length) || '/' : pathname

  useEffect(() => {
    const splash = document.getElementById('boot-splash')
    if (!splash) return
    // Singkirkan splash lewat class, bukan `remove()` atau `hidden = true`.
    // Keduanya tidak bisa ditimpa oleh POJO (`img.onerror`), jadi satu ikon
    // yang gagal dimuat membuat splash menutupi seluruh layar selamanya —
    // terukur: `elementFromPoint` di tengah tombol mengembalikan `boot-inner`.
    // `#[hidden]` di index.html memakai `display: none` tanpa `!important`,
    // sehingga kelas ini menang dan splash benar-benar hilang dari layar.
    splash.classList.add('boot-done')
  }, [])

  return (
    <StoreProvider>
      {role === '/customer' ? (
        <RoleRouter
          basename="/customer"
          routes={customerRoutes}
          home="/home"
          offlinePath="/offline"
          entry={authGate['/customer']?.entry}
          publicPaths={authGate['/customer']?.publicPaths}
        />
      ) : role === '/merchant' ? (
        <RoleRouter
          basename="/merchant"
          routes={merchantRoutes}
          home="/"
          offlinePath="/offline"
          entry={authGate['/merchant']?.entry}
          publicPaths={authGate['/merchant']?.publicPaths}
        />
      ) : role === '/courier' ? (
        <RoleRouter
          basename="/courier"
          routes={courierRoutes}
          home="/"
          offlinePath="/offline"
          entry={authGate['/courier']?.entry}
          publicPaths={authGate['/courier']?.publicPaths}
        />
      ) : role === '/admin' ? (
        <RoleRouter basename="/admin" routes={adminRoutes} home="/" offlinePath="/offline" />
      ) : isSuperAdmin ? (
        <SuperAdminRouter />
      ) : (
        <WebsiteRouter />
      )}
      <Toaster
        position="top-center"
        containerStyle={{ maxWidth: 'var(--shell-max)', marginInline: 'auto' }}
        toastOptions={{
          style: {
            background: 'var(--surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-md)',
            fontSize: 'var(--text-sm)',
          },
        }}
      />
      {/* Modal pasang aplikasi untuk URL yang memang bisa diinstal (keempat
          peran + halaman promosi). Konsol Super Admin dan /documentation
          sengaja bukan PWA, jadi tidak ditawari. Layar form masuk dikecualikan
          supaya modalnya tidak menutupi tombol masuk. */}
      {(role !== null && !AUTH_FORM_PATHS.has(rolePath)) || pathname === '/' ? (
        <InstallPromptSheet />
      ) : null}
    </StoreProvider>
  )
}
