import { DocSection } from '../DocSection'

export function PrdRevisionSection() {
  return (
    <DocSection id="prd-revision" num="38" title="Revisi PRD Aktif — sa7tein-mvp-2026-10-11">
      <p className="doc-p">
        Revisi aktif diganti pada 2026-10-16: <code className="doc-inline">sa7tein-mvp-2026-10-11</code>{' '}
        menggantikan <code className="doc-inline">irbid-mvp-v2-2026-09-21</code> (kini{' '}
        <code className="doc-inline">superseded</code>). Sumbernya adalah PRD marketplace Yordania
        (47 halaman); keputusan ada di <code className="doc-inline">docs/product/prd/decision-sa7tein-mvp.md</code>.
      </p>
      <p className="doc-p">
        Yang berubah dari model lama: <strong>marketplace</strong> multi-merchant dengan harga{' '}
        <code className="doc-inline">JOD</code> (3 desimal) dan transaksi in-app <code className="doc-inline">IDR</code>;
        delivery <strong>Regular</strong> (kurir inhouse, batch maks 24, auto-sort) dan <strong>Quick</strong>{' '}
        (kurir partner, satu order); pembayaran <code className="doc-inline">qris</code> /{' '}
        <code className="doc-inline">dana_balance</code> / <code className="doc-inline">cod</code> (COD hanya bila
        merchant punya kuota order COD); langganan kuota order & kuota order COD; program marketing ala Odoo;
        rule dispute + SP kurir partner; coverage polygon merchant; auth email magic link.
      </p>
      <p className="doc-p">
        <strong>Deviasi disetujui:</strong> backend tetap <strong>Supabase</strong>, bukan Cloudflare
        Workers + Durable Objects (ARC-01..13) yang dituntut PRD — deviasi ditandai{' '}
        <code className="doc-inline">UNRESOLVED</code>. Peta ada di{' '}
        <code className="doc-inline">docs/backend/PRD-MAPPING-sa7tein-mvp.md</code>; migrasi Supabase{' '}
        <code className="doc-inline">supabase/31-sa7tein-mvp.sql</code>; kontrak{' '}
        <code className="doc-inline">docs/backend/openapi.yaml</code> (0.3.0-draft). Blocker keras yang belum
        diputuskan: <code className="doc-inline">OPEN-01</code> (DANA), <code className="doc-inline">OPEN-02</code>{' '}
        (kurs), <code className="doc-inline">OPEN-26</code> (enum status).
      </p>
    </DocSection>
  )
}
