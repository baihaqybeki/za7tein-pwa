import { useEffect, useRef } from 'react'
import type { LayerGroup, Map as LeafletMap, PathOptions } from 'leaflet'

import 'leaflet/dist/leaflet.css'

export interface ZoneEditorZone {
  id: string
  label: string
  vertices: { lat: number; lng: number }[]
}
interface Point {
  lat: number
  lng: number
}
interface Options {
  kitchen?: Point
  addresses?: Point[]
  selected?: { zoneId: string; index: number } | null
  onVertexMove: (zoneId: string, index: number, point: Point) => void
  onVertexSelect: (zoneId: string, index: number) => void
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

/**
 * Editor geometri master zona di atas peta Leaflet (OSM tiles). Titik poligon
 * dapat digeser langsung; callback melaporkan perubahan ke pemanggil untuk
 * disimpan. Menggambar poligon tiap zona, dapur merchant, jangkauan 2 km, dan
 * titik alamat demo. Tanpa aset gambar eksternal di markup (AGENTS §6) — tile
 * dimuat Leaflet lewat JS.
 */
export function useLeafletZoneEditor(mapId: string, zones: ZoneEditorZone[], options: Options) {
  const mapRef = useRef<LeafletMap | null>(null)
  const LRef = useRef<typeof import('leaflet') | null>(null)
  const groupRef = useRef<LayerGroup | null>(null)
  const cbRef = useRef(options)
  const fittedRef = useRef(false)
  cbRef.current = options

  const draw = () => {
    const L = LRef.current
    const map = mapRef.current
    const group = groupRef.current
    if (!L || !map || !group) return
    group.clearLayers()
    const { kitchen, addresses, selected, onVertexMove, onVertexSelect } = cbRef.current
    const colors = [cssVar('--sa7tein-orange', '#e04020'), cssVar('--success', '#2e7d32'), cssVar('--warning-ink', '#b26a00')]

    zones.forEach((zone, zoneIndex) => {
      const latlngs = zone.vertices.map((v) => [v.lat, v.lng] as [number, number])
      const stroke: PathOptions = { color: colors[zoneIndex % colors.length], weight: 2, fillOpacity: 0.15 }
      L.polygon(latlngs, stroke).addTo(group)

      zone.vertices.forEach((vertex, index) => {
        const isSel = selected?.zoneId === zone.id && selected.index === index
        const marker = L.marker([vertex.lat, vertex.lng], {
          draggable: true,
          icon: L.divIcon({
            className: `sa-vertex-marker${isSel ? ' is-selected' : ''}`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
          keyboard: true,
          alt: `${zone.label} titik ${index + 1}`,
        }).addTo(group)
        marker.on('drag', (e: import('leaflet').LeafletEvent) => {
          const ll = (e.target as import('leaflet').Marker).getLatLng()
          onVertexMove(zone.id, index, { lat: ll.lat, lng: ll.lng })
        })
        marker.on('click', () => onVertexSelect(zone.id, index))
      })
    })

    if (kitchen) {
      L.circle([kitchen.lat, kitchen.lng], { radius: 2000, color: colors[0], weight: 1, dashArray: '4 4', fill: false }).addTo(group)
      L.circleMarker([kitchen.lat, kitchen.lng], { radius: 4, color: colors[0], fillColor: colors[0], fillOpacity: 1 }).addTo(group)
    }
    ;(addresses ?? []).forEach((a) => {
      L.circleMarker([a.lat, a.lng], { radius: 3, color: colors[1], fillColor: colors[1], fillOpacity: 1 }).addTo(group)
    })

    if (!fittedRef.current && zones.length) {
      const bounds = L.latLngBounds(zones.flatMap((z) => z.vertices.map((v) => [v.lat, v.lng] as [number, number])))
      if (bounds.isValid()) {
        map.fitBounds(bounds.pad(0.3))
        fittedRef.current = true
      }
    }
  }

  useEffect(() => {
    let cancelled = false
    const el = document.getElementById(mapId)
    if (!el || mapRef.current) return
    const stamped = el as HTMLElement & { _leaflet_id?: number }
    if (stamped._leaflet_id) delete stamped._leaflet_id

    import('leaflet').then((module) => {
      if (cancelled) return
      const L = (module as unknown as { default: typeof import('leaflet') }).default
      LRef.current = L
      const map = L.map(el, { zoomControl: true, attributionControl: false })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map)
      map.setView([32.55, 35.85], 13)
      mapRef.current = map
      groupRef.current = L.layerGroup().addTo(map)
      draw()
    })
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      groupRef.current = null
      LRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId])

  useEffect(() => {
    draw()
  })
}
