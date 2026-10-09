import type { GeoPoint, ZoneGeometry, ZoneId } from '../types'

import { MAX_DELIVERY_METERS, haversineMeters, mockMerchant } from './merchant'

/**
 * Master zona: sumber kebenaran batas kawasan Hijazi & Syimali.
 *
 * Kenapa modul sendiri: poligon ini dipakai **dua sisi** yang tidak boleh
 * berbeda tafsir. Konsol SA mengeditnya (`/superadmin/zones`), dan gate
 * coverage membaca hasil editnya saat alamat baru disimpan. Kalau keduanya
 * punya salinan sendiri, yang satu akan menyimpang dari yang lain.
 *
 * Vertices disimpan lat/lng, bukan koordinat gambar, karena gate coverage
 * menguji "titik di dalam poligon" pada koordinat asli. Kanvas SA memproyeksikan
 * lat/lng itu ke layar hanya untuk keperluan menggambar dan menggeser.
 *
 * Di produksi geometri ini ditentukan server; di repo ini ia mock (AGENTS.md §1)
 * dan jadi stand-in server yang dipakai layar.
 */

/** Meter per derajat, cukup akurat untuk area beberapa kilometer. */
const M_PER_DEG_LAT = 110574
const M_PER_DEG_LNG = 111320

/** Dapur merchant contoh, pusat syarat "≤2 km" (`C-13`). */
export const MERCHANT_KITCHEN: GeoPoint = { lat: mockMerchant.lat, lng: mockMerchant.lng }

/**
 * Bentuk awal poligon. Sengaja tidak bertumpuk supaya satu titik tidak pernah
 * masuk dua zona sekaligus, dan sengaja memuat alamat demo yang memang
 * dinyatakan di dalam zona (`tower-a` di Hijazi, `tower-b` di Syimali).
 */
export const masterZoneGeometry: ZoneGeometry[] = [
  {
    id: 'hijazi',
    label: 'Hijazi',
    note: 'Pemukiman barat, demo: klaster Tower A',
    vertices: [
      { lat: -6.25, lng: 106.776 },
      { lat: -6.251, lng: 106.787 },
      { lat: -6.257, lng: 106.79 },
      { lat: -6.262, lng: 106.785 },
      { lat: -6.262, lng: 106.776 },
    ],
  },
  {
    id: 'syimali',
    label: 'Syimali',
    note: 'Utara kampus, demo: klaster Tower B',
    vertices: [
      { lat: -6.263, lng: 106.774 },
      { lat: -6.263, lng: 106.787 },
      { lat: -6.268, lng: 106.789 },
      { lat: -6.274, lng: 106.783 },
      { lat: -6.272, lng: 106.773 },
    ],
  },
]

/** Titik di dalam poligon (ray casting). Poligon dianggap tertutup. */
export function pointInPolygon(point: GeoPoint, vertices: GeoPoint[]): boolean {
  if (vertices.length < 3) return false
  let inside = false
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i]
    const b = vertices[j]
    const straddles = a.lat > point.lat !== b.lat > point.lat
    if (!straddles) continue
    const cutLng = ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
    if (point.lng < cutLng) inside = !inside
  }
  return inside
}

/** Zona yang memuat titik ini, atau `null` kalau di luar semua poligon. */
export function zoneForPoint(point: GeoPoint, polygons: ZoneGeometry[]): ZoneId | null {
  return polygons.find((polygon) => pointInPolygon(point, polygon.vertices))?.id ?? null
}

export interface Coverage {
  /** Zona menurut poligon master, belum memperhitungkan jarak atau toggle merchant. */
  zone: ZoneId | null
  /** Jarak Haversine ke dapur merchant. */
  distanceMeters: number
}

/**
 * Stand-in server saat alamat baru disimpan: tentukan zona dari poligon master
 * lalu ukur jaraknya ke dapur. Hasilnya disimpan sebagai snapshot di alamat,
 * sama seperti `Address.zone` hasil server pada PRD (`F20`).
 */
export function resolveCoverage(
  point: GeoPoint,
  polygons: ZoneGeometry[],
  kitchen: GeoPoint = MERCHANT_KITCHEN,
): Coverage {
  return { zone: zoneForPoint(point, polygons), distanceMeters: haversineMeters(point, kitchen) }
}

/**
 * Coverage lengkap sebuah titik: zona master + jarak + **kelayakan antar**.
 * `deliverable` menggabungkan dua syarat coverage (dalam poligon master DAN
 * ≤ radius maksimal) di satu tempat, supaya gate checkout dan konsol zona tidak
 * menyusun ulang aturan yang sama dengan tafsir berbeda.
 */
export function pointCoverage(
  point: GeoPoint,
  polygons: ZoneGeometry[],
  kitchen: GeoPoint = MERCHANT_KITCHEN,
  maxMeters: number = MAX_DELIVERY_METERS,
): Coverage & { deliverable: boolean } {
  const coverage = resolveCoverage(point, polygons, kitchen)
  return {
    ...coverage,
    deliverable: coverage.zone !== null && coverage.distanceMeters <= maxMeters,
  }
}

/**
 * Ganti poligon yang bentuknya tidak valid (mis. sisa state lama dengan
 * koordinat gambar) dengan bentuk awal, supaya layar tidak menghitung NaN.
 */
export function normalizeZones(polygons: ZoneGeometry[]): ZoneGeometry[] {
  return masterZoneGeometry.map((seed) => {
    const vertices = polygons.find((polygon) => polygon.id === seed.id)?.vertices
    if (!vertices || vertices.length < 3) return seed
    const valid = vertices.every(
      (vertex) => Number.isFinite(vertex?.lat) && Number.isFinite(vertex?.lng),
    )
    return valid ? { ...seed, vertices } : seed
  })
}

/** Luas poligon dalam km², dihitung di ruang meter supaya angkanya berarti. */
export function zoneAreaKm2(vertices: GeoPoint[]): number {
  if (vertices.length < 3) return 0
  const centerLat = vertices.reduce((sum, vertex) => sum + vertex.lat, 0) / vertices.length
  const cos = Math.cos((centerLat * Math.PI) / 180)
  const points = vertices.map((vertex) => ({
    x: vertex.lng * M_PER_DEG_LNG * cos,
    y: vertex.lat * M_PER_DEG_LAT,
  }))
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum / 2) / 1_000_000
}

/* ── Proyeksi kanvas ─────────────────────────────────────────────────────────
 * Kanvas persegi, skala seragam di kedua sumbu, jadi lingkaran radius 2 km tetap
 * terlihat sebagai lingkaran (bukan lonjong). Proyeksi equirectangular dengan
 * koreksi cos(lat) cukup untuk area beberapa kilometer.
 */

export interface ZoneView {
  centerLat: number
  centerLng: number
  /** Lebar pandang dalam derajat lintang. */
  span: number
  cos: number
}

/** Pandang yang memuat semua poligon dan titik acuan (dapur + alamat demo). */
export function zoneView(
  polygons: ZoneGeometry[],
  points: GeoPoint[] = [],
  padding = 1.3,
): ZoneView {
  const all = [...polygons.flatMap((polygon) => polygon.vertices), ...points]
  const lats = all.map((point) => point.lat)
  const lngs = all.map((point) => point.lng)
  const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
  const cos = Math.cos((centerLat * Math.PI) / 180)
  const spanLat = Math.max(...lats) - Math.min(...lats)
  const spanLng = (Math.max(...lngs) - Math.min(...lngs)) * cos
  return { centerLat, centerLng, span: Math.max(spanLat, spanLng, 0.001) * padding, cos }
}

/** Lat/lng → koordinat kanvas 0..100 (y dibalik: utara di atas). */
export function projectPoint(point: GeoPoint, view: ZoneView): { x: number; y: number } {
  return {
    x: 50 + (((point.lng - view.centerLng) * view.cos) / view.span) * 100,
    y: 50 - ((point.lat - view.centerLat) / view.span) * 100,
  }
}

/** Koordinat kanvas 0..100 → lat/lng (kebalikan `projectPoint`). */
export function unprojectPoint(point: { x: number; y: number }, view: ZoneView): GeoPoint {
  return {
    lng: view.centerLng + (((point.x - 50) / 100) * view.span) / view.cos,
    lat: view.centerLat - ((point.y - 50) / 100) * view.span,
  }
}

/** Meter per satuan kanvas, dipakai menggambar lingkaran radius 2 km. */
export function metersPerUnit(view: ZoneView): number {
  return (view.span * M_PER_DEG_LAT) / 100
}

/** Radius jangkauan merchant dalam satuan kanvas. */
export function kitchenRadiusUnits(view: ZoneView): number {
  return MAX_DELIVERY_METERS / metersPerUnit(view)
}
