import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { merchantOrders as seedOrders } from '../../data/merchantOrders'
import { merchantReviewReplies } from '../../data/merchantReviews'
import {
  MAX_COURIERS_PER_MERCHANT,
  merchantDeliveryConfig,
  mockCouriers,
  mockMerchant,
  mockStoreProfile,
} from '../../data/merchant'
import { toE164 } from '../../data/phone'
import {
  MERCHANT_CREDIT_FEE_JOD,
  MERCHANT_CREDIT_JOD,
  currentPeriod,
  mockMerchantCredit,
  rebateAmountFor,
  rebateTierFor,
} from '../../data/incentive'
import type {
  Courier,
  MerchantCreditEvent,
  MerchantCreditEventName,
  MerchantCreditState,
  MerchantDeliveryConfig,
  MerchantOrder,
  MerchantOrderStatus,
} from '../../types'

interface MerchantState {
  orders: MerchantOrder[]
  /**
   * Kurir milik merchant yang sedang login (C-06). Dikelola dari halaman Kurir:
   * tambah/hapus, jam tugas, dan pemilihan kurir per order.
   */
  couriers: Courier[]
  isActive: boolean
  todayOrderCount: number
  dailyLimit: number
  /** Balasan merchant per id ulasan. Tidak dipersist — reset saat reload. */
  reviewReplies: Record<string, string>
  /** Modal 5 JOD + cashback tier bulanan (M10). */
  credit: MerchantCreditState
  /**
   * Foto toko (field `photo` D1, f16). URL objek dari berkas yang dipilih di
   * klien — tidak ada unggahan sungguhan (AGENTS.md §1). Tidak dipersist.
   */
  logo: string | null
  /**
   * Profil toko yang bisa disunting di Setelan. Sebelumnya form hanya
   * memunculkan toast "berhasil" tanpa mengubah state apa pun. Tidak dipersist.
   */
  storeName: string
  storePhone: string
  storeAddress: string
  /**
   * Konfigurasi pengiriman dari form profil toko (f16): mode jangkauan,
   * radius maksimum, zona aktif, dan ongkir. Menggantikan seed
   * `merchantDeliveryConfig`. Tidak dipersist.
   */
  deliveryConfig: MerchantDeliveryConfig
  /** Jam operasional + koordinat toko (Setelan), bisa disunting. */
  storeOpenTime: string
  storeCloseTime: string
  storeLat: number
  storeLng: number
}

const initialState: MerchantState = {
  orders: seedOrders,
  couriers: mockCouriers,
  isActive: mockMerchant.isActive,
  todayOrderCount: mockMerchant.todayOrderCount,
  dailyLimit: mockMerchant.dailyLimit,
  reviewReplies: merchantReviewReplies,
  credit: mockMerchantCredit,
  logo: mockMerchant.logo,
  storeName: mockStoreProfile.name,
  storePhone: mockStoreProfile.phone,
  storeAddress: mockStoreProfile.address,
  deliveryConfig: merchantDeliveryConfig,
  storeOpenTime: mockMerchant.openTime,
  storeCloseTime: mockMerchant.closeTime,
  storeLat: mockMerchant.lat,
  storeLng: mockMerchant.lng,
}

/** Entry insentif: urutan + waktu, cukup unik untuk mock satu sesi. */
const creditEvent = (
  event: MerchantCreditEventName,
  amountJod: number,
  index: number,
): MerchantCreditEvent => ({
  id: `${event}-${index + 1}-${Date.now()}`,
  event,
  amountJod,
  at: new Date().toISOString(),
})

const merchantSlice = createSlice({
  name: 'merchant',
  initialState,
  reducers: {
    toggleActive(state) {
      state.isActive = !state.isActive
    },
    setOrderStatus(
      state,
      action: PayloadAction<{ id: string; status: MerchantOrderStatus }>,
    ) {
      const order = state.orders.find((o) => o.id === action.payload.id)
      if (order) order.status = action.payload.status
    },
    setCookMinutes(state, action: PayloadAction<{ id: string; minutes: number }>) {
      const order = state.orders.find((o) => o.id === action.payload.id)
      if (order) order.cookMinutes = action.payload.minutes
    },
    /** Merchant mendaftarkan kurirnya sendiri — dibatasi kuota kurir per toko. */
    addCourier(state, action: PayloadAction<{ name: string; phone: string }>) {
      if (state.couriers.length >= MAX_COURIERS_PER_MERCHANT) return
      state.couriers.push({
        id: `cr-local-${Date.now()}`,
        merchantId: mockMerchant.id,
        name: action.payload.name,
        phone: toE164(action.payload.phone),
        // Nomor kurir baru belum diverifikasi; hanya seed awal yang sudah.
        phoneVerified: false,
        status: 'offline',
        activeOrderCount: 0,
        joinedAt: 'baru saja',
      })
    },
    /**
     * Hapus kurir sekaligus lepas rujukannya di order — order tidak boleh
     * menyimpan `courierId` yang sudah tidak ada di registri.
     */
    removeCourier(state, action: PayloadAction<{ id: string }>) {
      state.couriers = state.couriers.filter((c) => c.id !== action.payload.id)
      for (const order of state.orders) {
        if (order.courierId === action.payload.id) order.courierId = undefined
      }
    },
    /**
     * Jam tugas kurir: merchant hanya menandai siap / tidak siap. Status
     * `delivering` datang dari checkpoint kurir sendiri (F13), bukan dari sini.
     */
    setCourierDuty(state, action: PayloadAction<{ id: string; onDuty: boolean }>) {
      const courier = state.couriers.find((c) => c.id === action.payload.id)
      if (!courier || courier.status === 'delivering') return
      courier.status = action.payload.onDuty ? 'at_store' : 'offline'
    },
    /**
     * Merchant memilih kurir untuk sebuah order (F12 `:assign` → `hold_cut`).
     * Hitungan order aktif dijaga konsisten saat kurirnya diganti.
     */
    assignCourier(state, action: PayloadAction<{ orderId: string; courierId: string }>) {
      const order = state.orders.find((o) => o.id === action.payload.orderId)
      const next = state.couriers.find((c) => c.id === action.payload.courierId)
      if (!order || !next || order.courierId === next.id) return
      const previous = state.couriers.find((c) => c.id === order.courierId)
      if (previous) previous.activeOrderCount = Math.max(0, previous.activeOrderCount - 1)
      next.activeOrderCount += 1
      order.courierId = next.id
    },
    setReviewReply(state, action: PayloadAction<{ id: string; text: string }>) {
      state.reviewReplies[action.payload.id] = action.payload.text
    },
    /** Ganti / unggah foto toko; URL berasal dari `URL.createObjectURL` lokal. */
    setMerchantLogo(state, action: PayloadAction<string>) {
      state.logo = action.payload
    },
    /** Hapus foto toko — kembali ke placeholder. */
    removeMerchantLogo(state) {
      state.logo = null
    },
    /** Simpan profil toko dari Setelan (nama, nomor, alamat). */
    setStoreProfile(state, action: PayloadAction<{ name: string; phone: string; address: string }>) {
      state.storeName = action.payload.name
      state.storePhone = action.payload.phone
      state.storeAddress = action.payload.address
    },
    /** Sunting jam operasional + koordinat toko. */
    setStoreDetails(state, action: PayloadAction<{ openTime: string; closeTime: string; lat: number; lng: number }>) {
      state.storeOpenTime = action.payload.openTime
      state.storeCloseTime = action.payload.closeTime
      state.storeLat = action.payload.lat
      state.storeLng = action.payload.lng
    },
    /** Konfigurasi pengiriman dari form profil toko onboarding (f16). */
    setDeliveryConfig(state, action: PayloadAction<MerchantDeliveryConfig>) {
      state.deliveryConfig = action.payload
    },
    /** Merchant baru dapat modal 5 JOD (event `merchant_credit_granted`). */
    grantCredit(state) {
      state.credit.merchantCreditBalance += MERCHANT_CREDIT_JOD
      state.credit.events.unshift(
        creditEvent('merchant_credit_granted', MERCHANT_CREDIT_JOD, state.credit.events.length),
      )
    },
    /**
     * Fee merchant 0,15 JOD dipotong dari modal, bukan dari dompet. Diklem di 0
     * supaya sisa modal tidak pernah negatif.
     */
    debitCredit(state) {
      if (state.credit.merchantCreditBalance <= 0) return
      const amount = Math.min(MERCHANT_CREDIT_FEE_JOD, state.credit.merchantCreditBalance)
      state.credit.merchantCreditBalance =
        Math.round((state.credit.merchantCreditBalance - amount) * 100) / 100
      state.credit.events.unshift(
        creditEvent('merchant_credit_debited', amount, state.credit.events.length),
      )
    },
    /**
     * Order settled menambah hitungan periode. Kalau ambang tier baru terlewati,
     * tier dan nilai cashbacknya ikut naik (event `rebate_tier_reached`).
     */
    recordSettledOrder(state) {
      state.credit.settledThisPeriod += 1
      const tier = rebateTierFor(state.credit.settledThisPeriod)
      if (!tier || tier === state.credit.rebateTier) return
      state.credit.rebateTier = tier
      state.credit.rebateAmountJod = rebateAmountFor(tier)
      state.credit.rebatePaidAt = null
      state.credit.events.unshift(
        creditEvent(
          'rebate_tier_reached',
          state.credit.rebateAmountJod,
          state.credit.events.length,
        ),
      )
    },
    /** Cashback dibayar ke dompet deposit (bukan ke modal) — event `rebate_paid`. */
    payRebate(state) {
      const { rebateTier, rebateAmountJod, rebatePaidAt } = state.credit
      if (!rebateTier || rebateAmountJod <= 0 || rebatePaidAt) return
      state.credit.depositBalanceJod =
        Math.round((state.credit.depositBalanceJod + rebateAmountJod) * 100) / 100
      state.credit.rebatePaidAt = new Date().toISOString()
      state.credit.events.unshift(
        creditEvent('rebate_paid', rebateAmountJod, state.credit.events.length),
      )
    },
    /** Periode baru: hitungan order per periode direset (I-4 belum final). */
    startNewPeriod(state) {
      state.credit.rebatePeriod = currentPeriod()
      state.credit.settledThisPeriod = 0
      state.credit.rebateTier = null
      state.credit.rebateAmountJod = 0
      state.credit.rebatePaidAt = null
    },
  },
})

export const {
  toggleActive,
  setOrderStatus,
  setCookMinutes,
  addCourier,
  removeCourier,
  setCourierDuty,
  assignCourier,
  setReviewReply,
  setMerchantLogo,
  removeMerchantLogo,
  setStoreProfile,
  setStoreDetails,
  setDeliveryConfig,
  grantCredit,
  debitCredit,
  recordSettledOrder,
  payRebate,
  startNewPeriod,
} = merchantSlice.actions
export default merchantSlice.reducer
