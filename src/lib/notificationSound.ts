import { DEFAULT_NOTIFICATION_SOUND, soundTones } from '../data/notifications'

/**
 * Bunyikan nada notifikasi lewat Web Audio — tanpa berkas aset (AGENTS §6).
 * Dipakai bersama oleh pengaturan (preview) dan hook `useNotificationSound`
 * (saat notifikasi baru masuk), supaya satu tempat saja.
 *
 * Nada dibangkitkan dari katalog `NOTIFICATION_SOUNDS` (frekuensi dasar per key).
 * Aman dipanggil walau Web Audio tidak tersedia / autoplay diblokir: gagal
 * senyap, tidak melempar.
 */
export function playNotificationSound(key: string = DEFAULT_NOTIFICATION_SOUND): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return

    const ctx = new Ctx()
    const tones = soundTones(key)
    tones.forEach((hz, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = hz
      osc.connect(gain)
      gain.connect(ctx.destination)
      const start = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.2, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.11)
      osc.start(start)
      osc.stop(start + 0.12)
    })
    window.setTimeout(() => ctx.close(), tones.length * 120 + 200)
  } catch {
    // Web Audio tidak tersedia — abaikan.
  }
}
