import { DocCode } from '../DocCode'
import { DocSection } from '../DocSection'

export function MerchantDesignSection() {
  return (
    <DocSection id="merchant-design" num="13" title="Merchant Console — Design Consistency">
      <p className="doc-p">
        The merchant console (<code className="doc-inline">/merchant</code>) was redesigned to reuse the
        customer design system rather than maintaining a parallel set of styles.
        Below are the key integration points and conscious exceptions.
      </p>
      <h3 className="doc-h3">
        Header — sticky, edge-to-edge
      </h3>
      <p className="doc-p">
        <code className="doc-inline">.merchant-header</code> follows the same convention as the customer
        header: <code className="doc-inline">position: sticky</code>, negative margin + padding to bleed
        to the shell edges. No separate header component — CSS class reuse only.
      </p>
      <h3 className="doc-h3">
        Baris status katalog
      </h3>
      <p className="doc-p">
        <code className="doc-inline">.merchant-menu-context</code> cukup satu baris
        caption (dot status + "Toko buka" + "10 dari 15 menu siap tampil"), tanpa
        chrome kartu. Sebelumnya kartu berbingkai + shadow hanya memuat satu status
        dan satu kalimat, teks kanannya dikunci{' '}
        <code className="doc-inline">max-width: 18ch</code> + rata kanan sehingga
        pecah dua baris, dan status non-interaktif dipaksa{' '}
        <code className="doc-inline">min-height: var(--touch-min)</code> (itu untuk
        tap target kontrol, bukan teks). Baris caption menghapus tumpuk chrome
        ketiga di atas daftar.
      </p>
      <h3 className="doc-h3">
        Filter menu: satu bar sticky, kategori + status stok
      </h3>
      <p className="doc-p">
        <code className="doc-inline">/merchant/menu</code> punya satu bar filter
        sticky (<code className="doc-inline">.merchant-menu-filters</code>, lewat{' '}
        <code className="doc-inline">@mixin sticky-below-header</code>) berisi
        dua baris: baris utama chip kategori (Semua/Makanan/Minuman/Camilan dari
        mock <code className="doc-inline">CATEGORIES</code> + ikon lucide-nya,
        digeser mendatar dengan mask fade), baris kedua segmented status stok
        (Semua stok/Menipis/Habis). Kategori jadi filter utama, status stok
        sekunder. Yang aktif di kategori memakai oranye merek; segmented sengaja
        netral (track abu, thumb permukaan) supaya tidak ada dua "on" oranye
        berdampingan. Keduanya digabung AND, jadi "Minuman + Habis" bisa.
      </p>
      <p className="doc-p">
        Kepala tiap grup kategori juga sticky (pola <em>sticky section header</em>
        ), duduk tepat di bawah bar filter lewat{' '}
        <code className="doc-inline">
          top: calc(var(--nav-height) + var(--menu-filter-h))
        </code>
        . Namanya tetap terbaca saat itemnya digulir, lalu terdorong oleh grup
        berikutnya; <code className="doc-inline">z-index</code> di bawah bar
        supaya kepala lama lewat di bawahnya. Kuncinya:{' '}
        <code className="doc-inline">--menu-filter-h</code> diukur runtime
        (ResizeObserver di <code className="doc-inline">MerchantMenu</code>),
        bukan hardcode. Percobaan dengan <code className="doc-inline">top</code>{' '}
        hardcoded dulu bikin kepala tumpang-tindih dengan bar (filter terukur 57px
        termasuk tepi) dan kebaca "kepotong".{' '}
        <code className="doc-inline">.merchant-page</code> menyimpan fallback{' '}
        <code className="doc-inline">--menu-filter-h: 118px</code> kalau JS belum
        jalan.
      </p>
      <p className="doc-p">
        Dasar bar diberi hairline full-bleed lewat{' '}
        <code className="doc-inline">::after</code>, dan latar kepala grup
        melebar ke gutter lewat <code className="doc-inline">::before</code>,
        supaya item tidak lewat di kiri-kanan kepala saat menempel.
      </p>
      <h3 className="doc-h3">
        Daftar menu per kategori
      </h3>
      <p className="doc-p">
        Hasil filter dikelompokkan per kategori (urutan mengikuti{' '}
        <code className="doc-inline">CATEGORIES</code>); tiap grup punya kepala
        sendiri (ikon + label + jumlah item), dan grup yang kosong disembunyikan.
        Menambah kategori cukup di data itu, halaman ikut. Sebelumnya daftar rata
        dan tidak ada cara menyaring per jenis makanan/minuman.
      </p>
      <h3 className="doc-h3">
        Dompet &amp; rekening pencairan merchant
      </h3>
      <p className="doc-p">
        Tiga rute baru: <code className="doc-inline">/merchant/wallet</code>{' '}
        (saldo + riwayat), <code className="doc-inline">/merchant/payout</code>{' '}
        (pilih rekening + nominal), dan{' '}
        <code className="doc-inline">/merchant/payout-accounts</code> (CRUD
        rekening). Ini lane merchant flow{' '}
        <code className="doc-inline">f6-cashout-payout</code> + R-WALLET-01:
        order selesai → kredit otomatis, keluar hanya lewat Xendit payout. Potnya
        IDR dan bisa ditarik, terpisah dari modal/cashback Founding (JOD,
        non-withdrawal, di <code className="doc-inline">/merchant/insentif</code>).
      </p>
      <p className="doc-p">
        Rekening dulu cuma satu dan read-only dari{' '}
        <code className="doc-inline">mockMerchant.bank</code>; sekarang lewat
        slice <code className="doc-inline">payout</code> (ikut persist), dengan
        tepat satu rekening <code className="doc-inline">isPrimary</code>, dan
        penghapusan rekening utama otomatis menaikkan rekening tersisa. Fee
        payout Rp2.500/transfer (<code className="doc-inline">source.md:573</code>
        ) hanya ditampilkan, <strong>belum dipotong</strong> dari saldo karena
        penanggungnya untuk merchant belum diputuskan PRD.
      </p>
      <h3 className="doc-h3">
        Cards — shared surface token
      </h3>
      <p className="doc-p">
        Merchant card selectors now <code className="doc-inline">@extend %card-surface</code>, inheriting
        the same <code className="doc-inline">--surface</code>,
        <code className="doc-inline">--border</code>, and <code className="doc-inline">--shadow-sm</code> as customer cards. No new
        card token was introduced.
      </p>
      <h3 className="doc-h3">
        BottomNav — parametrizable
      </h3>
      <p className="doc-p">
        <code className="doc-inline">MerchantBottomNav</code> no longer duplicates bottom navigation
        markup. It delegates to the shared <code className="doc-inline">BottomNav</code> component via
        an <code className="doc-inline">items</code> prop:
      </p>
      <DocCode lang="tsx">
        {`// src/components/layout/MerchantBottomNav.tsx
import { Bike, BookOpenText, ClipboardList, LayoutDashboard, Settings } from 'lucide-react'

import { useAppSelector } from '../../hooks/useAppStore'
import { BottomNav } from './BottomNav'
import type { BottomNavItem } from './BottomNav'
import { countByTab } from '../../data/merchantOrders'

export function MerchantBottomNav() {
  const orders = useAppSelector((s) => s.merchant.orders)
  const incoming = countByTab(orders, 'masuk')

  const items: BottomNavItem[] = [
    { to: '/', label: 'Beranda', Icon: LayoutDashboard, end: true },
    {
      to: '/orders',
      label: 'Order',
      Icon: ClipboardList,
      end: false,
      badge: incoming,
      srText: incoming > 0 ? \`\${incoming} pesanan masuk\` : undefined,
    },
    { to: '/menu', label: 'Menu', Icon: BookOpenText, end: false },
    { to: '/couriers', label: 'Kurir', Icon: Bike, end: false },
    { to: '/settings', label: 'Setelan', Icon: Settings, end: false },
  ]

  return <BottomNav items={items} />
}`}
      </DocCode>
      <h3 className="doc-h3">
        Order status — human labels
      </h3>
      <p className="doc-p">
        Raw enum values (e.g. <code className="doc-inline">masuk</code>,
        <code className="doc-inline">dimasak</code>) are displayed via
        <code className="doc-inline">orderStatusLabel()</code>, which returns Indonesian
        labels:
      </p>
      <DocCode lang="typescript">
        {`// src/data/merchantOrders.ts
import type { MerchantOrderStatus } from '../types'

export const ORDER_STATUS_LABEL: Record<MerchantOrderStatus, string> = {
  masuk: 'Baru',
  diterima: 'Diterima',
  dimasak: 'Dimasak',
  diantar: 'Diantar',
  tiba: 'Tiba',
  selesai: 'Selesai',
  ditolak: 'Ditolak',
  batal: 'Batal',
}

export function orderStatusLabel(status: MerchantOrderStatus): string {
  return ORDER_STATUS_LABEL[status]
}`}
      </DocCode>
      <h3 className="doc-h3">
        Badge contrast fix
      </h3>
      <p className="doc-p">
        Status badges previously used dark-ink colors as backgrounds, producing
        near-invisible text on dark themes. The fix applies
        <code className="doc-inline">--orange-soft</code> background with
        <code className="doc-inline">--orange-soft-ink</code> text — matching
        the customer badge palette without introducing new tokens.
      </p>
      <h3 className="doc-h3">
        Components deliberately NOT reused
      </h3>
      <p className="doc-p">
        <code className="doc-inline">FoodCard</code>,
        <code className="doc-inline">JourneyLine</code>, and the customer hero&rsquo;s
        search and profile content are not shared with merchant screens. Merchant
        content is admin-oriented (order rows, status badges, menu management) — not
        customer food browsing. Reusing those components would force merchant-specific
        props into a customer-shaped interface. This is a conscious decision, not an
        oversight. The hero&rsquo;s orange field and wave pattern <em>are</em> shared
        through <code className="doc-inline">Sa7teinHeroPattern</code> and
        <code className="doc-inline">system/_hero.scss</code>; only the contents differ.
      </p>
      <h3 className="doc-h3">
        Hero beranda dapur
      </h3>
      <p className="doc-p">
        Beranda merchant memakai hero oranye seperti beranda pelanggan
        (<code className="doc-inline">MerchantHomeHero</code>,{' '}
        <code className="doc-inline">src/components/merchant/</code>). Tiga hal yang
        dulu tiga kartu terpisah — identitas toko, status buka/tutup beserta tombolnya,
        dan kuota harian — kini satu bidang: eyebrow &ldquo;Dapur&rdquo; + nama toko
        (memakai <code className="doc-inline">merchant-title</code>, skala hero dari{' '}
        <code className="doc-inline">system/_type.scss</code>), chip status, tombol
        buka/tutup selebar kartu, lalu bilah kuota. Latar oranye full-bleed ke tepi
        kolom sementara isinya tetap 20&nbsp;px. Komponen ini tanpa state: nilai dan
        aksi tetap milik halaman (<code className="doc-inline">merchantSlice</code>).
      </p>
      <h3 className="doc-h3">
        Profil &amp; rating pembeli di kartu order
      </h3>
      <p className="doc-p">
        Setiap kartu order menampilkan avatar pembeli (40&nbsp;px, pill) di sebelah
        kode dan nama, plus rating bintang 1–5 (lucide
        <code className="doc-inline">Star</code>, token
        <code className="doc-inline">--star</code>) di kolom kanan di atas badge
        status. Pola yang sama dipakai di daftar "Order terbaru" pada dashboard
        merchant. Data mock memakai avatar
        <code className="doc-inline">/assets/img/reviewer/user1–6.png</code> dan
        rating per order di <code className="doc-inline">merchantOrders.ts</code>.
      </p>
      <h3 className="doc-h3">
        Lokasi presisi di Setelan toko
      </h3>
      <p className="doc-p">
        Peta Setelan berubah dari pratinjau statis jadi pemilih lokasi: pin
        oranye bisa digeser (mode <code className="doc-inline">picker</code> di
        <code className="doc-inline">useLeafletMap</code>), tombol "Pakai lokasi
        saat ini" memakai <code className="doc-inline">navigator.geolocation</code>
        dan memindahkan pin, lalu koordinat terpilih tampil real-time di kartu
        Koordinat. Geolokasi ditolak? Pin tetap bisa digeser manual.
      </p>
      <h3 className="doc-h3">
        Foto toko di Setelan
      </h3>
      <p className="doc-p">
        Field foto profil toko (kontrak <code className="doc-inline">photo</code>{' '}
        D1, flow <code className="doc-inline">f16-merchant-onboarding</code>) kini
        bisa dikelola di <code className="doc-inline">/merchant/settings</code>:
        unggah, ganti, dan hapus. Pratinjau memakai berkas lokal lewat{' '}
        <code className="doc-inline">URL.createObjectURL</code> (front-end saja,
        AGENTS.md §1) dan disimpan di <code className="doc-inline">merchantSlice</code>{' '}
        (<code className="doc-inline">setMerchantLogo</code> /{' '}
        <code className="doc-inline">removeMerchantLogo</code>), bukan menunggu
        tombol simpan form teks. Baris pratinjau memakai ulang{' '}
        <code className="doc-inline">.merchant-image-field</code> +{' '}
        <code className="doc-inline">.merchant-form-thumb</code> yang sudah ada di
        editor menu; saat kosong diganti placeholder{' '}
        <code className="doc-inline">.merchant-logo-empty</code> berukuran sama
        supaya baris tidak melompat. URL objek dilepas saat diganti, dihapus, dan
        unmount. Foto yang sama tampil di hero beranda (
        <code className="doc-inline">MerchantHomeHero</code>) karena keduanya
        membaca <code className="doc-inline">merchantSlice.logo</code>; contoh
        bawaan memakai ulang aset menu yang sudah ada, tanpa menambah aset baru.
      </p>
      <h3 className="doc-h3">
        Konfirmasi aksi berisiko di konsol merchant
      </h3>
      <p className="doc-p">
        Aksi yang keluar dari rel atau menahan uang tidak lagi terjadi karena
        satu sentuhan salah. Semuanya memakai{' '}
        <code className="doc-inline">ConfirmSheet</code> — komponen konfirmasi
        dua langkah yang sudah dipakai panel CS dan tugas kurir, kini akhirnya
        masuk role merchant (sebelumnya merchant menulis{' '}
        <code className="doc-inline">BottomSheet</code> mentah sendiri dan nol
        memakai komponen bersama). Konfirmasi lama yang masih ditulis tangan —
        hapus item menu, hapus kurir, keluar dari akun — ikut dipindahkan ke{' '}
        <code className="doc-inline">ConfirmSheet</code>, jadi seluruh
        konfirmasi merchant seragam: judul, isi, tombol Batal, dan tombol aksi.
        Sheet yang berupa form atau konten (tambah kurir, tambah item, stok,
        detail order) tetap <code className="doc-inline">BottomSheet</code>.
        Layout dua tombolnya juga disamakan: <code className="doc-inline">.sheet-actions</code>{' '}
        kini sejajar <code className="doc-inline">flex: 1</code> seperti{' '}
        <code className="doc-inline">.merchant-actions</code> dan{' '}
        <code className="doc-inline">.profile-modal-actions</code> — sebelumnya{' '}
        <code className="doc-inline">ConfirmSheet</code> menumpuk penuh sehingga
        popup merchant tampil berbeda dari popup merchant lain. Yang dikonfirmasi:
      </p>
      <ul className="doc-list">
        <li>
          <strong>Tutup toko</strong> (<code className="doc-inline">MerchantDashboard</code>)
          — membuka kembali cukup satu tap, menutup minta konfirmasi karena
          order baru langsung berhenti.
        </li>
        <li>
          <strong>Tolak pesanan</strong> (<code className="doc-inline">MerchantOrders</code>)
          — order keluar dari antrean; dulu satu tap tanpa jejak, tombolnya
          hilang begitu status berubah.
        </li>
        <li>
          <strong>Siap diantar</strong> — dua langkah, sesuai flow{' '}
          <code className="doc-inline">f12-merchant-console</code> ("Siap
          diambil (2-way confirm)").
        </li>
        <li>
          <strong>Batalkan pesanan &amp; refund</strong> — lane guard{' '}
          <code className="doc-inline">f12</code>: order macet punya jalan
          keluar (ganti kurir, atau batal dan kembalikan dana hold). Sebelumnya
          jalur ini tidak ada di kode.
        </li>
        <li>
          <strong>Hapus foto toko</strong> (<code className="doc-inline">MerchantSettings</code>)
          — dulu langsung hapus tanpa konfirmasi.
        </li>
        <li>
          <strong>Sembunyikan item menu</strong> (<code className="doc-inline">MerchantMenu</code>)
          — switch ketersediaan dulu langsung <code className="doc-inline">toggleAvailable</code>.
          Menyembunyikan sekarang minta konfirmasi (item hilang dari menu pelanggan);
          menampilkan kembali cukup satu tap.
        </li>
      </ul>
      <p className="doc-p">
        Pilihan estimasi masak disamakan dengan PRD aktif:{' '}
        <code className="doc-inline">15 / 25 / 35</code> menit (dulu{' '}
        <code className="doc-inline">15 / 20 / 25 / 30</code>, selisih dari flow
        dan <code className="doc-inline">source.md</code>). Berkas gambar (foto
        toko &amp; item menu) lewat <code className="doc-inline">imageFileError</code>{' '}
        di <code className="doc-inline">src/lib/image.ts</code> — tipe harus
        gambar dan maksimal 2 MB; <code className="doc-inline">accept</code>{' '}
        saja tidak menjamin apa pun. Form Setelan kini benar-benar menyimpan ke{' '}
        <code className="doc-inline">merchantSlice</code> (
        <code className="doc-inline">setStoreProfile</code>), bukan sekadar toast
        "berhasil" tanpa perubahan state.
      </p>
      <h3 className="doc-h3">
        Keluar dari akun toko
      </h3>
      <p className="doc-p">
        Tombol "Keluar" di Setelan toko sebelumnya tidak punya handler sama sekali:
        bisa ditekan, tidak terjadi apa-apa (kontrol mati, senior-fe HG-06). Sekarang
        ia membuka <code className="doc-inline">BottomSheet</code> konfirmasi yang
        menyebut akibatnya, lalu memanggil <code className="doc-inline">logout()</code>{' '}
        dari <code className="doc-inline">authSlice</code> dan kembali ke{' '}
        <code className="doc-inline">/merchant/signin</code>. Polanya sama dengan{' '}
        <code className="doc-inline">Profile.tsx</code> di sisi customer — tidak ada
        state sesi baru, karena state lain hanya akan berbeda dari yang sudah ada.
      </p>
      <h3 className="doc-h3">
        Kontrol mati lain yang ikut dibersihkan
      </h3>
      <p className="doc-p">
        Pemeriksaan yang sama menemukan dua lagi. Tombol hamburger di{' '}
        <code className="doc-inline">/documentation</code> tidak punya handler,
        padahal di layar sempit sidebar memang tergeser keluar dan hanya kelas{' '}
        <code className="doc-inline">.open</code> yang memunculkannya — artinya
        daftar isi dokumentasi tidak bisa dibuka sama sekali di ponsel. Sekarang
        hamburger menyalakan <code className="doc-inline">.open</code>, overlay
        menutupnya, dan memilih item ikut menutupnya. Spacer grid numpad di{' '}
        <code className="doc-inline">CreatePin</code> dan{' '}
        <code className="doc-inline">ForgotPasswordOtp</code> dulu elemen{' '}
        <code className="doc-inline">&lt;button&gt;</code> yang tidak melakukan apa
        pun tapi bisa difokus keyboard; kini menjadi{' '}
        <code className="doc-inline">&lt;span aria-hidden&gt;</code>.
      </p>
      <h3 className="doc-h3">
        Statistik dashboard berwarna
      </h3>
      <p className="doc-p">
        Empat kartu stat di dashboard memakai tint per peran agar tidak monoton:
        Antrean <code className="doc-inline">--warning-soft</code>, Diproses
        <code className="doc-inline">--orange-soft</code>, Selesai
        <code className="doc-inline">--success-soft</code>, dan Pendapatan
        (kartu hero) <code className="doc-inline">--sa7tein-orange</code> dengan
        teks <code className="doc-inline">--on-brand</code>. Tidak ada token baru.
      </p>
      <h3 className="doc-h3">
        Menu &amp; Stok — katalog operasional
      </h3>
      <p className="doc-p">
        Quick action "Kelola" di dashboard memakai kartu aksi terpisah
        (<code className="doc-inline">merchant-quick-action</code>): ikon dalam
        lingkaran oranye (<code className="doc-inline">--orange-soft</code> /
        <code className="doc-inline">--orange-ink</code>) plus chevron kanan — bukan
        baris order, supaya jelas bisa diketuk.
      </p>
      <p className="doc-p">
        Ringkasan 3 kartu adalah filter interaktif: Semua menu, Menipis, dan Habis.
        Setiap item hanya muncul satu kali dalam daftar yang dipilih. Kartu item
        memisahkan identitas (foto, nama, kategori, harga) dari tindakan (ubah stok,
        ubah ketersediaan, opsi lain). Semua kontrol memiliki target minimal 44 px.
      </p>
      <p className="doc-p">
        Ubah stok membuka <code className="doc-inline">BottomSheet</code> dengan
        stepper dan tombol Simpan. Opsi Ubah/Hapus tetap di menu tambahan; Hapus
        meminta konfirmasi dan menjelaskan dampaknya ke katalog pelanggan.
        Form tambah/ubah memberi label untuk setiap bidang, termasuk Gambar.
      </p>
      <p className="doc-p">
        Baris Gambar menyejajarkan pratinjau dan tombol upload sebagai satu baris
        flex (<code className="doc-inline">.merchant-image-field</code>,{' '}
        <code className="doc-inline">align-items: center</code>). Sebelumnya
        keduanya inline di dalam <code className="doc-inline">.form-group</code>{' '}
        yang <code className="doc-inline">display:block</code>, sehingga{' '}
        <code className="doc-inline">vertical-align: baseline</code> mendorong foto
        64px naik 34px di atas tombol 44px — terbaca seperti dua elemen yang tidak
        sengaja bersebelahan. Tombol berganti teks menjadi "Ganti gambar" begitu
        ada pratinjau.
      </p>
      <p className="doc-p">
        Setiap thumbnail memakai <code className="doc-inline">alt</code> nama item
        (bukan kosong) supaya daftar tetap terbaca screen reader; gambar pratinjau
        memberi dimensi eksplisit + lazy loading agar tata letak tidak bergeser.
        Aturan <code className="doc-inline">.merchant-menu-*</code> dikonsolidasi ke
        satu blok — properti yang hanya ada di blok lama (object-fit, ellipsis nama,
        warna stok, state tidak tersedia) dipindah dulu sebelum blok duplikat dihapus.
      </p>
      <h3 className="doc-h3">
        Unified catalog
      </h3>
      <p className="doc-p">
        Merchant menu and customer app read from the same Redux
        <code className="doc-inline">catalog</code> slice, seeded by
        <code className="doc-inline">src/data/catalog.ts</code>. Merchant edits —
        including image upload via <code className="doc-inline">FileReader</code> to
        data-URL — are visible to customers immediately.
      </p>
      <h3 className="doc-h3">
        Bottom nav — 5 tabs
      </h3>
      <p className="doc-p">
        The merchant bottom nav now has five tabs: Beranda, Order, Menu, Kurir,
        Setelan. <code className="doc-inline">/merchant/menu</code> is active on the
        Menu page. The <code className="doc-inline">Menu</code> icon (lucide
        <code className="doc-inline">BookOpenText</code>) sits between Order and
        Kurir.
      </p>
      <h3 className="doc-h3">
        Kelola kurir &amp; pemilihan kurir per order
      </h3>
      <p className="doc-p">
        Halaman <code className="doc-inline">/merchant/couriers</code> adalah pengelola
        kurir toko: tambah (nama + nomor WA, validasi <code className="doc-inline">phoneField</code>{' '}
        yang sama dengan pendaftaran), jam tugas (Aktifkan/Nonaktifkan), dan hapus dengan
        konfirmasi. Kuota dibaca dari <code className="doc-inline">MAX_COURIERS_PER_MERCHANT</code>{' '}
        (3) — bukan angka di JSX. Status <code className="doc-inline">delivering</code> tidak
        bisa diubah dari sini karena datang dari checkpoint kurir sendiri (F13).
      </p>
      <p className="doc-p">
        Order yang sudah diterima punya pemilih kurir di{' '}
        <code className="doc-inline">/merchant/orders</code>. Memilih kurir mengisi{' '}
        <code className="doc-inline">MerchantOrder.courierId</code> dan menambah hitungan
        order aktif kurir itu — cermin <code className="doc-inline">C-06</code> (platform
        tidak menugaskan kurir, merchant memilih sendiri) dan edge F12{' '}
        <code className="doc-inline">:assign → hold_cut</code>. Copy status hold diambil dari{' '}
        <code className="doc-inline">HOLD_STATUS_COPY</code>, jadi tidak ada kalimat
        karangan tentang dana.
      </p>
      <h3 className="doc-h3">
        Ulasan pembeli — di luar PRD aktif (UNRESOLVED)
      </h3>
      <p className="doc-p">
        Halaman <code className="doc-inline">/merchant/reviews</code> memberi
        pemilik toko membaca ulasan pembeli per hidangan dan membalasnya. Ini
        <strong> di luar PRD aktif</strong>: tidak ada requirement <code className="doc-inline">R-*</code>
        di <code className="doc-inline">irbid-mvp-v2-2026-09-21</code> (kini <code className="doc-inline">superseded</code>) maupun
        milestone <code className="doc-inline">M0–M11</code> di
        <code className="doc-inline">docs/product/prd/versions/irbid-mvp-v2-2026-09-21/milestones.md</code>
        yang menyebut ulasan atau respons pembeli. Karena itu item ini ditandai
        <code className="doc-inline">UNRESOLVED</code> (out-of-PRD), bukan
        diisi dengan asumsi.
      </p>
      <p className="doc-p">
        Entry-nya kartu "Ulasan Pembeli" di section Kelola dashboard; bottom nav
        tetap 5 tab (keputusan desain tidak diubah). Mock hidup di
        <code className="doc-inline">src/data/merchantReviews.ts</code>, terikat
        ke id katalog nyata (<code className="doc-inline">mm-1..mm-5</code>).
        Balasan disimpan di slice <code className="doc-inline">merchant</code>
        sebagai <code className="doc-inline">reviewReplies</code> dan
        <strong> tidak dipersist</strong> — sama seperti field merchant lain, jadi
        balasan reset saat reload. Form balasan memakai
        <code className="doc-inline">BottomSheet</code> bersama; tidak ada
        komponen, token, atau warna baru.
      </p>
      <h3 className="doc-h3">
        Grafik beranda dapur
      </h3>
      <p className="doc-p">
        Beranda dapur punya <strong>satu titik fokus uang</strong>: kartu pendapatan lebar penuh
        dengan angka <code className="doc-inline">--text-2xl</code> dan sparkline tujuh hari, lalu
        tiga angka antrean turun pangkat jadi satu baris teks 44px. Sebelumnya keempatnya kotak
        seragam di grid 2×2 (terukur 73/73/99/99px dengan semua nilai 17,01px), jadi "Rp256.000"
        dan "2 order" tercetak sama besar dan uangnya tidak menonjol.
      </p>
      <p className="doc-p">
        Komponen{' '}
        <code className="doc-inline">Sparkline</code> ({'{'}komponen ui{'}'}) menggambar satu seri
        sebagai garis di SVG: yang perlu terlihat cuma bentuk harinya, bukan angka tiap titik,
        dan angkanya tetap tersedia lewat <code className="doc-inline">aria-label</code>. Ini
        <strong> menggantikan</strong> bar chart "Tren 7 hari" (371px) yang lalu dihapus: bentuk
        harinya sudah tampil di kartu pendapatan, jadi menampilkannya dua kali bukan kelengkapan.
        Tidak ada library chart baru, dan nada warnanya token yang sama dengan donut/bar.
      </p>
      <p className="doc-p">
        <strong>Menu terjual</strong> adalah blok peringkat menu dari{' '}
        <code className="doc-inline">menuSalesRanking()</code> di{' '}
        <code className="doc-inline">src/data/merchantTrend.ts</code> — diturunkan dari{' '}
        <code className="doc-inline">MerchantOrder.items</code> yang sudah ada
        (<code className="doc-inline">CartItem.quantity × price</code>), jadi <strong>nol mock
        baru</strong>. Order <code className="doc-inline">ditolak</code>/
        <code className="doc-inline">batal</code> tidak dihitung karena tidak pernah jadi
        penjualan.
      </p>
      <p className="doc-p">
        Tiga hal yang sengaja begitu:
      </p>
      <ul className="doc-list">
        <li>
          <strong>Rentangnya disebut, bukan diklaim "sepanjang masa".</strong> Delapan order mock
          adalah sekitar setengah jam terakhir dan bisa saja satu kantor yang pesan bareng; subjudul
          menulis "8 order terakhir".
        </li>
        <li>
          <strong>Bar, bukan donut.</strong> Peringkat dibandingkan urutannya, jadi bar panjang
          relatif 8px lebih terbaca daripada donut. Satu aksen saja: peringkat 1 oranye, sisanya
          muted.
        </li>
        <li>
          <strong>Peringkat memakai IDR saja</strong> (<code className="doc-inline">moneyPlain</code>),
          bukan pasangan IDR+JOD. Dua balok teks yang hanya terpisah 12px terbaca sebagai satu baris
          padat; padanan JOD-nya sudah ada di kartu pendapatan.
        </li>
      </ul>
      <p className="doc-p">
        Dua chart tren juga tetap ditumpuk <strong>penuh lebar</strong>, bukan dua kolom. Percobaan
        dua kolom pernah dibuat untuk memendekkan kartu dan diukur gagal: kolom 150px menyisakan
        11,1px per batang sementara teks nilai selebar 24,4px, jadi nilai tumpang tindih 1,3px di
        lima pasang dan label hari menyatu.
      </p>
      <p className="doc-p">
        Perbandingan COD vs transfer memakai bar dua warna, bukan donut kedua: split 4/4 tidak
        menambah informasi di atas bar, dan donut kedua membuat kartu komposisi 468px (sekarang
        395px).
      </p>
      <h3 className="doc-h3">
        Journey Line di kartu order
      </h3>
      <p className="doc-p">
        Kartu order di <code className="doc-inline">/merchant/orders</code> menampilkan{' '}
        <strong>Journey Line</strong> — simpul Diterima · Dimasak · Diantar · Tiba dengan keadaan
        {' '}<code className="doc-inline">done</code>/<code className="doc-inline">active</code>/
        <code className="doc-inline">todo</code>. Sebelumnya merchant hanya melihat pil status
        ("Dimasak"); posisi pesanan di perjalanannya tidak terlihat, jadi memantau antrean berarti
        menebak.
      </p>
      <p className="doc-p">
        Komponennya yang <strong>sama</strong> dengan layar customer dan tugas kurir (
        <code className="doc-inline">src/components/JourneyLine.tsx</code>) — bukan digambar ulang.
        Ini menjaga aturan AGENTS.md §9: merchant dan kurir memandang order yang sama dari sisi
        berbeda, jadi diturunkan dari satu model.
      </p>
      <p className="doc-p">
        Yang perlu diperhatikan saat memakainya: <code className="doc-inline">MerchantOrderStatus</code>{' '}
        lebih lebar dari <code className="doc-inline">OrderStage</code>. Pemetaannya eksplisit di{' '}
        <code className="doc-inline">JOURNEY_STAGE</code> (bukan cast), supaya menambah status baru
        memaksa keputusan di satu tempat alih-alih diam-diam salah render. Order{' '}
        <code className="doc-inline">masuk</code> belum punya tahap, dan order{' '}
        <code className="doc-inline">ditolak</code>/<code className="doc-inline">batal</code> sudah
        keluar dari rel — keduanya sengaja tidak menampilkan journey.
      </p>
      <h3 className="doc-h3">
        Tipografi kartu order
      </h3>
      <p className="doc-p">
        Kartu order adalah layar tugas dapur, jadi isinya memakai satu langkah skala di
        atas micro-copy: kode dan baris item <code className="doc-inline">--text-base</code>{' '}
        (14,34px), keterangan seperti alamat, catatan hold, dan label{' '}
        <code className="doc-inline">--text-sm</code> (13px), dan total sebagai satu titik
        fokus <code className="doc-inline">--text-lg</code> (16,73px) bobot 700 dengan garis
        pemisah di atasnya. Sebelumnya semuanya 11,56-12,95px, jadi tidak ada hierarki dan
        teksnya terbaca sebagai satu blok padat. Label pemilih kurir dulu ikut tertimpa{' '}
        <code className="doc-inline">.merchant-cook label</code> (0-1-1) karena ia juga
        keturunan <code className="doc-inline">.merchant-cook</code>; sekarang labelnya{' '}
        <code className="doc-inline">.merchant-assign-label</code> (span), lepas dari aturan
        keturunan itu. Tidak ada token atau komponen baru.
      </p>
      <h3 className="doc-h3">
        Kontrol native di kartu order
      </h3>
      <p className="doc-p">
        Antrean order adalah daftar, jadi setiap order satu{' '}
        <strong>baris ringkas</strong> (avatar, kode, pembeli·waktu, ringkasan item, badge, total),
        bukan kartu setinggi satu layar. Detail lengkap (Journey Line, item + harga, alamat, total)
        dan kontrolnya dibuka lewat <code className="doc-inline">BottomSheet</code>. Di dalam sheet,
        estimasi masak adalah segmented 15/20/25/30 (target 44px) menggantikan slider tarik, dan
        kurir adalah daftar dengan pola <code className="doc-inline">.sheet-menu</code> yang sama
        dengan role customer, menggantikan <code className="doc-inline">&lt;select&gt;</code>{' '}
        peramban. Panel sheet dibatasi <code className="doc-inline">max-height: 90vh</code> dengan
        gulir internal, jadi isi panjang tidak meluber keluar layar. Aturan barunya ada di{' '}
        <code className="doc-inline">system/_merchant-orders.scss</code> (dipecah dari{' '}
        <code className="doc-inline">_merchant-2.scss</code> agar tetap di bawah batas baris).
      </p>
    </DocSection>
  )
}
