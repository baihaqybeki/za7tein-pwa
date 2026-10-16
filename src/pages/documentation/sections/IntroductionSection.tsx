import { DocSection } from '../DocSection'

export function IntroductionSection() {
  return (
    <DocSection id="introduction" num="01" title="Introduction">
      <p className="doc-p">
        <strong style={{ color: 'var(--text-primary)' }}>
          Sa7tein
        </strong>
         is a React 19 + Vite UI/UX showcase with mock data. Product authority lives in the PRD manifest; the current active revision is <code>sa7tein-mvp-2026-10-11</code> (Jordan marketplace: JOD pricing, Regular/Quick delivery, DANA, quota subscriptions), while some screens still reflect the earlier Irbid/radius PRD. Backend is kept on Supabase as an approved deviation from the PRD's Cloudflare Workers/DO architecture.
      </p>
      <p className="doc-p">
        Product versions and milestone decisions: <code>docs/product/prd/manifest.json</code> and <code>docs/product/prd/</code>. Mandatory UI/UX rules: <code>docs/design/DNA.md</code>. Backend integration is documented as a future handoff, not implemented here.
      </p>
      <p className="doc-p">
        The app covers the complete food delivery user journey end-to-end:
      </p>
      <div className="doc-grid">
        <div className="doc-card">
          <div className="doc-card-title">
            Onboarding
          </div>
          <div className="doc-card-sub">
            Splash, carousel, account setup wizard
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            Authentication
          </div>
          <div className="doc-card-sub">
            Sign in, sign up, forgot password, OTP
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            Discovery
          </div>
          <div className="doc-card-sub">
            Home, search, filters, menu detail, favorites
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            Order &amp; Checkout
          </div>
          <div className="doc-card-sub">
            Cart, address, payment, tracking, rating
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            Profile &amp; Settings
          </div>
          <div className="doc-card-sub">
            Photo, password, notifications, PIN, security
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            Payments
          </div>
          <div className="doc-card-sub">
            Wallet, add card, billing address, email verify
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            PWA
          </div>
          <div className="doc-card-sub">
            Installable, offline-capable, service worker
          </div>
        </div>
        <div className="doc-card">
          <div className="doc-card-title">
            40+ Screens
          </div>
          <div className="doc-card-sub">
            Full parity with HTML prototype
          </div>
        </div>
      </div>
    </DocSection>
  )
}
