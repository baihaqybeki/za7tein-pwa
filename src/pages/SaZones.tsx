import { RotateCcw, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'

import { SuperAdminShell } from '../components/layout/SuperAdminShell'
import { isBackendConfigured } from '../api/config'
import { fetchZones, upsertZone } from '../api/reference'
import { zoneFor } from '../data/merchant'
import { mockUser } from '../data/user'
import {
  MERCHANT_KITCHEN,
  masterZoneGeometry,
  resolveCoverage,
  zoneAreaKm2,
} from '../data/zones'
import { useLeafletZoneEditor } from '../hooks/useLeafletZoneEditor'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { revalidateAddress } from '../store/slices/cartSlice'
import { resetZone, saveZone, replaceZones, updateZoneMeta } from '../store/slices/superAdminSlice'
import type { GeoPoint, ZoneGeometry, ZoneId } from '../types'

type Vertex = GeoPoint

/**
 * Master zona. Ini **bukan** layar hiasan: poligon di sini yang dipakai gate
 * coverage saat alamat disimpan (`resolveCoverage` di `src/data/zones.ts`), jadi
 * menggeser titik langsung mengubah alamat mana yang bisa diantar.
 *
 * Kanvas menggambar lat/lng hasil proyeksi, bukan peta ber-tile: tile peta
 * selalu URL eksternal dan repo ini melarang aset gambar eksternal
 * (AGENTS.md §6). Karena itu kanvas juga menampilkan dapur merchant dan
 * lingkaran 2 km, supaya dua syarat coverage terlihat bersamaan: di dalam
 * poligon DAN ≤2 km dari dapur.
 *
 * Dua jalur input, bukan satu: geser pakai pointer (cepat), atau pilih titik
 * lalu isi lat/lng (satu-satunya jalur yang bisa dipakai keyboard, HG-05).
 */
export default function SaZones() {
  const dispatch = useAppDispatch()
  const zones = useAppSelector((s) => s.superAdmin.zones)
  const tenants = useAppSelector((s) => s.admin.tenants)
  const storedAddresses = useAppSelector((s) => s.cart.addresses)
  const addresses = Array.isArray(storedAddresses) ? storedAddresses : mockUser.addresses
  const [draft, setDraft] = useState<Partial<Record<ZoneId, Vertex[]>>>({})
  const [selected, setSelected] = useState<{ zoneId: ZoneId; index: number } | null>(null)
  const [meta, setMeta] = useState<Partial<Record<ZoneId, { label: string; note: string }>>>({})

  // Muat master zona dari server (sumber kebenaran) bila tersedia; jika kosong
  // tetap pakai bentuk awal dari `src/data/zones.ts`.
  useEffect(() => {
    if (!isBackendConfigured) return
    let alive = true
    fetchZones()
      .then((rows) => {
        if (!alive || !rows.length) return
        dispatch(
          replaceZones(
            rows.map((zone) => ({
              id: zone.code.toLowerCase() as ZoneId,
              label: zone.name,
              note: '',
              vertices: zone.polygon.map(([lat, lng]) => ({ lat, lng })),
            })),
          ),
        )
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [dispatch])

  /** Poligon yang sedang tampil: hasil geser kalau ada, kalau tidak yang tersimpan. */
  const effectiveZones: ZoneGeometry[] = zones.map((zone) =>
    draft[zone.id] ? { ...zone, vertices: draft[zone.id] as Vertex[] } : zone,
  )
  const verticesOf = (zone: ZoneGeometry) => zone.vertices

  const moveVertex = (zoneId: ZoneId, index: number, point: Vertex) => {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) return
    const next = [...(draft[zoneId] ?? zone.vertices)]
    next[index] = { lat: point.lat, lng: point.lng }
    setDraft((prev) => ({ ...prev, [zoneId]: next }))
  }

  // Peta Leaflet: geser titik poligon langsung di peta (OSM tiles).
  useLeafletZoneEditor('sa-zone-map', effectiveZones, {
    kitchen: MERCHANT_KITCHEN,
    addresses: addresses.map((a) => ({ lat: a.lat, lng: a.lng })),
    selected,
    onVertexMove: (zoneId, index, point) => moveVertex(zoneId as ZoneId, index, point),
    onVertexSelect: (zoneId, index) => setSelected({ zoneId: zoneId as ZoneId, index }),
  })

  /**
   * Setelah poligon disimpan, alamat yang tersimpan divalidasi ulang terhadap
   * bentuk baru, supaya daftar alamat customer tidak memegang hasil validasi
   * lama. Di produksi ini kerja server.
   */
  const revalidateAll = (nextZones: ZoneGeometry[]) => {
    addresses.forEach((address) => {
      const coverage = resolveCoverage({ lat: address.lat, lng: address.lng }, nextZones)
      dispatch(
        revalidateAddress({
          id: address.id,
          zone: coverage.zone,
          distanceMeters: coverage.distanceMeters,
        }),
      )
    })
  }

  const activeCount = (key: 'isActiveHijazi' | 'isActiveSyimali') =>
    tenants.filter((t) => t.deliveryConfig[key]).length

  /** Kenapa sebuah alamat tidak bisa diantar, memakai fungsi gate yang sama dengan checkout. */
  const verdictFor = (address: (typeof addresses)[number]) => {
    const coverage = resolveCoverage({ lat: address.lat, lng: address.lng }, effectiveZones)
    const zone = zoneFor(coverage)
    const reason = zone
      ? null
      : coverage.zone === null
        ? 'di luar poligon'
        : coverage.distanceMeters > 2000
          ? `${coverage.distanceMeters} m, di atas 2 km`
          : 'zona tidak diaktifkan merchant'
    return { zone, coverage, reason }
  }

  return (
    <SuperAdminShell>
      <section className="sa-grid-2">
        <article className="sa-card">
          <div className="sa-card-head">
            <div>
              <p className="sa-card-label">Kanvas zona</p>
              <p className="sa-card-sub">
                Geser titik, atau pilih satu titik lalu isi lat/lng. Perubahan langsung terlihat di
                daftar alamat sebelah.
              </p>
            </div>
          </div>

          <div
            id="sa-zone-map"
            className="sa-canvas sa-canvas--leaflet"
            role="img"
            aria-label="Peta master zona Hijazi dan Syimali beserta dapur merchant dan alamat demo"
          />

          <ul className="sa-legend">
            <li>
              <span className="sa-legend-swatch sa-legend-swatch--a" /> Poligon Hijazi
            </li>
            <li>
              <span className="sa-legend-swatch sa-legend-swatch--b" /> Poligon Syimali
            </li>
            <li>
              <span className="sa-legend-swatch sa-legend-swatch--ring" /> Jangkauan 2 km dari dapur
            </li>
            <li>
              <span className="sa-legend-swatch sa-legend-swatch--dot" /> Alamat demo
            </li>
          </ul>
        </article>

        <div className="sa-stack">
          {effectiveZones.map((zone, zoneIndex) => {
            const vertices = verticesOf(zone)
            const dirty = Boolean(draft[zone.id])
            const isSelectedZone = selected?.zoneId === zone.id
            const key = zone.id === 'hijazi' ? 'isActiveHijazi' : 'isActiveSyimali'
            const inside = addresses.filter((address) => verdictFor(address).coverage.zone === zone.id)
            return (
              <article key={zone.id} className="sa-card">
                <div className="sa-card-head">
                  <div className="sa-meta-edit">
                    <p className="sa-card-label">Zona {zoneIndex + 1}</p>
                    <label className="sa-field">
                      <span>Label</span>
                      <input
                        type="text"
                        value={meta[zone.id]?.label ?? zone.label}
                        onChange={(e) =>
                          setMeta((p) => ({ ...p, [zone.id]: { label: e.target.value, note: p[zone.id]?.note ?? zone.note } }))
                        }
                      />
                    </label>
                    <label className="sa-field">
                      <span>Catatan</span>
                      <input
                        type="text"
                        value={meta[zone.id]?.note ?? zone.note}
                        onChange={(e) =>
                          setMeta((p) => ({ ...p, [zone.id]: { label: p[zone.id]?.label ?? zone.label, note: e.target.value } }))
                        }
                      />
                    </label>
                    {meta[zone.id] ? (
                      <button
                        type="button"
                        className="sa-btn sa-btn--small sa-btn--primary"
                        onClick={() => {
                          const m = meta[zone.id]
                          if (!m) return
                          dispatch(updateZoneMeta({ id: zone.id, label: m.label, note: m.note }))
                          setMeta((p) => {
                            const next = { ...p }
                            delete next[zone.id]
                            return next
                          })
                          toast.success('Zona disimpan')
                        }}
                      >
                        Simpan
                      </button>
                    ) : null}
                  </div>
                  {dirty ? <span className="sa-chip is-off">Belum disimpan</span> : null}
                </div>

                <ul className="sa-kv">
                  <li>
                    <span>Luas</span>
                    <span>{zoneAreaKm2(vertices).toFixed(2)} km²</span>
                  </li>
                  <li>
                    <span>Titik sudut</span>
                    <span>{vertices.length}</span>
                  </li>
                  <li>
                    <span>Alamat demo di dalam</span>
                    <span>
                      {inside.length} dari {addresses.length}
                    </span>
                  </li>
                  <li>
                    <span>Tenant mengaktifkan</span>
                    <span>
                      {activeCount(key)} dari {tenants.length}
                    </span>
                  </li>
                </ul>

                {isSelectedZone && selected ? (
                  <div className="sa-vertex-fields">
                    <label className="sa-field">
                      <span>Lat titik {selected.index + 1}</span>
                      <input
                        type="number"
                        step={0.0005}
                        value={vertices[selected.index].lat.toFixed(4)}
                        onChange={(e) =>
                          moveVertex(zone.id, selected.index, {
                            lat: Number(e.target.value),
                            lng: vertices[selected.index].lng,
                          })
                        }
                      />
                    </label>
                    <label className="sa-field">
                      <span>Lng titik {selected.index + 1}</span>
                      <input
                        type="number"
                        step={0.0005}
                        value={vertices[selected.index].lng.toFixed(4)}
                        onChange={(e) =>
                          moveVertex(zone.id, selected.index, {
                            lat: vertices[selected.index].lat,
                            lng: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <p className="sa-note">Pilih satu titik di kanvas untuk mengedit lat/lng lewat keyboard.</p>
                )}

                <div className="sa-actions">
                  <button
                    type="button"
                    className="sa-btn sa-btn--primary"
                    disabled={!dirty}
                    onClick={async () => {
                      dispatch(saveZone({ id: zone.id, vertices }))
                      revalidateAll(effectiveZones)
                      setDraft((prev) => {
                        const next = { ...prev }
                        delete next[zone.id]
                        return next
                      })
                      let backend = ''
                      if (isBackendConfigured) {
                        const polygon = vertices.map((v) => [v.lat, v.lng]) as [number, number][]
                        const id = await upsertZone({ code: zone.label, name: zone.label, polygon })
                        backend = id ? ' · tersimpan ke server' : ' · server gagal, tersimpan lokal'
                      }
                      toast.success(
                        `Poligon ${zone.label} disimpan, ${addresses.length} alamat demo divalidasi ulang${backend}`,
                      )
                    }}
                  >
                    <Save size={16} strokeWidth={1.75} aria-hidden="true" />
                    Simpan poligon
                  </button>
                  <button
                    type="button"
                    className="sa-btn"
                    onClick={() => {
                      const seed = masterZoneGeometry.find((item) => item.id === zone.id)
                      const nextZones = zones.map((item) =>
                        item.id === zone.id && seed ? { ...item, vertices: seed.vertices } : item,
                      )
                      dispatch(resetZone({ id: zone.id }))
                      revalidateAll(nextZones)
                      setDraft((prev) => {
                        const next = { ...prev }
                        delete next[zone.id]
                        return next
                      })
                      toast.success(`Poligon ${zone.label} kembali ke bentuk awal`)
                    }}
                  >
                    <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
                    Bentuk awal
                  </button>
                </div>
              </article>
            )
          })}

          <article className="sa-card">
            <p className="sa-card-label">Alamat demo, hasil gate saat ini</p>
            <p className="sa-card-sub">
              Dihitung ulang tiap kali poligon digeser, memakai fungsi gate yang sama dengan
              checkout: di dalam poligon, ≤2 km dari dapur, dan zona diaktifkan merchant.
            </p>
            <ul className="sa-addr-list">
              {addresses.map((address) => {
                const { zone, coverage, reason } = verdictFor(address)
                return (
                  <li key={address.id}>
                    <span className="sa-addr-name">{address.name}</span>
                    <span className="sa-addr-meta">
                      {coverage.distanceMeters} m · {zone ? zone.label : reason}
                    </span>
                    <span className={`sa-chip${zone ? ' is-ok' : ' is-off'}`}>
                      {zone ? 'Bisa diantar' : 'Di luar area'}
                    </span>
                  </li>
                )
              })}
            </ul>
            <p className="sa-note">
              Alamat baru dihitung dengan poligon ini saat disimpan. Order yang sudah jalan tidak
              ikut berubah, zonanya snapshot saat order dibuat. Bentuk awal disimpan di{' '}
              {masterZoneGeometry.length} zona di <code className="sa-code">src/data/zones.ts</code>.
            </p>
          </article>
        </div>
      </section>
    </SuperAdminShell>
  )
}
