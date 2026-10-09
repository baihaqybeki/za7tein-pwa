# Referensi UI/UX: Flow & Data repo `baihaqybeki/sa7tein` (bukan target)

Sumber: repo publik `https://github.com/baihaqybeki/sa7tein` (branch `main`), dibaca lewat `raw.githubusercontent.com`. Tidak di-clone.

Status: **referensi UI/UX saja, bukan target implementasi.** Target tetap repo `sa7tein-pwa`. Aturan bisnis yang berlaku tetap `source.md` (lihat `analysis.md` C-06..C-19). Design system sengaja di luar cakupan dokumen ini.

Stack: JS (bukan TS) + React 18 + Vite + Zustand + Tailwind + Leaflet + Supabase (opsional) + Capacitor. Monorepo: `apps/{customer,merchant,courier,cs}` + `packages/shared`.

## 1. Portal & route

Basename per portal: `/customer/`, `/merchant/`, `/courier/`, `/cs/`. Path di bawah relatif terhadap basename.

| Portal | Path | Komponen | Fungsi |
|---|---|---|---|
| customer | `/` | `pages/Home.jsx` | Daftar restoran (jarak + badge buka) → menu, search/kategori, stok live, floating cart bar |
| customer | `/cart` | `pages/CartPage.jsx` | Baris cart + qty, subtotal / ongkir / total, lanjut checkout |
| customer | `/checkout` | `pages/CheckoutPage.jsx` | Pin peta + detail penerima + metode bayar + catatan, ringkasan, place order |
| customer | `/order/:id` | `pages/TrackOrder.jsx` | Peta kurir live, jarak/ETA, window cancel 15s, banner hampir tiba, kartu kurir, chat, timeline status |
| customer | `/orders` | `pages/OrderHistory.jsx` | Riwayat order |
| customer | `/settings` | shared `ProfileSettings.jsx` | Profil |
| merchant | `/` | `pages/AdminDashboard.jsx` | Toggle buka/tutup, editor foto + lokasi, tab Queue / In progress / Completed / Cancelled, aksi per status (Accept, Reject, Start Preparing, Done·Ready) |
| merchant | `/menu` | `pages/MenuManager.jsx` | CRUD menu inline, picker emoji, harga/stok/kategori/available, restock +10/−1, statistik |
| merchant | `/settings` | shared `ProfileSettings.jsx` | Profil |
| courier | `/` | `pages/CourierDashboard.jsx` | Online/Offline, upload foto, statistik (offers/on-the-way/earnings), New Delivery Offers (Accept/Reject), fallback "Ready at Restaurant", In Progress |
| courier | `/order/:id` | `pages/CourierDelivery.jsx` | Peta, Start Delivery, loop posisi GPS/simulasi 3s, Complete Delivery manual, chat |
| courier | `/settings` | shared `ProfileSettings.jsx` | Profil |
| cs | `/` | `pages/CSDashboard.jsx` | 6 kartu KPI, tab Active / Needs attention / Completed / Cancelled-Rejected, semua order lintas merchant, aksi Cancel / Force-assign / Re-offer / Mark delivered, chat mediator |
| cs | `/transactions` | `pages/Transactions.jsx` | Ringkasan dana, breakdown per merchant, tabel transaksi, filter tanggal/status/search |
| cs | `/settings` | shared `ProfileSettings.jsx` | Profil |

Auth gate: user belum login → `AuthPage role="<portal>"`. Akun role-scoped.

## 2. State machine order (string persis)

Sumber: `packages/shared/src/lib/store.js` (`ORDER_STATUS_LABEL`), `lib/orders.js`, `apps/*/src/pages/*.jsx`.

```
pending ──accept──▶ accepted ──start(prepTimeMinutes)──▶ preparing ──done──▶ ready
   │                    │                                                      │
   │ reject             └──────────────────────────────▶ rejected              │ offer
   ▼                                                                           ▼
rejected                                                        courier accept (claimOrder) ─▶ picked_up
   ▲                                                                                          │ startDelivery
   │                                                                                          ▼
cancelled ◀── (customer_cancelled | store_closed | cs_cancelled)                        on_the_way
                                                                                             │ completeDelivery (MANUAL)
                                                                                             ▼
                                                                                        delivered
```

- String: `pending`, `accepted`, `preparing`, `ready`, `picked_up`, `on_the_way`, `delivered`, `rejected`, `cancelled`.
- Timeline yang ditampilkan ke customer (`OrderStatusTimeline.jsx`): `pending → accepted → preparing → ready → picked_up → on_the_way → delivered`.
- Sub-state offer pada order: `assignedCourierId`, `assignedCourierName`, `offerStatus` (`pending` | `accepted` | `null`), `offerSentAt`, `rejectedBy[]`.
- Alasan cancel: `store_closed`, `customer_cancelled`, `cs_cancelled`.
- Konstanta: `OFFER_TIMEOUT_MS = 60_000`, `ONLINE_WINDOW_MS = 120_000`, `CANCEL_WINDOW_MS = 15_000`, `ALMOST_THERE_SEC = 90`, `STEP_MS = 3000`, `GPS_TIMEOUT_MS = 4000`, heartbeat 30s, stale-offer sweep 15s, prep default 15 menit.

## 3. Zustand store (`packages/shared/src/lib/store.js`)

Satu store, `useStore = create(...)`. Tanpa slice, tanpa persist.

State: `backendMode`, `currentUser`, `authReady`, `storeOpen`, `merchants[]`, `merchantStatus{}`, `selectedMerchantId`, `menu[]`, `orders[]`, `cart{}`, `customer{}`, `selectedCourierId`, `courierOnline`, `messagesByOrder{}`.

Aksi: `setCurrentUser`, `setAuthReady`, `setStoreOpen`, `setMerchants`, `setMerchantStatus`, `setSelectedMerchantId`, `setMenu`, `setOrders`, `setCustomer`, `setSelectedCourier`, `setCourierOnline`, `setOrderMessages`, `addToCart`, `decreaseFromCart`, `removeFromCart`, `clearCart`.

Helper/selector: `getCartLines`, `cartSubtotal`, `cartCount`, `deliveryInfo`, `ORDER_STATUS_LABEL`, `ORDER_STATUS_COLOR`.

## 4. Bentuk objek domain

Tidak ada `types.ts` — proyek plain JS, tipe adalah bentuk runtime.

- **User** (`sanitizeUser`): `{ id, name, email, phone, role, merchantId, courierId, address }`, `role: 'customer' | 'merchant' | 'courier' | 'cs'`.
- **Order** (dirakit di `CheckoutPage.placeOrder`, diperkaya `localBackend.createOrder`): `customerId`, `customerUserId`, `customerName`, `customerPhone`, `customerAddress`, `customerLat/Lng`, `restaurantId`, `restaurantName`, `restaurantLat/Lng`, `restaurantPhoto`, `items[{itemId,name,image,photo,price,qty,note}]`, `orderNote`, `subtotal`, `courierCost`, `total`, `distanceMeters`, `travelTimeSeconds`, `payment`, `prepTimeMinutes`, `courierId`, `courierName`, `courierLat/Lng`, `remainingMeters`. Ditambah saat create: `id`, `code` (`SA-<n>`), `createdAt`, `status`, `statusTimestamps`. Ditambah saat claim: `courierPhoto`, `offerStatus`, `courierLat/Lng`, `remainingMeters`.
- **Message** (chat): `{ id, orderId, channel, senderId, senderName, senderRole, text, createdAt }`; `CHAT_CHANNELS = ['customer-merchant','merchant-courier','courier-customer']`.

Catatan: `docs/FSD.md` §5.4 menyebut `code(GE-xxx)`, kode aktual `SA-<n>`. `docs/SRS.md` §1.1/1.2 menulis "tiga aplikasi" padahal ada 4 portal.

## 5. Backend contract

Adapter dipilih otomatis (`lib/backend/index.js`): `getBackend()` → `supabaseBackend` kalau env terisi, kalau tidak `localBackend`. Mode lokal: data di `localStorage` (prefix `sa7tein:`) + sinkron antar tab via `BroadcastChannel` (`sa7tein-sync`).

Permukaan method (dari `localBackend.js`, cocok FSD §6): `register`, `login`, `logout`, `getCurrentUser`, `sendVerificationCode`, `verifyCode`, `updateProfile`, `getMerchants`, `updateMerchant`, `onMerchantsChange`, `getStoreStatus`, `setStoreStatus`, `onStoreStatusChange`, `getMenu`, `saveMenu`, `updateStock`, `onMenuChange`, `createOrder`, `getOrders`, `onOrdersChange`, `updateOrderStatus`, `claimOrder`, `updateCourierLocation`, `onCourierLocation`, `getCouriers`, `updateCourier`, `onCouriersChange`, `getMessages`, `sendMessage`, `onMessagesChange`, `resetDemo`.

## 6. Tabel Supabase — DIHAPUS dari dokumen ini

Skema Supabase repo referensi (7 tabel: `merchants`, `menu_items`, `orders`, `couriers`, `profiles`, `settings`, `order_messages`, dengan text PK + `profiles → auth.users` + RLS permissive) **dicabut sebagai acuan** pada 2026-10-09 — bentuk tabelnya tidak dipakai.

- **Sumber tunggal skema DB sekarang:** `docs/product/schema-draft-v1.md` (17 entitas) → SQL di `supabase/schema.sql` (aditif).
- **Membuang skema referensi lama dari database:** `supabase/reference-schema-drop.sql` (destruktif, manual).

Bagian lain dokumen ini (portal/route, state machine, store, bentuk objek, uang & geo) tetap berlaku sebagai **referensi UI/UX saja, bukan target**.

## 7. Uang & geo (`packages/shared/src/lib/geo.js`)

- Mata uang: IDR. `formatRupiah(n) => 'Rp' + Math.round(n||0).toLocaleString('id-ID')`.
- `RESTAURANT = { name: 'Warung Nusantara', address: 'Jl. Kebon Sirih No. 8, Jakarta Pusat', lat: -6.2, lng: 106.8166 }`.
- `WALKING_SPEED_MS = 1.35` (≈ 4,9 km/jam).
- `COURIER_COST = { base: 5000, perKm: 2500, min: 5000, round: 500 }`.
- `calculateCourierCost(m) = max(min, ceil((base + km*perKm) / round) * round)`.
- `ONLINE_WINDOW_MS = 120 * 1000`.
- Haversine `R = 6371000`; `estimateEta(prep, travel) = prep*60 + travel`; `walkingTimeSeconds = m / 1.35`.

## 8. Delta terhadap revisi ini

Semua aturan bisnis repo referensi di atas digantikan `source.md`. Daftar keputusan ada di `analysis.md` bagian "Conflicts vs repo UI/UX referensi — RESOLVED by PO 2026-09-21" (C-06..C-19).

Yang bisa dipakai sebagai **acuan bentuk layar** (bukan aturan bisnis): struktur 4 portal, portal CS sebagai acuan Super Admin, chat in-app, dan pola pemisahan `apps/` + `packages/shared`. Implementasi tetap di repo `sa7tein-pwa` dengan stack-nya sendiri (TS + Redux + SCSS) dan aturan `source.md`.
