import { useState } from 'react'

import { DOC_NAV } from './documentation/nav'
import { DOC_SHELLS } from './documentation/routes'
import { IntroductionSection } from './documentation/sections/IntroductionSection'
import { WhatsNewSection } from './documentation/sections/WhatsNewSection'
import { PagesRoutesSection } from './documentation/sections/PagesRoutesSection'
import { FileStructureSection } from './documentation/sections/FileStructureSection'
import { InstallationSection } from './documentation/sections/InstallationSection'
import { RouteProtectionSection } from './documentation/sections/RouteProtectionSection'
import { StateManagementSection } from './documentation/sections/StateManagementSection'
import { PwaSection } from './documentation/sections/PwaSection'
import { StylingSection } from './documentation/sections/StylingSection'
import { FormsSection } from './documentation/sections/FormsSection'
import { ComponentsSection } from './documentation/sections/ComponentsSection'
import { CourierDesignSection } from './documentation/sections/CourierDesignSection'
import { AdminDesignSection } from './documentation/sections/AdminDesignSection'
import { CurrencySection } from './documentation/sections/CurrencySection'
import { CheckoutFeeSection } from './documentation/sections/CheckoutFeeSection'
import { CodHoldSection } from './documentation/sections/CodHoldSection'
import { DeliveryCheckpointSection } from './documentation/sections/DeliveryCheckpointSection'
import { DisputeSection } from './documentation/sections/DisputeSection'
import { ConsistencySection } from './documentation/sections/ConsistencySection'
import { SuperAdminSection } from './documentation/sections/SuperAdminSection'
import { AddressZoneSection } from './documentation/sections/AddressZoneSection'
import { IncentiveSection } from './documentation/sections/IncentiveSection'
import { LedgerSection } from './documentation/sections/LedgerSection'
import { PushSection } from './documentation/sections/PushSection'
import { TaxSection } from './documentation/sections/TaxSection'
import { WalletSection } from './documentation/sections/WalletSection'
import { BackendSection } from './documentation/sections/BackendSection'
import { MerchantDesignSection } from './documentation/sections/MerchantDesignSection'
import { LayoutExceptionsSection } from './documentation/sections/LayoutExceptionsSection'
import { LandingSection } from './documentation/sections/LandingSection'
import { DesignTokensSection } from './documentation/sections/DesignTokensSection'
import { ButtonsSection } from './documentation/sections/ButtonsSection'
import { ElementsSection } from './documentation/sections/ElementsSection'
import { MotionIconsSection } from './documentation/sections/MotionIconsSection'
import { AuthSection } from './documentation/sections/AuthSection'
import { AppPolishSection } from './documentation/sections/AppPolishSection'
import { ChangelogSection } from './documentation/sections/ChangelogSection'

const SECTIONS = [
  IntroductionSection,
  WhatsNewSection,
  PagesRoutesSection,
  FileStructureSection,
  InstallationSection,
  RouteProtectionSection,
  StateManagementSection,
  PwaSection,
  StylingSection,
  FormsSection,
  ComponentsSection,
  BackendSection,
  MerchantDesignSection,
  LayoutExceptionsSection,
  LandingSection,
  DesignTokensSection,
  ButtonsSection,
  ElementsSection,
  MotionIconsSection,
  CourierDesignSection,
  AdminDesignSection,
  CurrencySection,
  CheckoutFeeSection,
  WalletSection,
  CodHoldSection,
  DeliveryCheckpointSection,
  DisputeSection,
  TaxSection,
  PushSection,
  LedgerSection,
  IncentiveSection,
  AddressZoneSection,
  ConsistencySection,
  SuperAdminSection,
  AuthSection,
  ChangelogSection,
  AppPolishSection,
]

// `SECTIONS` dan `DOC_NAV` (src/pages/documentation/nav.ts) dipakai berpasangan:
// render di bawah memakai DOC_NAV[index] sebagai key. Panjang yang tidak sama
// membuat entri terakhir undefined dan halaman ini mati tanpa pesan jelas —
// terjadi saat satu section ditambahkan tanpa entri nav. Gagalkan lebih awal
// dengan pesan yang menyebut sebabnya.
if (SECTIONS.length !== DOC_NAV.length) {
  throw new Error(
    `Documentation: SECTIONS (${SECTIONS.length}) dan DOC_NAV (${DOC_NAV.length}) tidak sepanjang`,
  )
}

const HERO_TAGS = [
  'React 19 + Vite',
  'React 19',
  'TypeScript',
  'Redux Toolkit',
  'SCSS',
  'PWA',
  'Zod',
  'React Hook Form',
]

export default function Documentation() {
  const [active, setActive] = useState(0)
  // Sidebar di layar sempit tergeser keluar (`translateX(-100%)`) dan hanya
  // kelas `.open` yang memunculkannya. Sebelum ini tidak ada yang pernah
  // menambah `.open`, sementara tombol hamburger tidak punya handler: jadi di
  // ponsel daftar isi tidak bisa dibuka sama sekali. State ini yang menutupnya.
  const [navOpen, setNavOpen] = useState(false)

  const goTo = (index: number, id: string) => {
    setActive(index)
    setNavOpen(false)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
    <div className="app-shell">
      <div className="doc-root">
        <div className="doc-topbar">
          <span className="doc-topbar-logo">
            Sa7tein
          </span>
          <button
            className="doc-hamburger"
            aria-label="Buka daftar isi"
            aria-expanded={navOpen}
            aria-controls="doc-nav"
            onClick={() => setNavOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
        <div
          className={`doc-overlay${navOpen ? ' open' : ''}`}
          onClick={() => setNavOpen(false)}
        />
        <aside className={`doc-sidebar${navOpen ? ' open' : ''}`} id="doc-nav">
          <div className="doc-sidebar-logo">
            <span className="doc-logo-mark">
              Sa7tein
            </span>
            <span className="doc-logo-sub">
              Documentation
            </span>
          </div>
          <div className="doc-sidebar-version">
            <span className="doc-version-badge">
              v3.2.0
            </span>
            <span>
              React 19 · Vite · TypeScript
            </span>
          </div>
          <nav className="doc-nav">
            <div className="doc-nav-label">
              Contents
            </div>
            {DOC_NAV.map((item, index) => (
              <button
                key={item.id}
                className={`doc-nav-item ${active === index ? 'active' : ''}`}
                onClick={() => goTo(index, item.id)}
              >
                <span className="doc-nav-num">
                  {item.num}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <main className="doc-main">
          <div className="doc-hero">
            <div className="doc-hero-eyebrow">
              Documentation
            </div>
            <h1 className="doc-hero-title">
              Sa7tein 
              <span>
                PWA
              </span>
              <br />
              Developer Guide
            </h1>
            <p className="doc-hero-desc">
              Panduan PWA Sa7tein: tiap peran punya prefix URL dan instalasi sendiri (/customer, /merchant, /courier, /admin — panel admin yang dikelola CS). Super Admin adalah role terpisah: website penuh non-PWA di /superadmin, dengan Ringkasan berupa dashboard chart tulis tangan (donut + bar, tanpa library). Landing dengan satu aksi utama per section, cache yang aman, scroll native, dan simulator desktop yang scroll-nya terkunci pada layar perangkat. Kartu promo beranda kini bergaya kartu (lingkaran sepusat di atas oranye merek, tanpa gradient) dengan bilah aksi selebar kartu. Beranda dapur merchant memakai hero oranye bergaya beranda pelanggan (bidang + pola gelombang bersama) yang menyatukan identitas toko, status buka/tutup, dan kuota harian; modal aplikasi di-portal ke body supaya tidak lagi tertutup bilah nav. Konfirmasi merchant kini seragam lewat ConfirmSheet dengan dua tombol sejajar, dan kepala tiap grup kategori di daftar menu menempel tepat di bawah bar filter (offset diukur runtime) sehingga label kategori tetap terbaca saat digulir. Menu merchant disaring per kategori (chip Makanan/Minuman/Camilan) plus status stok di satu bar sticky, dan daftar dikelompokkan per kategori. Dompet merchant kini ada: saldo dari order selesai, pencairan ke rekening (Xendit payout, flow f6), plus CRUD rekening tujuan dengan satu rekening utama. Dompet kurir menyusul dengan aturan yang berbeda: hanya menampung tips (ongkir dan gaji bukan milik kurir, C-06), saldonya diturunkan dari tips dikurangi pencairan, fee payout Rp2.500 ditanggung kurir dan dipotong dari nilai tarik, dengan ambang akumulasi yang masih contoh PRD (ditandai jelas, belum final) plus CRUD rekening tujuan. Beranda kurir kini berupa dashboard: identitas + status siap/jeda dalam satu kartu, ringkasan hari ini, kartu performa tujuh hari (sparkline tips) plus menu dua kolom berisi pintasan dompet tips, rekening, riwayat tips, dan profil, baru daftar tugas berjalan dan riwayat. Onboarding kini lengkap per peran (keputusan PO 2026-09-25): merchant mengisi form profil toko di /merchant/onboarding (identitas + foto + konfigurasi pengiriman) setelah daftar sebelum menunggu persetujuan, dan kurir punya layar onboarding sendiri di /courier/onboarding (nama, nomor WA, kendaraan) sebelum masuk.
            </p>
            <p className="doc-p">
              Terbaru (2026-10-09): Home customer memuat kartu{' '}
              <strong>Konversi Kurs</strong> IDR↔JOD dua arah dengan tombol tukar. Rate-nya
              di-cache sekali sehari di peramban (
              <code className="doc-inline">useDailyExchangeRate</code>) — lihat bagian{' '}
              <em>Mata Uang — IDR + JOD</em> untuk aturan dan UNRESOLVED-nya.
            </p>
            <div className="doc-hero-tags">
              {HERO_TAGS.map((tag) => (
                <span key={tag} className="doc-hero-tag">
                  {tag}
                </span>
              ))}
            </div>
            <p className="doc-p doc-hero-cta-label">
              Buka UI langsung — tiap tautan membuka role di tab baru, tanpa login
              (semua data mock):
            </p>
            <div className="doc-cta-grid">
              {DOC_SHELLS.map((s) => (
                <a key={s.role} className="doc-cta" href={s.url} target="_blank" rel="noreferrer">
                  <span className="doc-cta-role">{s.role}</span>
                  <span className="doc-cta-url">{s.url}</span>
                  <span className="doc-card-sub">{s.desc}</span>
                </a>
              ))}
            </div>
          </div>
          {SECTIONS.map((Section, index) => (
            <Section key={DOC_NAV[index].id} />
          ))}
        </main>
      </div>
    </div>
    </>
  )
}
