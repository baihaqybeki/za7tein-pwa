import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import { seedChatMessages, seedChatThreads } from '../../data/chat'
import type { ChatMessage, ChatRole, ChatThread } from '../../types'

/**
 * Chat in-app per order (C-18). Tidak dipersist — sama alasan dengan notifikasi:
 * percakapan mock yang tersimpan berhari-hari lalu dibuka lagi terasa aneh.
 * Bentuknya mengikuti tabel `chats` / `chat_messages` di backend.
 */
interface ChatState {
  threads: ChatThread[]
  messages: ChatMessage[]
}

const initialState: ChatState = {
  threads: seedChatThreads,
  messages: seedChatMessages,
}

let seq = 0
const makeId = () => `cm-${Date.now()}-${(seq += 1)}`

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    /** Kirim satu pesan ke thread; perbarui ringkasan thread. */
    sendMessage(
      state,
      action: PayloadAction<{ threadId: string; senderId: string; senderRole: ChatRole; body: string }>,
    ) {
      const { threadId, senderId, senderRole, body } = action.payload
      const text = body.trim()
      if (!text) return
      const at = new Date().toISOString()
      state.messages.push({
        id: makeId(),
        chatId: threadId,
        senderId,
        senderRole,
        body: text,
        at,
        readAt: null,
      })
      const thread = state.threads.find((t) => t.id === threadId)
      if (thread) {
        thread.lastMessage = text
        thread.lastAt = at
      }
    },
    /** Tandai pesan lawan di satu thread sudah dibaca (isi `readAt`). */
    markThreadRead(state, action: PayloadAction<{ threadId: string; readerId: string }>) {
      const at = new Date().toISOString()
      state.messages.forEach((m) => {
        if (m.chatId === action.payload.threadId && m.senderId !== action.payload.readerId && !m.readAt) {
          m.readAt = at
        }
      })
    },
  },
})

export const { sendMessage, markThreadRead } = chatSlice.actions

export const selectThread = (threads: ChatThread[], orderId: string) =>
  threads.find((t) => t.orderId === orderId)
export const selectMessages = (messages: ChatMessage[], threadId: string) =>
  messages.filter((m) => m.chatId === threadId)

export default chatSlice.reducer
