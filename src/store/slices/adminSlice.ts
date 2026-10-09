import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import {
  adminDisputes as seedDisputes,
  adminEscalations as seedEscalations,
  adminLedger as seedLedger,
  adminMerchants as seedMerchants,
  adminTenants as seedTenants,
  ledgerEntryFor,
  mockLiability,
} from '../../data/admin'
import { merchantFromTenant, couriers as seedCouriers } from '../../data/merchant'
import { customers as seedCustomers } from '../../data/people'
import type {
  AdminEscalation,
  AppealVerdict,
  AdminTenant,
  Courier,
  Customer,
  CustomerRiskFlag,
  Dispute,
  DisputeResolution,
  LedgerEntry,
  LiabilitySummary,
  MerchantRecord,
} from '../../types'

interface AdminState {
  tenants: AdminTenant[]
  merchants: MerchantRecord[]
  /** Registri pengguna untuk konsol SA (`/superadmin/users`). */
  customers: Customer[]
  couriers: Courier[]
  disputes: Dispute[]
  ledger: LedgerEntry[]
  liability: LiabilitySummary
  escalations: AdminEscalation[]
  /**
   * `customer.riskFlag` — sisi kedua blacklist COD, wajib bareng merchant (F15).
   * Disimpan dengan `customerId`, bukan nama: dulu `{ id, name }` sehingga flag
   * tidak bisa ditautkan ke akun customer mana pun.
   */
  customerRiskFlags: CustomerRiskFlag[]
}

const initialState: AdminState = {
  tenants: seedTenants,
  merchants: seedMerchants,
  customers: seedCustomers,
  couriers: seedCouriers,
  disputes: seedDisputes,
  ledger: seedLedger,
  liability: mockLiability,
  escalations: seedEscalations,
  customerRiskFlags: [],
}

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    /**
     * Approve deposit = verifikasi transfer masuk dulu: `unpaid → held`, baru
     * `tenantStatus: approved`. Merchant aktif lalu masuk daftar pantau.
     */
    approveDeposit(state, action: PayloadAction<{ id: string }>) {
      const tenant = state.tenants.find((t) => t.id === action.payload.id)
      if (!tenant || tenant.depositStatus !== 'unpaid') return
      tenant.depositStatus = 'held'
      tenant.tenantStatus = 'approved'
      state.merchants.push(merchantFromTenant(tenant))
    },
    /** Onboarding ditolak → `tenantStatus: suspended`, merchant tidak aktif. */
    rejectOnboarding(state, action: PayloadAction<{ id: string }>) {
      const tenant = state.tenants.find((t) => t.id === action.payload.id)
      if (tenant) tenant.tenantStatus = 'suspended'
    },
    /**
     * Suspend merchant. Dipanggil dua konsol: panel CS (`/admin/merchants`) dan
     * dossier SA (`/superadmin/users/merchant/:id`). `by` hanya untuk atribusi —
     * jembatan audit memakainya supaya aksi SA tidak tercatat atas nama CS, dan
     * alasan yang ditulis ikut menyebut pelakunya.
     */
    suspendMerchant(state, action: PayloadAction<{ id: string; by?: 'sa' | 'cs' }>) {
      const merchant = state.merchants.find((m) => m.id === action.payload.id)
      if (!merchant) return
      merchant.tenantStatus = 'suspended'
      merchant.statusReason =
        action.payload.by === 'sa'
          ? 'Di-suspend SA dari dossier merchant'
          : 'Di-suspend CS dari panel tenant'
    },
    /**
     * Aktifkan kembali merchant yang di-suspend. Hanya dari `suspended`:
     * `blacklisted` lahir dari pasangan dua sisi (merchant + riskFlag customer),
     * jadi mencabutnya harus menyentuh keduanya dan tetap kerja panel CS.
     */
    reinstateMerchant(state, action: PayloadAction<{ id: string }>) {
      const merchant = state.merchants.find((m) => m.id === action.payload.id)
      if (!merchant || merchant.tenantStatus !== 'suspended') return
      merchant.tenantStatus = 'approved'
      merchant.statusReason = null
    },
    /**
     * Blacklist COD menandai DUA sisi sekaligus: merchant `blacklisted` dan
     * customer dapat `riskFlag`. Keduanya dibutuhkan untuk memblokir checkout COD.
     *
     * Customer ditunjuk lewat `customerId` dari registri, bukan nama yang
     * diketik bebas: nama tidak bisa ditautkan ke akun, dan dua customer boleh
     * punya nama yang sama.
     */
    blacklistCod(
      state,
      action: PayloadAction<{ id: string; customerId: string; byOperatorId: string }>,
    ) {
      const merchant = state.merchants.find((m) => m.id === action.payload.id)
      if (!merchant) return
      merchant.tenantStatus = 'blacklisted'
      merchant.codIssues += 1
      state.customerRiskFlags.push({
        id: `rf-${action.payload.id}-${action.payload.customerId}`,
        customerId: action.payload.customerId,
        reason: 'COD bermasalah bersama merchant ini',
        at: 'Baru saja',
        byOperatorId: action.payload.byOperatorId,
      })
    },
    startInvestigation(state, action: PayloadAction<{ id: string }>) {
      const dispute = state.disputes.find((d) => d.id === action.payload.id)
      if (dispute) dispute.status = 'investigating'
    },
    /**
     * Putusan panel CS. Refund/release menambah satu entry ledger append-only (F8);
     * `no_action` tidak menambah entry karena tidak mengubah saldo.
     */
    resolveDispute(
      state,
      action: PayloadAction<{ id: string; resolution: DisputeResolution; percent?: number }>,
    ) {
      const dispute = state.disputes.find((d) => d.id === action.payload.id)
      if (!dispute) return
      const { resolution, percent } = action.payload
      dispute.resolution = resolution
      dispute.partialPercent = resolution === 'refund_partial' ? (percent ?? 50) : undefined
      dispute.status = resolution === 'no_action' ? 'rejected' : 'resolved'
      const entry = ledgerEntryFor(dispute, resolution, percent)
      if (entry) state.ledger.unshift(entry)
    },
    /** Form "Ajukan Sengketa" dari sisi customer/merchant masuk ke queue panel CS. */
    fileDispute(state, action: PayloadAction<Omit<Dispute, 'id' | 'status' | 'filedAt'>>) {
      state.disputes.unshift({
        ...action.payload,
        id: `dp-${Date.now()}`,
        status: 'open',
        filedAt: 'Baru saja',
      })
    },
    /** Alert SLA ditindak (chase merchant / cancel / refund) — keluar dari antrean. */
    clearEscalation(state, action: PayloadAction<{ id: string }>) {
      state.escalations = state.escalations.filter((e) => e.id !== action.payload.id)
    },
    /**
     * Ajukan banding ke SA setelah putusan level-1 CS (keputusan PO 2026-09-23).
     * Satu banding per sengketa, sama seperti satu sengketa per order, dan hanya
     * bisa diajukan setelah ada putusan. Siapa saja yang boleh mengajukan
     * (pengaju sengketa atau kedua pihak) belum diputuskan, jadi di sini hanya
     * pihak yang mengajukan sengketa.
     */
    requestAppeal(state, action: PayloadAction<{ id: string; note: string }>) {
      const dispute = state.disputes.find((d) => d.id === action.payload.id)
      if (!dispute || dispute.appeal) return
      if (dispute.status !== 'resolved' && dispute.status !== 'rejected') return
      dispute.appeal = {
        requestedAt: 'Baru saja',
        requestedBy: dispute.filedBy,
        note: action.payload.note.trim() || 'Tanpa catatan tambahan.',
      }
    },
    /**
     * Putusan banding SA atas putusan level-1 CS. `upheld` menguatkan putusan CS
     * tanpa mengubah saldo; `overturned` mengganti resolusi dan menambah satu
     * entry ledger baru (append-only — putusan lama tidak dihapus).
     */
    decideAppeal(
      state,
      action: PayloadAction<{ id: string; verdict: AppealVerdict; resolution?: DisputeResolution }>,
    ) {
      const dispute = state.disputes.find((d) => d.id === action.payload.id)
      if (!dispute || !dispute.appeal || dispute.appeal.verdict) return
      dispute.appeal.verdict = action.payload.verdict
      dispute.appeal.decidedAt = 'Baru saja'
      if (action.payload.verdict === 'overturned' && action.payload.resolution) {
        dispute.resolution = action.payload.resolution
        dispute.status = action.payload.resolution === 'no_action' ? 'rejected' : 'resolved'
        const entry = ledgerEntryFor(dispute, action.payload.resolution)
        if (entry) state.ledger.unshift({ ...entry, id: `${entry.id}-appeal` })
      }
    },
    /** Sunting registri merchant (konsol SA). */
    updateMerchant(state, action: PayloadAction<{ id: string; patch: Partial<MerchantRecord> }>) {
      const merchant = state.merchants.find((m) => m.id === action.payload.id)
      if (!merchant) return
      Object.assign(merchant, action.payload.patch)
    },
    updateCustomer(state, action: PayloadAction<{ id: string; patch: Partial<Customer> }>) {
      const customer = state.customers.find((c) => c.id === action.payload.id)
      if (!customer) return
      Object.assign(customer, action.payload.patch)
    },
    updateCourier(state, action: PayloadAction<{ id: string; patch: Partial<Courier> }>) {
      const courier = state.couriers.find((c) => c.id === action.payload.id)
      if (!courier) return
      Object.assign(courier, action.payload.patch)
    },
  },
})

export const {
  approveDeposit,
  rejectOnboarding,
  suspendMerchant,
  reinstateMerchant,
  blacklistCod,
  startInvestigation,
  resolveDispute,
  fileDispute,
  clearEscalation,
  requestAppeal,
  decideAppeal,
  updateMerchant,
  updateCustomer,
  updateCourier,
} = adminSlice.actions
export default adminSlice.reducer
