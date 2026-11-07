import type { Journey } from '../api/orderJourney'

/** Detail pesanan dari server (order_journey): item, riwayat, checkpoint, kurir. */
export function OrderJourneyPanel({ journey }: { journey: Journey }) {
  return (
    <section className="track-status" aria-label="Detail pesanan dari server">
      <p className="track-status-label">Detail pesanan</p>
      <p className="track-ref">
        #{journey.order.code} · {journey.order.status} · bayar: {journey.order.payment_status}
      </p>
      <ul role="list" style={{ listStyle: 'none', margin: '8px 0', padding: 0 }}>
        {journey.items.map((it, index) => (
          <li key={it.id ?? index} className="track-row-name">
            {it.qty}× {it.name} · {Number(it.line_total_jod).toFixed(2)} JOD
          </li>
        ))}
      </ul>
      <p className="track-ref">
        Riwayat: {journey.history.map((h) => `${h.from_status ?? '–'}→${h.to_status}`).join(' · ') || '–'}
      </p>
      <p className="track-ref">
        Checkpoint: {journey.checkpoints.map((c) => c.kind).join(' · ') || '–'}
      </p>
      {journey.courier ? (
        <p className="track-ref">
          Kurir: {journey.courier.name}
          {journey.courier.latitude != null && journey.courier.longitude != null
            ? ` · ${journey.courier.latitude.toFixed(4)}, ${journey.courier.longitude.toFixed(4)}`
            : ''}
        </p>
      ) : null}
    </section>
  )
}
