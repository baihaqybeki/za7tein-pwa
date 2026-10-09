import { DocCode } from '../DocCode'
import { DocSection } from '../DocSection'

export function CurrencySection() {
  return (
    <DocSection id="currency" num="22" title="Mata Uang — IDR + JOD">
      <p className="doc-p">
        Satu aturan menutup seluruh tampilan nominal (<code className="doc-inline">R-CURR-01</code>,
        flow <code className="doc-inline">F10</code>): <strong>IDR adalah source of truth</strong>,
        JOD <strong>hanya untuk tampilan</strong>. Semua nominal di state, mock, dan ledger
        disimpan IDR; keputusan produk yang membatalkan Wise itu menegaskan tidak ada uang
        menyentuh JOD. Jangan pernah menyimpan nominal JOD sebagai nilai transaksi — di situ
        pembulatan mulai menumpuk.
      </p>
      <p className="doc-p">
        Padanannya dipasang di layer tampilan saja, 2 desimal, lewat dua formatter di{' '}
        <code className="doc-inline">src/data/currency.ts</code>:
      </p>
      <DocCode lang="typescript">
        {`money(25000)      // "Rp25.000 · ±1,09 JOD"  — pasangan IDR + JOD
moneyPlain(25000) // "Rp25.000"                — IDR saja, tempat sempit
moneyFromJod(3.5) // "Rp80.500 · ±3,50 JOD"    — dari angka yang disimpan JOD
jod(1.09)         // "1,09 JOD"`}
      </DocCode>
      <p className="doc-p">
        <code className="doc-inline">money()</code> dipakai di layar customer, merchant, dan
        kurir supaya setiap nominal punya padanannya.{' '}
        <code className="doc-inline">moneyPlain()</code> untuk tempat yang tidak muat
        pasangan atau tidak perlu dibacakan: label <code className="doc-inline">aria-label</code>,
        dan rate pada widget kurs. Nol dilewatkan tanpa padanan karena{' '}
        <code className="doc-inline">Rp0 · ±0,00 JOD</code> cuma menambah bising di baris
        diskon. Label tombol utama tetap memuat pasangan — diukur pada 390px, tidak ada yang
        terpotong.
      </p>
      <p className="doc-p">
        Konsol CS juga menampilkan pasangan IDR + JOD sejak 2026-09-23. Angka mock-nya memang
        ditulis dalam JOD (liability, deposit, nilai order sengketa), jadi konversinya lewat{' '}
        <code className="doc-inline">moneyFromJod()</code> — sekali di{' '}
        <code className="doc-inline">currency.ts</code>, bukan diulang di tiap layar. Sebelumnya
        konsol ini JOD-only, yang menyalahi <code className="doc-inline">R-CURR-01</code>: IDR
        adalah source of truth dan JOD cuma tampilan.
      </p>
      <div className="doc-table-wrap">
        <table className="doc-table">
          <thead>
            <tr>
              <th>Berkas</th>
              <th>Isi</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code className="doc-inline">data/currency.ts</code>
              </td>
              <td>
                Satu-satunya sumber kurs + formatter (<code className="doc-inline">money</code>,{' '}
                <code className="doc-inline">moneyPlain</code>,{' '}
                <code className="doc-inline">moneyFromJod</code>,{' '}
                <code className="doc-inline">jod</code>,{' '}
                <code className="doc-inline">idrToJod</code>) + disclaimer
              </td>
            </tr>
            <tr>
              <td>
                <code className="doc-inline">components/ui/ExchangeRateNote.tsx</code>
              </td>
              <td>
                Widget kurs: 1 JOD = Rp23.000, waktu sync terakhir, disclaimer — dipasang di
                Checkout, Payment Amount, dan layar uang panel CS (Ringkasan, Ledger, Sengketa,
                Merchant, Onboarding)
              </td>
            </tr>
            <tr>
              <td>
                <code className="doc-inline">data/admin.ts</code>
              </td>
              <td>
                Nominal panel admin (CS) tampil <strong>IDR + JOD</strong> lewat re-export{' '}
                <code className="doc-inline">moneyFromJod()</code> /{' '}
                <code className="doc-inline">money()</code> dari{' '}
                <code className="doc-inline">currency.ts</code>, plus widget disclaimer di tiap
                layar uang
              </td>
            </tr>
            <tr>
              <td>
                <code className="doc-inline">components/ui/CurrencyConverter.tsx</code>
              </td>
              <td>
                Kartu konversi dua arah di Home customer: input jumlah, tombol tukar
                (IDR↔JOD), hasil hanya-baca, ditutup{' '}
                <code className="doc-inline">ExchangeRateNote</code>
              </td>
            </tr>
            <tr>
              <td>
                <code className="doc-inline">hooks/useDailyExchangeRate.ts</code>
              </td>
              <td>
                Kurs harian: satu hit per hari kalender, di-cache di{' '}
                <code className="doc-inline">localStorage</code>{' '}
                (<code className="doc-inline">sa7tein:exchange-rate</code>) — rate baru hanya
                saat hari berganti
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <h3 className="doc-h3">Konverter Home &amp; cache harian (UNRESOLVED)</h3>
      <p className="doc-p">
        Sejak 2026-10-09 Home customer memuat kartu{' '}
        <code className="doc-inline">CurrencyConverter</code> (dua arah + tombol tukar). Rate-nya
        dari <code className="doc-inline">useDailyExchangeRate</code>:{' '}
        <code className="doc-inline">fetchDailyRate()</code> mensimulasikan{' '}
        <code className="doc-inline">&ldquo;hit&rdquo;</code> sekali per hari (rate bergeser ±1,5%
        deterministik per tanggal) lalu hasilnya disimpan — reload di hari yang sama tidak
        menghitung ulang. Ini <strong>menyimpang</strong> dari flow F10 yang menaruh sinkron rate di
        backend 1×24 jam; kompromi showcase karena repo tanpa backend.{' '}
        <strong>UNRESOLVED:</strong> kebijakan cache (per-device vs server) dan apakah kartu tetap
        ada saat rate nyata tersedia. Konversi tetap tampilan saja — tidak ada state nominal JOD.
      </p>
      <h3 className="doc-h3">Disclaimer wajib, dan yang masih UNRESOLVED</h3>
      <p className="doc-p">
        Setiap tempat yang menampilkan JOD wajib dekat dengan kalimat{' '}
        <em>&ldquo;kurs estimasi, mengikuti kurs harian&rdquo;</em> — itulah isi{' '}
        <code className="doc-inline">RATE_DISCLAIMER</code>. Rate di repo ini mock (1 JOD =
        Rp23.000, contoh yang disebut PRD), bukan rate live: sync 1×24 jam dari API kurs belum
        ada, karena dua hal masih terbuka dan <strong>tidak boleh ditebak</strong> — provider
        kurs (<code className="doc-inline">OQ-26</code>) dan umur maksimal fallback rate
        (<code className="doc-inline">OQ-28</code>). Yang sudah pasti hanya perilaku
        fallback-nya: kalau fetch gagal, pakai rate terakhir dan jangan blokir transaksi.
      </p>
    </DocSection>
  )
}
