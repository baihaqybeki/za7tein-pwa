import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { nextCheckpoint } from '../../data/courier'
import { mockUser } from '../../data/user'
import type {
  Address,
  CartItem,
  CourierCheckpoint,
  Food,
  HoldEvent,
  HoldEventName,
  HoldStatus,
  OrderStage,
  ZoneId,
} from '../../types'

interface CartState {
  items: CartItem[]
  /** Alamat dibagi ke seluruh alur checkout, bukan state lokal per layar. */
  addresses: Address[]
  selectedAddressId: string | null
  selectedPaymentId: string | null
  /** Nama file bukti transfer; wajib ada sebelum pesanan transfer dikirim. */
  transferProof: string | null
  /** Tahap berjalan; halaman pelacakan menyesuaikan tampilannya dari sini. */
  orderStage: OrderStage
  /**
   * Hold COD via wallet (R-COD-01, F2). Satu urutan: none → held → cut →
   * settled, dengan jalur batal released/reversed. Nominalnya disimpan sekali
   * saat hold dibuat supaya transisi berikutnya tidak bisa memakai angka lain.
   */
  holdStatus: HoldStatus
  holdAmountIdr: number
  /** Ledger hold append-only — tiap transisi menambah satu entry. */
  holdLedger: HoldEvent[]
  /**
   * Checkpoint pengiriman order (F5/M5): masuk → ambil → berangkat → tiba →
   * selesai. Waktu mulai disimpan ISO supaya SLA dihitung dari kejadian nyata,
   * bukan dari timer palsu. `selesai` hanya lewat OTP, bukan tombol lanjut.
   */
  deliveryCheckpoint: CourierCheckpoint
  deliveryCheckpointAt: string | null
  /** GPS disnapshot sekali saat "Tiba" (kontrak BE M5), bukan tiap render. */
  gpsSnapshot: { lat: number; lng: number } | null
  /** Order selesai — dasar window sengketa 24 jam (M6). */
  orderCompletedAt: string | null
}

const initialState: CartState = {
  // Contoh pesanan #S7-1024 dari PRD: 2× Sate Ayam dengan modifier.
  items: [
    {
      id: '1',
      name: 'Sate Ayam',
      price: 28000,
      quantity: 2,
      image: '/assets/img/menu-details/menu-details-thumb.png',
      modifiers: 'Sedang',
    },
  ],
  addresses: mockUser.addresses,
  selectedAddressId: 'tower-a',
  selectedPaymentId: 'dana_balance',
  transferProof: null,
  // Order demo dimulai dari tahap yang sama dengan yang dilihat merchant
  // ('masuk' di `merchantOrders` SA-1041) dan kurir ('masuk', belum diambil).
  orderStage: 'diterima',
  holdStatus: 'none',
  holdAmountIdr: 0,
  holdLedger: [],
  deliveryCheckpoint: 'masuk',
  deliveryCheckpointAt: null,
  gpsSnapshot: null,
  orderCompletedAt: null,
}

/** Id entry hold: urutan + waktu, cukup unik untuk mock satu sesi. */
const holdEvent = (event: HoldEventName, amountIdr: number, index: number): HoldEvent => ({
  id: `${event}-${index + 1}-${Date.now()}`,
  event,
  amountIdr,
  at: new Date().toISOString(),
})

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem(
      state,
      action: PayloadAction<{
        food: Food
        quantity?: number
        /** harga satuan setelah modifier, mis. Sate Ayam + Lontong */
        unitPrice?: number
        modifiers?: string
      }>,
    ) {
      const { food, quantity = 1, unitPrice, modifiers } = action.payload
      // Sate Ayam "Pedas" dan "Tidak Pedas" adalah baris terpisah di keranjang.
      const existing = state.items.find(
        (i) => i.id === food.id && (i.modifiers ?? '') === (modifiers ?? ''),
      )
      if (existing) existing.quantity += quantity
      else
        state.items.push({
          id: food.id,
          name: food.name,
          price: unitPrice ?? food.price,
          quantity,
          image: food.image,
          modifiers,
        })
    },
    setOrderStage(state, action: PayloadAction<OrderStage>) {
      state.orderStage = action.payload
    },
    updateQuantity(state, action: PayloadAction<{ id: string; quantity: number }>) {
      const item = state.items.find((i) => i.id === action.payload.id)
      if (!item) return
      if (action.payload.quantity <= 0) {
        state.items = state.items.filter((i) => i.id !== action.payload.id)
      } else {
        item.quantity = action.payload.quantity
      }
    },
    removeItem(state, action: PayloadAction<string>) {
      state.items = state.items.filter((i) => i.id !== action.payload)
    },
    clearCart(state) {
      state.items = []
    },
    setAddress(state, action: PayloadAction<string>) {
      state.selectedAddressId = action.payload
    },
    setPayment(state, action: PayloadAction<string>) {
      state.selectedPaymentId = action.payload
      // Bukti transfer hanya relevan untuk metode transfer.
      if (action.payload !== 'qris') state.transferProof = null
    },
    setTransferProof(state, action: PayloadAction<string | null>) {
      state.transferProof = action.payload
    },
    addAddress(state, action: PayloadAction<Address>) {
      // Alamat pertama otomatis jadi alamat utama.
      if (!state.addresses.some((item) => item.isDefault)) action.payload.isDefault = true
      state.addresses.push(action.payload)
    },
    /** Ubah alamat yang sudah ada — form edit memakai ini, bukan menambah baris baru. */
    updateAddress(state, action: PayloadAction<Address>) {
      const index = state.addresses.findIndex((item) => item.id === action.payload.id)
      if (index < 0) return
      state.addresses[index] = action.payload
      if (action.payload.isDefault) {
        state.addresses.forEach((item) => {
          item.isDefault = item.id === action.payload.id
        })
        state.selectedAddressId = action.payload.id
      }
    },
    removeAddress(state, action: PayloadAction<string>) {
      state.addresses = state.addresses.filter((item) => item.id !== action.payload)
      if (state.selectedAddressId !== action.payload) return
      // Yang dihapus tadi sedang dipilih — jatuh ke alamat utama, lalu yang pertama.
      state.selectedAddressId =
        state.addresses.find((item) => item.isDefault)?.id ?? state.addresses[0]?.id ?? null
    },
    /** Jadikan satu alamat sebagai utama; sekaligus pilih untuk order ini. */
    setDefaultAddress(state, action: PayloadAction<string>) {
      state.addresses.forEach((item) => {
        item.isDefault = item.id === action.payload
      })
      state.selectedAddressId = action.payload
    },
    /**
     * Validasi ulang satu alamat terhadap master zona yang baru. Di produksi ini
     * kerja server; di repo ini konsol SA yang memicunya setelah poligon disimpan
     * supaya daftar alamat customer tidak menyimpan hasil validasi yang basi.
     */
    revalidateAddress(
      state,
      action: PayloadAction<{ id: string; zone: ZoneId | null; distanceMeters: number }>,
    ) {
      const address = state.addresses.find((item) => item.id === action.payload.id)
      if (!address) return
      address.zone = action.payload.zone
      address.distanceMeters = action.payload.distanceMeters
    },
    /** Order COD dibuat → saldo ditahan (event `hold_created`). */
    createOrderHold(state, action: PayloadAction<{ amountIdr: number }>) {
      if (state.holdStatus !== 'none') return
      state.holdStatus = 'held'
      state.holdAmountIdr = action.payload.amountIdr
      state.holdLedger.push(
        holdEvent('hold_created', action.payload.amountIdr, state.holdLedger.length),
      )
    },
    /** Kurir match → potongan dikunci (event `hold_cut`). */
    matchCourier(state) {
      if (state.holdStatus !== 'held') return
      state.holdStatus = 'cut'
      state.holdLedger.push(holdEvent('hold_cut', state.holdAmountIdr, state.holdLedger.length))
    },
    /** OTP sukses → dana ke merchant (event `hold_settled`). */
    settleOrderHold(state) {
      if (state.holdStatus !== 'cut') return
      state.holdStatus = 'settled'
      state.holdLedger.push(
        holdEvent('hold_settled', state.holdAmountIdr, state.holdLedger.length),
      )
    },
    /**
     * Batal dua jalur (F2): sebelum match → `released`, sesudah match →
     * `reversed`. Status lain diabaikan, jadi tidak ada transisi liar.
     */
    cancelOrder(state) {
      if (state.holdStatus === 'held') {
        state.holdStatus = 'released'
        state.holdLedger.push(
          holdEvent('hold_released', state.holdAmountIdr, state.holdLedger.length),
        )
      } else if (state.holdStatus === 'cut') {
        state.holdStatus = 'reversed'
        state.holdLedger.push(
          holdEvent('hold_reversed', state.holdAmountIdr, state.holdLedger.length),
        )
      }
    },
    /** Reset hold saat pesanan baru dimulai dari keranjang kosong. */
    resetOrderHold(state) {
      state.holdStatus = 'none'
      state.holdAmountIdr = 0
      state.holdLedger = []
    },
    /**
     * Maju satu checkpoint pengiriman (F5). GPS hanya disimpan saat "Tiba" —
     * kontrak BE menetapkan snapshot sekali, bukan stream.
     */
    advanceDelivery(state, action: PayloadAction<{ gps?: { lat: number; lng: number } } | undefined>) {
      const next = nextCheckpoint(state.deliveryCheckpoint)
      // `selesai` dicapai lewat OTP, bukan tombol lanjut.
      if (!next || next === 'selesai') return
      state.deliveryCheckpoint = next
      state.deliveryCheckpointAt = new Date().toISOString()
      if (next === 'tiba' && action.payload?.gps) state.gpsSnapshot = action.payload.gps
    },
    /** OTP benar → pengiriman selesai (auto-settle otomatis kalau window lewat). */
    completeDelivery(state) {
      if (state.deliveryCheckpoint !== 'tiba') return
      state.deliveryCheckpoint = 'selesai'
      state.deliveryCheckpointAt = new Date().toISOString()
      // Window sengketa 24 jam (M6) dihitung dari titik ini.
      state.orderCompletedAt = state.deliveryCheckpointAt
    },
    resetDelivery(state) {
      state.deliveryCheckpoint = 'masuk'
      state.deliveryCheckpointAt = null
      state.gpsSnapshot = null
      state.orderCompletedAt = null
    },
  },
})

export const {
  addItem,
  updateQuantity,
  removeItem,
  clearCart,
  setAddress,
  setPayment,
  setTransferProof,
  addAddress,
  updateAddress,
  removeAddress,
  setDefaultAddress,
  revalidateAddress,
  createOrderHold,
  matchCourier,
  settleOrderHold,
  cancelOrder,
  resetOrderHold,
  advanceDelivery,
  completeDelivery,
  resetDelivery,
} = cartSlice.actions

export const selectCartCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0)

export const selectSubtotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.price * i.quantity, 0)

export default cartSlice.reducer
