-- =============================================================================
-- Sa7tein — lengkapi kolom MerchantRecord di tabel `merchants`
-- =============================================================================
-- FE `MerchantRecord` memakai owner, ownerPhone, city, tier, isActiveHijazi,
-- isActiveSyimali, codIssues, approvedAt, statusReason — kolomnya belum ada di
-- DB. Aditif & idempoten.
-- =============================================================================

begin;

alter table public.merchants add column if not exists owner text;
alter table public.merchants add column if not exists owner_phone text;
alter table public.merchants add column if not exists city text;
alter table public.merchants add column if not exists tier text not null default 'free'
  check (tier in ('free', 'pro'));
alter table public.merchants add column if not exists is_active_hijazi boolean not null default false;
alter table public.merchants add column if not exists is_active_syimali boolean not null default false;
alter table public.merchants add column if not exists cod_issues integer not null default 0;
alter table public.merchants add column if not exists approved_at timestamptz;
alter table public.merchants add column if not exists status_reason text;

update public.merchants as m set
  owner = v.owner,
  owner_phone = coalesce(m.owner_phone, m.store_phone),
  city = 'Irbid',
  tier = v.tier,
  is_active_hijazi = true,
  is_active_syimali = true,
  cod_issues = v.cod,
  approved_at = m.created_at,
  status_reason = null
from (values
  (1, 'Ali Santoso',   'pro',  0),
  (2, 'Umar Haddad',   'pro',  1),
  (3, 'Ratna Sari',    'free', 0),
  (4, 'Nur Aisyah',    'free', 0),
  (5, 'Tono Wijaya',   'pro',  0),
  (6, 'Budi Santoso',  'free', 2),
  (7, 'Hasan Basri',   'pro',  0),
  (8, 'Lina Khalil',   'free', 0),
  (9, 'Ahmad Fauzi',   'pro',  0)
) as v(id, owner, tier, cod)
where m.id = v.id;

commit;
