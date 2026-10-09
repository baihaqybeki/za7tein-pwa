import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { StoreStatus } from '../../types'

interface UiState {
  locationLabel: string
  cartBadgeCount: number
  /** Status toko yang dilihat customer (open/busy/closed) — demo toggle. */
  storeStatus: StoreStatus
}

const initialState: UiState = {
  locationLabel: '44 Street Town',
  cartBadgeCount: 1,
  storeStatus: 'open',
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLocationLabel(state, action: PayloadAction<string>) {
      state.locationLabel = action.payload
    },
    setCartBadgeCount(state, action: PayloadAction<number>) {
      state.cartBadgeCount = action.payload
    },
    setStoreStatus(state, action: PayloadAction<StoreStatus>) {
      state.storeStatus = action.payload
    },
  },
})

export const { setLocationLabel, setCartBadgeCount, setStoreStatus } =
  uiSlice.actions
export default uiSlice.reducer
