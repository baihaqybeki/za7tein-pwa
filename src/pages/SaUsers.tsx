import { ChevronRight, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'

import { MoneyPair } from '../components/ui/MoneyPair'
import { tenantStatusLabel } from '../data/admin'
import { courierTasks } from '../data/courier'
import { jodToIdr } from '../data/currency'
import { merchantOrders } from '../data/merchantOrders'
import { customerStatusLabel } from '../data/people'
import {
  courierCountFor,
  disputeCountAsMerchant,
  disputeCountForCustomer,
  hasRiskFlag,
  ledgerCountFor,
  merchantNameFor,
  orderCountFor,
} from '../data/registry'
import { SuperAdminShell } from '../components/layout/SuperAdminShell'
import { BottomSheet } from '../components/ui/BottomSheet'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import { updateCourier, updateCustomer, updateMerchant } from '../store/slices/adminSlice'
import toast from 'react-hot-toast'

type UserTab = 'customer' | 'merchant' | 'courier'

/**
 * Registri pengguna: customer, merchant, dan kurir.
 *
 * Halaman ini ada karena sebelumnya **tidak ada pendataan pengguna sama sekali**:
 * customer dan merchant hanya hidup sebagai satu objek contoh milik sesi yang
 * sedang login, nama customer tersebar sebagai string di order, dan ledger tidak
 * menyimpan pihaknya. Jadi pertanyaan dasar owner — "siapa saja pengguna kita,
 * dan apa yang terjadi pada orang ini" — tidak punya tempat untuk dijawab.
 *
 * Satu tipe tampil sekaligus, dipilih lewat chip, bukan tiga tabel bertumpuk:
 * dengan 8 + 3 + 6 baris, menumpuk ketiganya memaksa pemilik menggulir untuk
 * sampai ke kurir, padahal ketiga daftar tidak pernah dibaca bersamaan. Baris
 * chip-nya pola yang sama dengan Ledger, Audit, dan Pajak.
 *
 * Semua angkanya turunan dari data yang sudah ada (`src/data/registry.ts`), bukan
 * angka baru. Halaman ini **read-only**: tidak ada aksi di sini, karena mengubah
 * status pengguna adalah kerja panel CS (`/admin/*`) dan SA mengawasinya lewat
 * audit trail.
 */
export default function SaUsers() {
  const merchants = useAppSelector((s) => s.admin.merchants)
  const customers = useAppSelector((s) => s.admin.customers)
  const couriers = useAppSelector((s) => s.admin.couriers)
  const [edit, setEdit] = useState<{ tab: UserTab; id: string; form: Record<string, string> } | null>(null)
  const disputes = useAppSelector((s) => s.admin.disputes)
  const ledger = useAppSelector((s) => s.admin.ledger)
  const riskFlags = useAppSelector((s) => s.admin.customerRiskFlags)
  const [tab, setTab] = useState<UserTab>('customer')
  const [query, setQuery] = useState('')

  const needle = query.trim().toLowerCase()
  const match = (...fields: string[]) =>
    !needle || fields.join(' ').toLowerCase().includes(needle)

  const shownCustomers = customers.filter((customer) =>
    match(customer.name, customer.phone, customer.id),
  )
  const shownMerchants = merchants.filter((merchant) =>
    match(merchant.name, merchant.owner, merchant.ownerPhone, merchant.city, merchant.id),
  )
  const shownCouriers = couriers.filter((courier) =>
    match(
      courier.name,
      courier.phone,
      merchantNameFor(merchants, courier.merchantId) ?? '',
      courier.id,
    ),
  )

  const TABS: { id: UserTab; label: string; total: number; shown: number }[] = [
    { id: 'customer', label: 'Customer', total: customers.length, shown: shownCustomers.length },
    { id: 'merchant', label: 'Merchant', total: merchants.length, shown: shownMerchants.length },
    { id: 'courier', label: 'Kurir', total: couriers.length, shown: shownCouriers.length },
  ]

  const active = TABS.find((item) => item.id === tab) ?? TABS[0]

  return (
    <SuperAdminShell>
      <section className="sa-card">
        <div className="sa-card-head">
          <div>
            <p className="sa-card-label">Registri pengguna</p>
            <p className="sa-card-sub">
              {active.shown} dari {active.total} {active.label.toLowerCase()} · tanpa aksi, hanya
              baca
            </p>
          </div>
          <label className="sa-search">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="sa-sr">Cari nama, nomor, atau id</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari nama, nomor, atau id…"
            />
          </label>
        </div>

        <div className="sa-filters" role="group" aria-label="Pilih tipe pengguna">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`sa-filter${tab === item.id ? ' is-active' : ''}`}
              aria-pressed={tab === item.id}
              onClick={() => setTab(item.id)}
            >
              {item.label} ({item.total})
            </button>
          ))}
        </div>

        {tab === 'customer' ? (
          <>
            {shownCustomers.length === 0 ? (
              <p className="sa-empty">Tidak ada customer yang cocok.</p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th scope="col">Nama</th>
                      <th scope="col">Nomor WA</th>
                      <th scope="col">Status</th>
                      <th scope="col">Gabung</th>
                      <th scope="col">Order</th>
                      <th scope="col">Sengketa</th>
                      <th scope="col">Ledger</th>
                      <th scope="col">Risiko</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          {customer.name}
                          <span className="sa-table-sub">{customer.id}</span>
                          <button
                            type="button"
                            className="sa-btn sa-btn--small"
                            onClick={() => setEdit({ tab: 'customer', id: customer.id, form: { name: customer.name, phone: customer.phone } })}
                          >
                            Edit
                          </button>
                        </td>
                        <td className="sa-nowrap">
                          {customer.phone}
                          {customer.phoneVerified ? null : (
                            <span className="sa-table-sub">belum verifikasi</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`sa-chip${
                              customer.status === 'active' ? ' is-ok' : ' is-off'
                            }`}
                          >
                            {customerStatusLabel[customer.status]}
                          </span>
                        </td>
                        <td className="sa-nowrap">{customer.joinedAt}</td>
                        <td>{orderCountFor(merchantOrders, customer.id)}</td>
                        <td>{disputeCountForCustomer(disputes, customer.id)}</td>
                        <td>{ledgerCountFor(ledger, 'customer', customer.id)}</td>
                        <td>
                          {hasRiskFlag(riskFlags, customer.id) ? (
                            <span className="sa-chip is-off">Flagged</span>
                          ) : (
                            <span className="sa-chip is-muted">Bersih</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="sa-note">
              {courierTasks.length} tugas pengantaran menyebut customer di tabel ini lewat{' '}
              <code className="sa-code">customerId</code>, dan {riskFlags.length} flag risiko
              tercatat. Alamat lengkap tidak ditampilkan di sini — ia milik profil customer, bukan
              registri platform.
            </p>
          </>
        ) : null}

        {tab === 'merchant' ? (
          <>
            {shownMerchants.length === 0 ? (
              <p className="sa-empty">Tidak ada merchant yang cocok.</p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th scope="col">Merchant</th>
                      <th scope="col">Pemilik</th>
                      <th scope="col">Status</th>
                      <th scope="col">Deposit</th>
                      <th scope="col">COD</th>
                      <th scope="col">Kurir</th>
                      <th scope="col">Sengketa</th>
                      <th scope="col">Ledger</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownMerchants.map((merchant) => (
                      <tr key={merchant.id}>
                        <td>
                          {/* Nama merchant sekaligus aksinya. Kolom Aksi
                              terpisah tidak muat: tabel ini sudah penuh di
                              1280px, jadi kolom ke-10 memecah nama jadi tiga
                              baris (tinggi baris 57px → 126px). */}
                          <Link
                            className="sa-cell-link"
                            to={`/users/merchant/${merchant.id}`}
                            title={`Detail merchant ${merchant.name}`}
                          >
                            <span className="sa-cell-link-copy">
                              {merchant.name}
                              <span className="sa-table-sub">
                                {merchant.id} · paket {merchant.tier}
                              </span>
                            </span>
                            <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                          </Link>
                          <button
                            type="button"
                            className="sa-btn sa-btn--small"
                            onClick={() => setEdit({ tab: 'merchant', id: merchant.id, form: { name: merchant.name, owner: merchant.owner, ownerPhone: merchant.ownerPhone, city: merchant.city } })}
                          >
                            Edit
                          </button>
                        </td>
                        <td>
                          {merchant.owner}
                          <span className="sa-table-sub">
                            {merchant.ownerPhone || 'kontak belum diisi'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`sa-chip${
                              merchant.tenantStatus === 'approved' ? ' is-ok' : ' is-off'
                            }`}
                          >
                            {tenantStatusLabel[merchant.tenantStatus]}
                          </span>
                          {merchant.statusReason ? (
                            <span className="sa-table-sub">{merchant.statusReason}</span>
                          ) : null}
                        </td>
                        <td className="sa-nowrap">
                          <MoneyPair idr={jodToIdr(merchant.deposit)} />
                        </td>
                        <td>{merchant.codIssues}×</td>
                        <td>{courierCountFor(couriers, merchant.id)}</td>
                        <td>{disputeCountAsMerchant(disputes, merchant.id)}</td>
                        <td>{ledgerCountFor(ledger, 'merchant', merchant.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="sa-note">
              Tenant yang masih menunggu review belum masuk registri — ia belum merchant.
              Antreannya ada di panel CS (<code className="sa-code">/admin/onboarding</code>) dan
              terlihat di sini lewat audit trail.
            </p>
          </>
        ) : null}

        {tab === 'courier' ? (
          <>
            {shownCouriers.length === 0 ? (
              <p className="sa-empty">Tidak ada kurir yang cocok.</p>
            ) : (
              <div className="sa-table-wrap">
                <table className="sa-table">
                  <thead>
                    <tr>
                      <th scope="col">Nama</th>
                      <th scope="col">Nomor</th>
                      <th scope="col">Merchant</th>
                      <th scope="col">Gabung</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownCouriers.map((courier) => (
                      <tr key={courier.id}>
                        <td>
                          {courier.name}
                          <span className="sa-table-sub">{courier.id}</span>
                          <button
                            type="button"
                            className="sa-btn sa-btn--small"
                            onClick={() => setEdit({ tab: 'courier', id: courier.id, form: { name: courier.name, phone: courier.phone } })}
                          >
                            Edit
                          </button>
                        </td>
                        <td className="sa-nowrap">
                          {courier.phone}
                          {courier.phoneVerified ? null : (
                            <span className="sa-table-sub">belum verifikasi</span>
                          )}
                        </td>
                        <td>
                          {merchantNameFor(merchants, courier.merchantId) ?? courier.merchantId}
                        </td>
                        <td className="sa-nowrap">{courier.joinedAt}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="sa-note">
              Kurir dipekerjakan merchant, bukan platform: deposit, earnings, dan blacklist-nya
              tanggung jawab merchant (PRD <code className="sa-code">source.md:296</code>). Daftar
              lintas merchant ini keputusan PO 2026-09-23 supaya SA bisa mengawasi — bukan untuk
              mengelola kurir.
            </p>
            <p className="sa-note">
              Tidak ada kolom status live (Di toko / Mengantar) maupun beban order berjalan di sini:
              itu papan pantau merchant atas kurirnya sendiri (
              <code className="sa-code">/merchant/couriers</code>), dan tempatnya di sana. Yang
              dilihat SA adalah identitas, siapa yang mempekerjakan, dan berapa banyak kurir per
              merchant — angka di kolom Kurir tabel Merchant.
            </p>
          </>
        ) : null}
      </section>
      <EditUserSheet key={edit?.id ?? 'none'} edit={edit} onClose={() => setEdit(null)} />
    </SuperAdminShell>
  )
}

type EditTarget = { tab: UserTab; id: string; form: Record<string, string> } | null

const EDIT_FIELDS: Record<UserTab, [string, string][]> = {
  customer: [['name', 'Nama'], ['phone', 'Nomor WA']],
  merchant: [['name', 'Nama'], ['owner', 'Pemilik'], ['ownerPhone', 'Nomor WA'], ['city', 'Kota']],
  courier: [['name', 'Nama'], ['phone', 'Nomor']],
}

/** Sheet edit satu baris registri pengguna (customer/merchant/kurir). */
function EditUserSheet({ edit, onClose }: { edit: EditTarget; onClose: () => void }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState<Record<string, string>>(edit?.form ?? {})
  if (!edit) return null
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    if (edit.tab === 'customer') dispatch(updateCustomer({ id: edit.id, patch: { name: form.name, phone: form.phone } }))
    else if (edit.tab === 'merchant') dispatch(updateMerchant({ id: edit.id, patch: { name: form.name, owner: form.owner, ownerPhone: form.ownerPhone, city: form.city } }))
    else dispatch(updateCourier({ id: edit.id, patch: { name: form.name, phone: form.phone } }))
    toast.success('Pengguna disimpan')
    onClose()
  }

  return (
    <BottomSheet open title={`Edit ${edit.tab}`} onClose={onClose}>
      {EDIT_FIELDS[edit.tab].map(([key, label]) => (
        <label key={key} className="sa-field">
          <span>{label}</span>
          <input value={form[key] ?? ''} onChange={(e) => set(key, e.target.value)} />
        </label>
      ))}
      <div className="sa-actions">
        <button type="button" className="sa-btn sa-btn--primary" onClick={save}>Simpan</button>
      </div>
    </BottomSheet>
  )
}
