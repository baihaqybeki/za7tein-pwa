import type { ChatMessage, ChatThread } from '../types'
import { mockOrder } from './merchant'
import { mockUser } from './user'

const COURIER_ID = 'cr-1'
const CUSTOMER_ID = mockUser.id
const THREAD_ID = 'chat-1'

const iso = (offsetMin: number) => new Date(Date.now() + offsetMin * 60_000).toISOString()

/** Thread chat untuk order yang sedang berjalan (mock). Satu thread per order, maks 3 peserta. */
export const seedChatThreads: ChatThread[] = [
  {
    id: THREAD_ID,
    orderId: mockOrder.code,
    participants: [
      { userId: CUSTOMER_ID, role: 'customer' },
      { userId: COURIER_ID, role: 'courier' },
    ],
    lastMessage: 'Siap, saya kabari lagi kalau sudah dekat.',
    lastAt: iso(-3),
  },
]

/** Percakapan pembuka — kurir mengabari lebih dulu, seperti aplikasi asli. */
export const seedChatMessages: ChatMessage[] = [
  { id: 'cm-1', chatId: THREAD_ID, senderId: COURIER_ID, senderRole: 'courier', body: `Halo, pesanan ${mockOrder.code} sudah saya ambil dari toko.`, at: iso(-6), readAt: iso(-6) },
  { id: 'cm-2', chatId: THREAD_ID, senderId: COURIER_ID, senderRole: 'courier', body: 'Saya menuju ke Green View Apartment ya.', at: iso(-5), readAt: iso(-5) },
  { id: 'cm-3', chatId: THREAD_ID, senderId: CUSTOMER_ID, senderRole: 'customer', body: 'Baik, ditunggu. Titip ke resepsionis kalau saya belum turun.', at: iso(-4), readAt: null },
  { id: 'cm-4', chatId: THREAD_ID, senderId: COURIER_ID, senderRole: 'courier', body: 'Siap, saya kabari lagi kalau sudah dekat.', at: iso(-3), readAt: null },
]

/** Chip saran pesan cepat. */
export const chatQuickReplies = [
  'Di mana sekarang?',
  'Tolong titip ke satpam',
  'Sudah dekat?',
  'Tolong jangan pakai sambal',
]

/** Balasan bergilir kurir (mock) supaya mengirim pesan terasa ada yang menjawab. */
export const chatAutoReplies = [
  'Siap, saya catat ya.',
  'Baik, sebentar lagi sampai.',
  'Sudah masuk gerbang, tinggal cari tower A.',
  'Terima kasih, ditunggu ya.',
]
