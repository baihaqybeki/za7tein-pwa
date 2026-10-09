import { combineReducers, configureStore, type Middleware } from '@reduxjs/toolkit'
import {
  FLUSH,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
  REHYDRATE,
  createMigrate,
  persistReducer,
  persistStore,
} from 'redux-persist'

import { menuSeed } from '../data/catalog'
import { DISPUTE_RESOLUTION_LABEL } from '../data/admin'
import { CS_CURRENT_ACTOR, SA_CURRENT_ACTOR } from '../data/superadmin'
import { findCustomer } from '../data/people'
import { mockUser } from '../data/user'

import auth from './slices/authSlice'
import accountSetup from './slices/accountSetupSlice'
import cart from './slices/cartSlice'
import favorites from './slices/favoritesSlice'
import catalog from './slices/catalogSlice'
import merchant, { assignCourier, setOrderStatus } from './slices/merchantSlice'
import courier, { advanceCheckpoint, completeTask } from './slices/courierSlice'
import wallet from './slices/walletSlice'
import payout from './slices/payoutSlice'
import admin from './slices/adminSlice'
import superAdmin, { logAudit } from './slices/superAdminSlice'
import notifications, { pushNotification } from './slices/notificationsSlice'
import chat from './slices/chatSlice'
import ui from './slices/uiSlice'
import { journeyNotifications, type JourneyEvent } from '../lib/orderJourney'
import type { AuditKind, DisputeResolution } from '../types'

// Minimal localStorage-backed storage so we don't depend on redux-persist's
// CJS entry point, which Vite struggles to pre-bundle.
const storage = {
  getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string) => Promise.resolve(localStorage.setItem(key, value)),
  removeItem: (key: string) => Promise.resolve(localStorage.removeItem(key)),
}

const rootReducer = combineReducers({
  auth,
  cart,
  favorites,
  catalog,
  merchant,
  courier,
  wallet,
  payout,
  admin,
  superAdmin,
  notifications,
  chat,
  ui,
  accountSetup,
})

// Hanya slice ini yang bertahan setelah reload.
// Key persist milik Sa7tein.
// `admin` ikut persist sejak M6: putusan sengketa dan entry ledger harus terbaca
// lintas role (customer → panel CS), dan perpindahan role me-reload halaman.
// `superAdmin` ikut persist sejak konsol SA dibangun: konfigurasi zona, role,
// operator, kill switch, dan audit trail harus bertahan lintas reload.
// `auth` ikut persist sejak gerbang rute dipasang: sesi yang tidak bertahan
// berarti setiap reload melempar pengguna kembali ke onboarding, dan justru
// itulah yang bikin mode terinstal terasa rusak.
/**
 * Migrasi state tersimpan. v3: vertices poligon zona pindah dari koordinat
 * gambar (`{x,y}`) ke lat/lng sungguhan supaya gate coverage bisa menguji
 * "titik di dalam poligon". Hanya `superAdmin` yang dibuang, karena hanya itu
 * yang berubah bentuk, keranjang dan saldo demo tidak perlu ikut hilang.
 *
 * v4: rujukan antar-entitas pindah dari nama ke id — entry ledger dapat
 * `party`, sengketa dapat `partyId`/`customerId`/`merchantId`, merchant dapat
 * identitas pemilik, dan audit dapat `actorId`. State tersimpan dari versi lama
 * tidak punya kolom itu, dan `entry.party` yang `undefined` langsung
 * melempar error saat tabel ledger dirender. `admin` + `superAdmin` dibuang
 * supaya di-seed ulang; keranjang, saldo, dan katalog tidak berubah bentuk.
 */
const migrations = {
  3: (state: any) => ({ ...state, superAdmin: undefined }),
  4: (state: any) => ({ ...state, admin: undefined, superAdmin: undefined }),
  /**
   * v5: `superAdmin` dibuang supaya di-seed ulang. Dipakai saat `superAdmin`
   * sempat dapat field `incentive` (master insentif di konsol SA) yang kemudian
   * dicabut kembali: state tersimpan dari masa itu masih membawa field itu, dan
   * membiarkannya berarti `state.superAdmin` tidak pernah cocok lagi dengan
   * bentuk yang dipakai kode. Keranjang, saldo, dan katalog tidak berubah bentuk.
   */
  5: (state: any) => ({ ...state, superAdmin: undefined }),
}

const persistConfig = {
  key: 'sa7tein',
  version: 5,
  storage,
  whitelist: ['cart', 'favorites', 'accountSetup', 'catalog', 'wallet', 'payout', 'admin', 'superAdmin', 'auth'],
  migrate: createMigrate(migrations, { debug: false }),
}

/**
 * Cart versi lama menyimpan id menu versi lama dan belum mengenal alamat apartemen
 * maupun bukti transfer. Kalau dibiarkan, `addresses` tidak ada dan layar
 * checkout gagal render.
 *
 * Sengaja dijalankan sinkron sebelum rehydrate, dan berbasis bentuk data
 * (bukan nomor versi) supaya state yang sudah terlanjur tersimpan tanpa
 * perbaikan pun ikut sembuh. Idempoten: aman dipanggil tiap kali app dibuka.
 */
function repairPersistedCart() {
  try {
    const raw = localStorage.getItem('persist:sa7tein')
    if (!raw) return
    const outer = JSON.parse(raw)
    const cart = JSON.parse(outer.cart ?? '{}')
    const legacyItems = (cart.items ?? []).some((i: any) => {
      const food = menuSeed.find((f) => f.id === i.id)
      return !food || (!i.modifiers && i.price !== food.price)
    })
    // Alamat versi lama belum menyimpan `zone` (snapshot coverage Hijazi/Syimali,
    // migrasi zona 2026-09-23). Tanpa field itu semua alamat jadi "di luar
    // jangkauan", jadi state lama dikembalikan ke alamat mock.
    const zonesOutdated =
      Array.isArray(cart.addresses) && cart.addresses.some((a: any) => !('zone' in a))
    const needsRepair =
      !Array.isArray(cart.addresses) ||
      zonesOutdated ||
      cart.transferProof === undefined ||
      legacyItems ||
      !['wallet', 'cod', 'transfer'].includes(cart.selectedPaymentId)

    if (!needsRepair) return

    const items = (cart.items ?? []).flatMap((item: any) => {
      const food = menuSeed.find((f) => f.id === item.id)
      if (!food) return []
      if (item.modifiers) return [item]
      return [{ ...item, name: food.name, image: food.image, price: food.price }]
    })

    outer.cart = JSON.stringify({
      ...cart,
      items,
      addresses:
        Array.isArray(cart.addresses) && !zonesOutdated ? cart.addresses : mockUser.addresses,
      transferProof: cart.transferProof ?? null,
      selectedAddressId: mockUser.addresses.some((a) => a.id === cart.selectedAddressId)
        ? cart.selectedAddressId
        : mockUser.addresses[0].id,
      selectedPaymentId: ['wallet', 'cod', 'transfer'].includes(cart.selectedPaymentId)
        ? cart.selectedPaymentId
        : 'wallet',
    })
    const meta = JSON.parse(outer._persist ?? '{}')
    outer._persist = JSON.stringify({ ...meta, version: 2 })
    localStorage.setItem('persist:sa7tein', JSON.stringify(outer))
  } catch {
    // State rusak tidak boleh menghalangi app terbuka.
  }
}

repairPersistedCart()

const persistedReducer = persistReducer(persistConfig, rootReducer)

/**
 * Jembatan audit: tiap aksi panel CS (`admin/*`) menulis satu baris ke audit
 * trail SA. Ditaruh di middleware, bukan di 8 reducer/halaman CS, supaya tidak
 * ada aksi CS yang lolos pengawasan dan halaman CS tidak perlu disentuh.
 */
interface CsAuditRule {
  kind: AuditKind
  action: string | ((payload: any) => string)
  target: (payload: any, state: RootState) => string
  /** Aksi yang dijalankan SA lewat slice CS (mis. putusan banding) ditandai `sa`. */
  actor?: 'sa' | 'cs' | ((payload: any) => 'sa' | 'cs')
}

const CS_AUDIT_RULES: Record<string, CsAuditRule> = {
  'admin/approveDeposit': {
    kind: 'onboarding',
    action: 'Setujui deposit tenant, status jadi Aktif',
    target: (p, s) => s.admin.tenants.find((t) => t.id === p.id)?.name ?? p.id,
  },
  'admin/rejectOnboarding': {
    kind: 'onboarding',
    action: 'Tolak onboarding tenant',
    target: (p, s) => s.admin.tenants.find((t) => t.id === p.id)?.name ?? p.id,
  },
  'admin/suspendMerchant': {
    kind: 'merchant',
    // Pelaku menentukan bunyi barisnya: "Suspend merchant" tanpa pelaku ambigu
    // kalau CS dan SA punya tombol yang sama.
    action: (p) => (p.by === 'sa' ? 'Suspend merchant dari konsol SA' : 'Suspend merchant dari panel CS'),
    target: (p, s) => s.admin.merchants.find((m) => m.id === p.id)?.name ?? p.id,
    actor: (p) => (p.by === 'sa' ? 'sa' : 'cs'),
  },
  'admin/reinstateMerchant': {
    kind: 'merchant',
    action: 'Aktifkan kembali merchant',
    target: (p, s) => s.admin.merchants.find((m) => m.id === p.id)?.name ?? p.id,
    actor: 'sa',
  },
  'admin/blacklistCod': {
    kind: 'merchant',
    action: 'Blacklist COD merchant + tandai riskFlag customer',
    target: (p, s) =>
      `${s.admin.merchants.find((m) => m.id === p.id)?.name ?? p.id} · ${
        findCustomer(p.customerId)?.name ?? p.customerId
      }`,
  },
  'admin/startInvestigation': {
    kind: 'dispute',
    action: 'Mulai investigasi sengketa',
    target: (p, s) => s.admin.disputes.find((d) => d.id === p.id)?.orderCode ?? p.id,
  },
  'admin/resolveDispute': {
    kind: 'dispute',
    action: (p) =>
      `Putusan level-1: ${DISPUTE_RESOLUTION_LABEL[p.resolution as DisputeResolution] ?? p.resolution}`,
    target: (p, s) => s.admin.disputes.find((d) => d.id === p.id)?.orderCode ?? p.id,
  },
  'admin/fileDispute': {
    kind: 'dispute',
    action: 'Sengketa baru diajukan',
    target: (p) => p.orderCode,
  },
  'admin/clearEscalation': {
    kind: 'escalate',
    action: 'Tindak alert SLA',
    target: (p, s) => s.admin.escalations.find((e) => e.id === p.id)?.orderCode ?? p.id,
  },
  'admin/decideAppeal': {
    kind: 'dispute',
    actor: 'sa',
    action: (p) => (p.verdict === 'upheld' ? 'Perkuat putusan CS (banding)' : 'Ubah putusan CS (banding)'),
    target: (p, s) => s.admin.disputes.find((d) => d.id === p.id)?.orderCode ?? p.id,
  },
}

const auditBridge: Middleware = (api) => (next) => (action) => {
  const result = next(action)
  const rule = CS_AUDIT_RULES[(action as { type?: string }).type ?? '']
  if (rule) {
    const payload = (action as { payload?: any }).payload ?? {}
    // Aktor dibaca dari operator yang sedang bertugas, bukan konstanta: aksi CS
    // tidak boleh semuanya tercatat atas nama satu orang. Id-nya ikut dicatat —
    // nama bisa berubah, dan baris audit harus bisa ditautkan ke akun pelakunya.
    const state = api.getState() as RootState
    const isSa = (typeof rule.actor === 'function' ? rule.actor(payload) : rule.actor) === 'sa'
    const actorId = isSa ? state.superAdmin.activeOperatorId : state.superAdmin.csActorId
    const operatorName = (id: string, fallback: string) =>
      state.superAdmin.operators.find((operator) => operator.id === id)?.name ?? fallback
    api.dispatch(
      logAudit({
        actor: operatorName(actorId, isSa ? SA_CURRENT_ACTOR.name : CS_CURRENT_ACTOR.name),
        actorId,
        role: isSa ? 'sa' : 'cs',
        kind: rule.kind,
        action: typeof rule.action === 'function' ? rule.action(payload) : rule.action,
        target: rule.target(payload, api.getState() as RootState),
      }),
    )
  }
  return result
}


/** Notifikasi journey pesanan lintas peran saat order bergerak (R-PUSH-01). */
const JOURNEY_STATUS: Record<string, JourneyEvent> = {
  diterima: 'accepted',
  ditolak: 'rejected',
  dimasak: 'preparing',
  diantar: 'onTheWay',
  batal: 'canceled',
  selesai: 'delivered',
}

const journeyBridge: Middleware = (api) => (next) => (action) => {
  const before = api.getState() as RootState
  const result = next(action)
  const state = api.getState() as RootState
  const emit = (event: JourneyEvent | undefined, code: string | undefined) => {
    if (!event || !code) return
    journeyNotifications(event, code).forEach((n) => api.dispatch(pushNotification(n)))
  }
  if (assignCourier.match(action)) {
    emit('assigned', before.merchant.orders.find((o) => o.id === action.payload.orderId)?.code)
  } else if (setOrderStatus.match(action)) {
    emit(JOURNEY_STATUS[action.payload.status], before.merchant.orders.find((o) => o.id === action.payload.id)?.code)
  } else if (advanceCheckpoint.match(action)) {
    const task = state.courier.tasks.find((t) => t.id === action.payload.id)
    const ev: JourneyEvent | undefined =
      task?.checkpoint === 'tiba' ? 'arrived' : task?.checkpoint === 'berangkat' ? 'onTheWay' : 'pickedUp'
    emit(ev, task?.code)
  } else if (completeTask.match(action)) {
    emit('delivered', before.courier.tasks.find((t) => t.id === action.payload.id)?.code)
  }
  return result
}

export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(auditBridge, journeyBridge),
})

export const persistor = persistStore(store)

export type RootState = ReturnType<typeof rootReducer>
export type AppDispatch = typeof store.dispatch
