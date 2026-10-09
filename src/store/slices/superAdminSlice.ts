import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import {
  SA_CURRENT_ACTOR,
  mockProfit,
  mockSwitches,
  profitBalance,
  saAuditLog,
  saOperators,
  saRoles,
  switchMeta,
} from '../../data/superadmin'
import { masterZoneGeometry, normalizeZones } from '../../data/zones'
import type {
  AuditEntry,
  AuditKind,
  PlatformSwitches,
  ProfitState,
  SaOperator,
  SaRole,
  ZoneGeometry,
} from '../../types'

interface SuperAdminState {
  zones: ZoneGeometry[]
  roles: SaRole[]
  operators: SaOperator[]
  audit: AuditEntry[]
  profit: ProfitState
  switches: PlatformSwitches
  /** Operator SA yang sedang membuka konsol; menentukan izin dan nama di audit. */
  activeOperatorId: string
  /**
   * Operator CS yang sedang bertugas. Di produksi ini datang dari sesi CS; repo
   * ini tanpa auth, jadi ditetapkan dari konsol SA supaya aksi CS tidak semua
   * tercatat atas nama satu orang.
   */
  csActorId: string
}

const initialState: SuperAdminState = {
  zones: normalizeZones(masterZoneGeometry),
  roles: saRoles,
  operators: saOperators,
  audit: saAuditLog,
  profit: mockProfit,
  switches: mockSwitches,
  activeOperatorId: saOperators[0]?.id ?? '',
  csActorId: saOperators.find((operator) => operator.roleId.startsWith('cs'))?.id ?? '',
}

/** Nama operator SA yang sedang aktif, untuk dicatat di audit trail. */
function activeActorName(state: SuperAdminState): string {
  return (
    state.operators.find((operator) => operator.id === state.activeOperatorId)?.name ??
    SA_CURRENT_ACTOR.name
  )
}

/**
 * Catat satu aksi ke audit trail. Semua aksi konsol lewat sini supaya tidak ada
 * jalur yang lolos dari pengawasan (keputusan PO 2026-09-23). Aksi CS masuk
 * lewat `logAudit` yang dikirim jembatan audit di `src/store/index.ts`.
 */
function push(
  state: SuperAdminState,
  actor: { id: string | null; name: string; role: 'sa' | 'cs' },
  kind: AuditKind,
  action: string,
  target: string,
) {
  state.audit.unshift({
    id: `au-${Date.now()}-${state.audit.length}`,
    at: 'Baru saja',
    actor: actor.name,
    actorId: actor.id,
    actorRole: actor.role,
    kind,
    action,
    target,
  })
}

/**
 * Aksi konsol SA selalu tercatat atas nama operator yang sedang aktif — id-nya
 * ikut dicatat, bukan hanya namanya, supaya baris audit bisa ditautkan ke akun.
 */
function pushAsActive(state: SuperAdminState, kind: AuditKind, action: string, target: string) {
  push(state, { id: state.activeOperatorId, name: activeActorName(state), role: 'sa' }, kind, action, target)
}

const superAdminSlice = createSlice({
  name: 'superAdmin',
  initialState,
  reducers: {
    /** Ganti operator yang sedang memakai konsol (demo pengganti sesi auth). */
    setActiveOperator(state, action: PayloadAction<{ id: string }>) {
      if (!state.operators.some((operator) => operator.id === action.payload.id)) return
      state.activeOperatorId = action.payload.id
    },
    /** Tentukan operator CS yang sedang bertugas, dasar atribusi audit CS. */
    setCsActor(state, action: PayloadAction<{ id: string }>) {
      if (!state.operators.some((operator) => operator.id === action.payload.id)) return
      state.csActorId = action.payload.id
    },
    /** Simpan poligon zona hasil geser titik (master zona milik SA). */
    saveZone(state, action: PayloadAction<{ id: ZoneGeometry['id']; vertices: ZoneGeometry['vertices'] }>) {
      const zone = state.zones.find((z) => z.id === action.payload.id)
      if (!zone) return
      zone.vertices = action.payload.vertices
      pushAsActive(state, 'zone', 'Simpan poligon zona', `${zone.label}, ${zone.note}`)
    },
    resetZone(state, action: PayloadAction<{ id: ZoneGeometry['id'] }>) {
      const zone = state.zones.find((z) => z.id === action.payload.id)
      const seed = masterZoneGeometry.find((z) => z.id === action.payload.id)
      if (!zone || !seed) return
      zone.vertices = seed.vertices
      pushAsActive(state, 'zone', 'Kembalikan poligon ke bentuk awal', zone.label)
    },
    /**
     * Cabut/beri satu izin pada sebuah role. Role pemilik platform (`locked`)
     * tidak bisa diubah dari UI — kalau bisa, satu klik salah akan mengunci
     * seluruh konsol.
     */
    togglePermission(state, action: PayloadAction<{ roleId: string; permissionId: string }>) {
      const role = state.roles.find((r) => r.id === action.payload.roleId)
      if (!role || role.locked) return
      const { permissionId } = action.payload
      const has = role.permissionIds.includes(permissionId)
      role.permissionIds = has
        ? role.permissionIds.filter((id) => id !== permissionId)
        : [...role.permissionIds, permissionId]
      pushAsActive(state, 'role',
        has ? 'Cabut izin dari role' : 'Beri izin ke role',
        `${role.name}, ${permissionId}`,
      )
    },
    /** Akun operator (termasuk operator CS) dibuat SA, bukan self-service (OQ-30). */
    addOperator(state, action: PayloadAction<{ name: string; contact: string; roleId: string }>) {
      const role = state.roles.find((r) => r.id === action.payload.roleId)
      if (!role) return
      state.operators.push({
        id: `op-${Date.now()}`,
        name: action.payload.name,
        contact: action.payload.contact,
        roleId: role.id,
        createdAt: 'Baru saja',
        status: 'invited',
      })
      pushAsActive(state, 'operator', 'Buat akun operator', `${action.payload.name}, ${role.name}`)
    },
    setOperatorStatus(state, action: PayloadAction<{ id: string; status: SaOperator['status'] }>) {
      const operator = state.operators.find((o) => o.id === action.payload.id)
      if (!operator) return
      operator.status = action.payload.status
      pushAsActive(state, 'operator',
        action.payload.status === 'active' ? 'Aktifkan operator' : 'Nonaktifkan operator',
        operator.name,
      )
    },
    /** Sunting profil operator: nama, kontak, role. */
    updateOperator(state, action: PayloadAction<{ id: string; name: string; contact: string; roleId: string }>) {
      const operator = state.operators.find((o) => o.id === action.payload.id)
      const role = state.roles.find((r) => r.id === action.payload.roleId)
      if (!operator || !role) return
      operator.name = action.payload.name
      operator.contact = action.payload.contact
      operator.roleId = role.id
      pushAsActive(state, 'operator', 'Ubah profil operator', operator.name)
    },
    /** Sunting label & catatan zona (poligon lewat `saveZone`). */
    updateZoneMeta(state, action: PayloadAction<{ id: ZoneGeometry['id']; label: string; note: string }>) {
      const zone = state.zones.find((z) => z.id === action.payload.id)
      if (!zone) return
      zone.label = action.payload.label
      zone.note = action.payload.note
      pushAsActive(state, 'zone', 'Ubah label zona', zone.label)
    },
    /**
     * Tarik saldo keuntungan platform — satu-satunya dana yang boleh ditarik SA.
     * Saldo customer/merchant/tips tidak pernah masuk hitungan ini.
     */
    withdrawProfit(state, action: PayloadAction<{ amountJod: number; method: string }>) {
      const { amountJod, method } = action.payload
      const balance = profitBalance(state.profit)
      if (amountJod <= 0 || amountJod > balance) return
      state.profit.withdrawals.unshift({
        id: `pw-${Date.now()}`,
        at: 'Baru saja',
        amountJod,
        method,
        status: 'processing',
      })
      pushAsActive(state, 'profit', 'Tarik saldo keuntungan platform', `${amountJod} JOD`)
    },
    toggleSwitch(state, action: PayloadAction<{ key: keyof PlatformSwitches }>) {
      const { key } = action.payload
      state.switches[key] = !state.switches[key]
      const label = switchMeta.find((meta) => meta.key === key)?.label ?? key
      pushAsActive(state, 'switch',
        state.switches[key] ? 'Nyalakan jalur' : 'Hentikan jalur',
        label,
      )
    },
    /**
     * Dipakai jembatan audit untuk aksi panel CS (`/admin/*`), supaya kerja CS
     * ikut terekam tanpa mengubah satu per satu halaman CS. `role` diisi `sa`
     * untuk aksi yang dijalankan SA lewat slice CS (mis. putusan banding).
     */
    logAudit(
      state,
      action: PayloadAction<{
        actor: string
        /** `SaOperator.id` pelaku; `null` untuk aksi sistem. */
        actorId: string | null
        role?: 'sa' | 'cs'
        kind: AuditKind
        action: string
        target: string
      }>,
    ) {
      push(
        state,
        { id: action.payload.actorId, name: action.payload.actor, role: action.payload.role ?? 'cs' },
        action.payload.kind,
        action.payload.action,
        action.payload.target,
      )
    },
  },
})

export const {
  setActiveOperator,
  setCsActor,
  saveZone,
  resetZone,
  togglePermission,
  addOperator,
  setOperatorStatus,
  updateOperator,
  updateZoneMeta,
  withdrawProfit,
  toggleSwitch,

  logAudit,
} = superAdminSlice.actions
export default superAdminSlice.reducer

export type { SuperAdminState, SaRole }
