import { ArrowLeft, Ban, Bike, BookOpen, CheckCircle2, Clock, Scale, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'react-hot-toast'
import { Link, useParams } from 'react-router-dom'

import { SuperAdminShell } from '../components/layout/SuperAdminShell'
import { BottomSheet } from '../components/ui/BottomSheet'
import {
  adminEscalations,
  depositStatusLabel,
  disputeStatusLabel,
  ledgerTypeLabel,
  moneyFromJod,
  tenantStatusLabel,
} from '../data/admin'
import { jod } from '../data/currency'
import { couriers } from '../data/merchant'
import {
  couriersForMerchant,
  disputesForMerchant,
  escalationsForMerchant,
  ledgerForParty,
} from '../data/registry'
import { permissionLabel, roleForOperator, roleHasPermission } from '../data/superadmin'
import { useAppDispatch, useAppSelector } from '../hooks/useAppStore'
import type { MerchantRecord } from '../types'
import { reinstateMerchant, suspendMerchant, updateMerchant } from '../store/slices/adminSlice'

/**
 * Dossier satu merchant, plus kewenangan SA atas tenantnya.
 *
 * Registri pengguna menjawab "siapa saja merchant kita dan berapa angkanya".
 * Layar ini menjawab pertanyaan berikutnya: "merchant ini sebenarnya
 * bagaimana". Tanpa itu pengawasan berhenti di angka agregat, tidak ada cara
 * melihat kurir siapa yang dipekerjakan, sengketa apa yang menimpanya, uangnya
 * masuk entry ledger yang mana, dan alert SLA mana yang naik ke SA.
 *
 * Komposisi (satu alasan per keputusan, QL-01):
 * - **Hero dua kolom** (`.sa-hero--money`): identitas di kolom lebar, deposit
 *   yang ditahan platform di kolom sempit. Nama merchant jadi fokus pertama
 *   karena inilah halaman tentang satu orang, bukan satu daftar.
 * - **Strip empat tile** (`.sa-stats`): kurir, sengketa, entry ledger, alert
 *   SLA. Angka-angka itu sebelumnya terkubur di daftar nilai; di sini ia jadi
 *   ringkasan sekaligus indeks, tiap tile menaut ke section-nya sendiri.
 * - **Section selalu ada empat**, termasuk saat kosong: tile di atas menaut ke
 *   `#kurir`, `#sengketa`, `#ledger`, `#sla`, jadi targetnya tidak boleh
 *   hilang. Empty state juga kabar ("tidak ada alert SLA" itu baik).
 * - **SLA pakai feed, bukan tabel.** Ia peristiwa berurutan, bukan data
 *   bertabular; tabel keempat yang bentuknya sama hanya jadi pengulangan.
 *
 * **Kewenangan SA atas tenant** (keputusan PO 2026-09-23, lanjutan). Suspend dan
 * aktifkan kembali dijalankan dari sini lewat izin `tenant.status`, dan
 * tercatat di audit trail atas nama operator yang sedang aktif — bukan atas
 * nama CS, karena tombolnya sama dengan tombol CS tapi pelakunya berbeda.
 * Yang tetap milik CS: approval onboarding dan blacklist COD. Blacklist
 * menandai dua sisi sekaligus (merchant + riskFlag customer), jadi mencabutnya
 * harus menyentuh keduanya dan tetap dikerjakan dari panel CS.
 *
 * Isinya turunan dari modul lain (`src/data/registry.ts`), bukan angka baru.
 * Daftar kurir sengaja hanya identitas: status live kurir papan pantau merchant
 * (`/merchant/couriers`), bukan pengawasan platform.
 */
export default function SaMerchantDetail() {
  const dispatch = useAppDispatch()
  const { id = '' } = useParams()
  const merchants = useAppSelector((s) => s.admin.merchants)
  const disputes = useAppSelector((s) => s.admin.disputes)
  const ledger = useAppSelector((s) => s.admin.ledger)
  // Izin ditegakkan di tombolnya, bukan hanya di rutenya: `user.read` cukup
  // untuk membuka dossier, tapi tidak cukup untuk mengubah status tenant.
  const operators = useAppSelector((s) => s.superAdmin.operators)
  const roles = useAppSelector((s) => s.superAdmin.roles)
  const activeOperatorId = useAppSelector((s) => s.superAdmin.activeOperatorId)
  const activeRole = roleForOperator(
    roles,
    operators.find((operator) => operator.id === activeOperatorId) ?? operators[0],
  )
  const canChangeStatus = roleHasPermission(activeRole, 'tenant.status')
  const [pendingAction, setPendingAction] = useState<'suspend' | 'reinstate' | null>(null)

  const merchant = merchants.find((item) => item.id === id)

  if (!merchant) {
    return (
      <SuperAdminShell>
        <section className="sa-card">
          <p className="sa-card-label">
            <TriangleAlert size={14} strokeWidth={1.75} aria-hidden="true" />
            Merchant tidak ditemukan
          </p>
          <p className="sa-card-title">Id {id || '(kosong)'} tidak ada di registri</p>
          <p className="sa-card-sub">
            Mungkin id-nya salah ketik, atau tenant-nya masih menunggu review sehingga belum masuk
            registri.
          </p>
          <Link className="sa-link" to="/users">
            <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
            Kembali ke registri pengguna
          </Link>
        </section>
      </SuperAdminShell>
    )
  }

  const merchantCouriers = couriersForMerchant(couriers, merchant.id)
  const merchantDisputes = disputesForMerchant(disputes, merchant.id)
  const entries = ledgerForParty(ledger, 'merchant', merchant.id)
  const escalations = escalationsForMerchant(adminEscalations, merchant.id)
  const zones = [merchant.isActiveHijazi ? 'Hijazi' : '', merchant.isActiveSyimali ? 'Syimali' : '']
    .filter(Boolean)
    .join(' + ')

  const summary = [
    { id: 'kurir', label: 'Kurir dipekerjakan', value: merchantCouriers.length, icon: Bike },
    { id: 'sengketa', label: 'Sengketa', value: merchantDisputes.length, icon: Scale },
    { id: 'ledger', label: 'Entry ledger', value: entries.length, icon: BookOpen },
    { id: 'sla', label: 'Alert SLA', value: escalations.length, icon: Clock },
  ]

  return (
    <SuperAdminShell>
      <Link className="sa-link" to="/users">
        <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
        Registri pengguna
      </Link>

      <MerchantEditCard merchant={merchant} />

      <section className="sa-hero sa-hero--money">
        <article className="sa-card">
          <div className="sa-card-head">
            <div>
              <p className="sa-card-label">Merchant</p>
              <h2 className="sa-card-value">{merchant.name}</h2>
              <p className="sa-card-sub">
                {merchant.id} · {merchant.owner} · {merchant.city} · paket {merchant.tier}
              </p>
            </div>
            <span
              className={`sa-chip${merchant.tenantStatus === 'approved' ? ' is-ok' : ' is-off'}`}
            >
              {tenantStatusLabel[merchant.tenantStatus]}
            </span>
          </div>
          {merchant.statusReason ? (
            <p className="sa-note">Alasan status: {merchant.statusReason}</p>
          ) : null}
          <ul className="sa-kv">
            <li>
              <span>Pemilik</span>
              <span>{merchant.owner}</span>
            </li>
            <li>
              <span>Nomor WA pemilik</span>
              <span>{merchant.ownerPhone || 'kontak belum diisi'}</span>
            </li>
            <li>
              <span>Bergabung</span>
              <span>{merchant.joinedAt}</span>
            </li>
            <li>
              <span>Disetujui</span>
              <span>{merchant.approvedAt ?? 'belum'}</span>
            </li>
          </ul>
          {/* Aksi duduk di kartu yang menjelaskan keadaannya, sama seperti kill
              switch. Tombolnya mengikuti status, jadi tidak pernah ada tombol
              yang tidak ada gunanya. */}
          {!canChangeStatus ? (
            <p className="sa-note">
              Role aktif tidak punya izin <strong>{permissionLabel('tenant.status')}</strong>.
              Tambahkan di Role &amp; operator, atau ganti operator di sidebar.
            </p>
          ) : merchant.tenantStatus === 'approved' ? (
            <div className="sa-actions">
              <button
                type="button"
                className="sa-btn sa-btn--danger"
                onClick={() => setPendingAction('suspend')}
              >
                <Ban size={16} strokeWidth={1.75} aria-hidden="true" />
                Suspend tenant
              </button>
            </div>
          ) : merchant.tenantStatus === 'suspended' ? (
            <div className="sa-actions">
              <button
                type="button"
                className="sa-btn sa-btn--primary"
                onClick={() => setPendingAction('reinstate')}
              >
                <CheckCircle2 size={16} strokeWidth={1.75} aria-hidden="true" />
                Aktifkan kembali
              </button>
            </div>
          ) : (
            <p className="sa-note">
              {merchant.tenantStatus === 'blacklisted'
                ? 'Blacklist COD menandai dua sisi sekaligus, merchant dan riskFlag customer. Mencabutnya harus menyentuh keduanya, jadi tetap kerja panel CS.'
                : 'Tenant ini belum di-approve. Approval onboarding tetap kerja panel CS.'}
            </p>
          )}
        </article>

        <article className="sa-card sa-card--glow">
          <p className="sa-card-label">Deposit ditahan platform</p>
          <p className="sa-card-value">{moneyFromJod(merchant.deposit)}</p>
          {/* Chip, bukan baris teks: keadaan deposit adalah status, dan konsol
              memakai chip untuk status di seluruh layar lain. Tone mengikuti
              akibatnya, `unpaid` satu-satunya yang berarti ada yang kurang. */}
          <span
            className={`sa-chip ${
              merchant.depositStatus === 'unpaid'
                ? 'is-off'
                : merchant.depositStatus === 'released'
                  ? 'is-muted'
                  : 'is-ok'
            }`}
          >
            {depositStatusLabel[merchant.depositStatus]}
          </span>
          <ul className="sa-kv">
            <li>
              <span>Zona aktif</span>
              <span>{zones || 'belum ada'}</span>
            </li>
            <li>
              <span>COD bermasalah</span>
              <span>{merchant.codIssues}×</span>
            </li>
            <li>
              <span>Paket</span>
              <span>{merchant.tier}</span>
            </li>
          </ul>
        </article>
      </section>

      <section className="sa-stats" aria-label="Ringkasan pengawasan merchant">
        {summary.map((item) => (
          <a key={item.id} className="sa-stat" href={`#${item.id}`}>
            <item.icon size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="sa-stat-value">{item.value}</span>
            <span className="sa-stat-label">{item.label}</span>
          </a>
        ))}
      </section>

      <section className="sa-card" id="kurir">
        <p className="sa-card-label">
          <Bike size={14} strokeWidth={1.75} aria-hidden="true" />
          Kurir yang dipekerjakan
        </p>
        {merchantCouriers.length === 0 ? (
          <p className="sa-empty">Merchant ini belum punya kurir di registri.</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  <th scope="col">Nomor</th>
                  <th scope="col">Gabung</th>
                </tr>
              </thead>
              <tbody>
                {merchantCouriers.map((courier) => (
                  <tr key={courier.id}>
                    <td>
                      {courier.name}
                      <span className="sa-table-sub">{courier.id}</span>
                    </td>
                    <td className="sa-nowrap">
                      {courier.phone}
                      {courier.phoneVerified ? null : (
                        <span className="sa-table-sub">belum verifikasi</span>
                      )}
                    </td>
                    <td className="sa-nowrap">{courier.joinedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sa-note">
          Hanya identitas. Status live kurir (Di toko, Mengantar) adalah papan pantau merchant atas
          kurirnya sendiri di <code className="sa-code">/merchant/couriers</code>, bukan pengawasan
          platform.
        </p>
      </section>

      <section className="sa-card" id="sengketa">
        <p className="sa-card-label">
          <Scale size={14} strokeWidth={1.75} aria-hidden="true" />
          Sengketa
        </p>
        {merchantDisputes.length === 0 ? (
          <p className="sa-empty">Tidak ada sengketa yang menimpa merchant ini.</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">Order</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Diajukan oleh</th>
                  <th scope="col">Status</th>
                  <th scope="col">Nilai</th>
                </tr>
              </thead>
              <tbody>
                {merchantDisputes.map((dispute) => (
                  <tr key={dispute.id}>
                    <td className="sa-nowrap">
                      {dispute.orderCode}
                      <span className="sa-table-sub">{dispute.filedAt}</span>
                    </td>
                    <td>{dispute.category}</td>
                    <td>
                      {dispute.filedBy === 'merchant' ? 'Merchant' : 'Customer'}
                      <span className="sa-table-sub">{dispute.party}</span>
                    </td>
                    <td>
                      <span className="sa-chip">{disputeStatusLabel[dispute.status]}</span>
                      {dispute.appeal ? (
                        <span className="sa-table-sub">banding diajukan</span>
                      ) : null}
                    </td>
                    <td className="sa-nowrap">{jod(dispute.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sa-note">
          Putusan level-1 dibuat panel CS. Yang naik banding ke SA muncul di halaman{' '}
          <code className="sa-code">/superadmin/appeals</code>.
        </p>
      </section>

      <section className="sa-card" id="ledger">
        <p className="sa-card-label">
          <BookOpen size={14} strokeWidth={1.75} aria-hidden="true" />
          Uang di ledger
        </p>
        {entries.length === 0 ? (
          <p className="sa-empty">Belum ada entry ledger yang menyebut merchant ini.</p>
        ) : (
          <div className="sa-table-wrap">
            <table className="sa-table">
              <thead>
                <tr>
                  <th scope="col">Waktu</th>
                  <th scope="col">Jenis</th>
                  <th scope="col">Arah</th>
                  <th scope="col">Nominal</th>
                  <th scope="col">Ref</th>
                  <th scope="col">Memo</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="sa-nowrap">{entry.at}</td>
                    <td>{ledgerTypeLabel[entry.type]}</td>
                    <td>
                      <span
                        className={`sa-chip${entry.direction === 'credit' ? ' is-ok' : ' is-off'}`}
                      >
                        {entry.direction === 'credit' ? 'Masuk' : 'Keluar'}
                      </span>
                    </td>
                    <td className="sa-nowrap">{jod(entry.amount)}</td>
                    <td className="sa-nowrap">{entry.ref}</td>
                    <td>{entry.memo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="sa-note">
          Ledger append-only, tidak ada yang bisa diubah dari layar mana pun. Daftar penuh ada di{' '}
          <code className="sa-code">/superadmin/ledger</code>.
        </p>
      </section>

      <section className="sa-card" id="sla">
        <p className="sa-card-label">
          <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
          Alert SLA yang naik ke SA
        </p>
        {escalations.length === 0 ? (
          <p className="sa-empty">Tidak ada pengantaran merchant ini yang lewat SLA.</p>
        ) : (
          <ul className="sa-feed">
            {escalations.map((escalation) => (
              <li key={escalation.id}>
                <span className="sa-dot" aria-hidden="true" />
                <span className="sa-feed-copy">
                  <strong>{escalation.orderCode}</strong>
                  <span>{escalation.detail}</span>
                </span>
                <span className="sa-feed-at">{escalation.minutesLate} menit</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="sa-note">
        Setiap perubahan status dari konsol ini tercatat di audit trail atas nama operator yang
        sedang aktif. Blacklist COD dan approval onboarding tenant tetap kerja panel CS di{' '}
        <code className="sa-code">/admin/merchants</code>.
      </p>
      <div className="sa-actions">
        <Link className="sa-link" to="/audit">
          Audit trail aksi SA &amp; CS
        </Link>
        <Link className="sa-link" to="/appeals">
          Banding sengketa
        </Link>
      </div>

      {/* Konfirmasi memakai `BottomSheet` yang sudah ada: ia sudah menangani
          Escape, klik overlay, dan atribut dialog. Judulnya menyebut akibatnya,
          bukan "Yakin?" — yang diubah bukan preferensi, merchant berhenti
          menerima order. */}
      <BottomSheet
        open={pendingAction !== null}
        title={
          pendingAction === 'suspend'
            ? `Suspend ${merchant.name}?`
            : `Aktifkan kembali ${merchant.name}?`
        }
        onClose={() => setPendingAction(null)}
      >
        <p className="sa-card-sub">
          {pendingAction === 'suspend'
            ? 'Merchant berhenti menerima order baru, dan order yang sudah berjalan tetap diselesaikan. Statusnya jadi Suspended dengan alasan yang tampil di kartu identitas.'
            : 'Tenant kembali aktif dan bisa menerima order lagi. Alasan suspend sebelumnya dihapus, riwayatnya tetap ada di audit trail.'}
        </p>
        <div className="sa-actions">
          <button
            type="button"
            className={
              pendingAction === 'suspend' ? 'sa-btn sa-btn--danger' : 'sa-btn sa-btn--primary'
            }
            onClick={() => {
              if (pendingAction === 'suspend') {
                dispatch(suspendMerchant({ id: merchant.id, by: 'sa' }))
                toast.success(`${merchant.name} di-suspend, tercatat di audit trail`)
              } else {
                dispatch(reinstateMerchant({ id: merchant.id }))
                toast.success(`${merchant.name} aktif kembali, tercatat di audit trail`)
              }
              setPendingAction(null)
            }}
          >
            {pendingAction === 'suspend' ? 'Ya, suspend' : 'Ya, aktifkan'}
          </button>
          <button type="button" className="sa-btn" onClick={() => setPendingAction(null)}>
            Batal
          </button>
        </div>
      </BottomSheet>
    </SuperAdminShell>
  )
}

/** Form edit teks registri merchant (dipakai konsol SA). */
function MerchantEditCard({ merchant }: { merchant: MerchantRecord }) {
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({
    name: merchant.name,
    owner: merchant.owner,
    ownerPhone: merchant.ownerPhone,
    city: merchant.city,
    tier: merchant.tier,
    deposit: String(merchant.deposit),
    codIssues: String(merchant.codIssues),
    isActiveHijazi: merchant.isActiveHijazi,
    isActiveSyimali: merchant.isActiveSyimali,
  })
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <article className="sa-card">
      <p className="sa-card-label">Edit data merchant</p>
      <div className="sa-form-grid">
        <label className="sa-field"><span>Nama</span><input value={form.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="sa-field"><span>Pemilik</span><input value={form.owner} onChange={(e) => set({ owner: e.target.value })} /></label>
        <label className="sa-field"><span>Nomor WA pemilik</span><input value={form.ownerPhone} onChange={(e) => set({ ownerPhone: e.target.value })} /></label>
        <label className="sa-field"><span>Kota</span><input value={form.city} onChange={(e) => set({ city: e.target.value })} /></label>
        <label className="sa-field">
          <span>Paket</span>
          <select value={form.tier} onChange={(e) => set({ tier: e.target.value as MerchantRecord['tier'] })}>
            <option value="free">free</option>
            <option value="pro">pro</option>
          </select>
        </label>
        <label className="sa-field"><span>Deposit (JOD)</span><input type="number" step={0.1} value={form.deposit} onChange={(e) => set({ deposit: e.target.value })} /></label>
        <label className="sa-field"><span>COD bermasalah</span><input type="number" value={form.codIssues} onChange={(e) => set({ codIssues: e.target.value })} /></label>
        <label className="sa-field sa-field--inline"><input type="checkbox" checked={form.isActiveHijazi} onChange={(e) => set({ isActiveHijazi: e.target.checked })} /><span>Zona Hijazi</span></label>
        <label className="sa-field sa-field--inline"><input type="checkbox" checked={form.isActiveSyimali} onChange={(e) => set({ isActiveSyimali: e.target.checked })} /><span>Zona Syimali</span></label>
      </div>
      <div className="sa-actions">
        <button
          type="button"
          className="sa-btn sa-btn--primary"
          onClick={() => {
            dispatch(updateMerchant({
              id: merchant.id,
              patch: {
                name: form.name,
                owner: form.owner,
                ownerPhone: form.ownerPhone,
                city: form.city,
                tier: form.tier,
                deposit: Number(form.deposit),
                codIssues: Number(form.codIssues),
                isActiveHijazi: form.isActiveHijazi,
                isActiveSyimali: form.isActiveSyimali,
              },
            }))
            toast.success('Data merchant disimpan')
          }}
        >
          Simpan
        </button>
      </div>
    </article>
  )
}
