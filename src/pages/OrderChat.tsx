import { ArrowLeft, MessageCircle, Send } from 'lucide-react'

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { chatAutoReplies, chatQuickReplies } from '../data/chat'
import { mockCouriers, mockOrder } from '../data/merchant'
import { waLink } from '../data/phone'
import { mockUser } from '../data/user'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { markThreadRead, selectMessages, selectThread, sendMessage } from '../store/slices/chatSlice'

const jam = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * Chat dengan kurir untuk order yang sedang berjalan. Percakapan hidup di
 * `chatSlice` (bentuknya mengikuti tabel `chats`/`chat_messages`), bukan lagi
 * state lokal halaman — supaya bisa dibaca lintas peran dan pesan yang dikirim
 * benar-benar tercatat. Balasan kurir tetap simulasi (mock, tanpa soket).
 */
export default function OrderChat() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const courier = mockCouriers[0]
  const senderId = mockUser.id

  const thread = useAppSelector((s) => selectThread(s.chat.threads, mockOrder.code))
  const threadId = thread?.id ?? ''
  const messages = useAppSelector((s) => (threadId ? selectMessages(s.chat.messages, threadId) : []))

  const [draf, setDraf] = useState('')
  const [menulis, setMenulis] = useState(false)
  const [offline, setOffline] = useState(false)
  const nomorBalasan = useRef(0)
  const ujungDaftar = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    document.body.className = 'sa7tein-track-page'
    return () => {
      document.body.className = ''
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  // Tandai pesan lawan sudah dibaca saat layar dibuka.
  useEffect(() => {
    if (threadId) dispatch(markThreadRead({ threadId, readerId: senderId }))
  }, [dispatch, threadId, senderId])

  // Selalu tampilkan pesan terbaru.
  useEffect(() => {
    ujungDaftar.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, menulis])

  const kirim = (teks: string) => {
    const isi = teks.trim()
    if (!isi || !threadId) return

    dispatch(sendMessage({ threadId, senderId, senderRole: 'customer', body: isi }))
    setDraf('')
    // Lawan offline: pesan tetap tampil, tapi tidak ada balasan otomatis (M8).
    if (offline) return
    setMenulis(true)

    timer.current = setTimeout(() => {
      const balasan = chatAutoReplies[nomorBalasan.current % chatAutoReplies.length]
      nomorBalasan.current += 1
      setMenulis(false)
      dispatch(sendMessage({ threadId, senderId: courier.id, senderRole: 'courier', body: balasan }))
    }, 1200)
  }

  return (
    <div className="app-shell">
      <main>
        <div className="chat-screen">
          <header className="chat-header">
            <button
              type="button"
              className="btn-back"
              aria-label="Kembali"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={20} strokeWidth={2} aria-hidden="true" />
            </button>

            <div className="chat-header__who">
              <span className="chat-header__name">{courier.name}</span>
              <span className="chat-header__status">
                {offline
                  ? 'Kurir sedang offline'
                  : menulis
                    ? 'sedang menulis…'
                    : 'Kurir · pesanan ' + mockOrder.code}
              </span>
            </div>

            <span className="chat-header__spacer" aria-hidden="true" />
          </header>

          <div className="chat-thread" role="log" aria-live="polite" aria-label="Percakapan dengan kurir">
            {messages.map((pesan) => {
              const dari = pesan.senderId === senderId ? 'aku' : 'kurir'
              return (
                <div key={pesan.id} className={`chat-bubble chat-bubble--${dari}`}>
                  <p className="chat-bubble__text">{pesan.body}</p>
                  <span className="chat-bubble__jam">{jam(pesan.at)}</span>
                </div>
              )
            })}

            {menulis ? (
              <div className="chat-bubble chat-bubble--kurir chat-typing">
                <span className="chat-typing__dot" />
                <span className="chat-typing__dot" />
                <span className="chat-typing__dot" />
              </div>
            ) : null}

            <div ref={ujungDaftar} />
          </div>

          {offline ? (
            <div className="chat-fallback" role="status">
              <p className="chat-fallback__text">
                Kurir offline — balasan otomatis dimatikan. Lanjut lewat WhatsApp?
              </p>
              <a
                className="chat-fallback__cta"
                href={waLink(
                  courier.phone,
                  `Halo ${courier.name}, ini soal pesanan ${mockOrder.code}.`,
                )}
                target="_blank"
                rel="noreferrer"
              >
                <MessageCircle size={16} strokeWidth={1.75} aria-hidden="true" />
                Chat WhatsApp
              </a>
            </div>
          ) : null}

          <div className="chat-suggestions">
            {chatQuickReplies.map((s) => (
              <button key={s} type="button" className="chat-chip" onClick={() => kirim(s)}>
                {s}
              </button>
            ))}
            <button
              type="button"
              className="chat-chip chat-chip--demo"
              onClick={() => setOffline((v) => !v)}
            >
              {offline ? 'Kurir kembali online' : 'Simulasi: kurir offline'}
            </button>
          </div>

          <form
            className="chat-compose"
            onSubmit={(e) => {
              e.preventDefault()
              kirim(draf)
            }}
          >
            <input
              className="chat-compose__input"
              type="text"
              value={draf}
              onChange={(e) => setDraf(e.target.value)}
              placeholder="Tulis pesan…"
              aria-label="Tulis pesan untuk kurir"
            />
            <button
              type="submit"
              className="chat-compose__send"
              aria-label="Kirim pesan"
              disabled={draf.trim().length === 0}
            >
              <Send size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
