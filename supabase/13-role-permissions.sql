-- =============================================================================
-- Sa7tein — katalog permission + role permission Super Admin
-- =============================================================================
-- Menyelaraskan roles.permissions ke id kanonik (src/data/superadmin.ts) dan
-- menambah tabel `permissions` sebagai definisi. Aditif & idempoten.
-- =============================================================================

begin;

-- 1) katalog permission (definisi)
create table if not exists public.permissions (
  key        text primary key,
  label      text not null,
  group_name text not null check (group_name in ('platform', 'operasi'))
);

insert into public.permissions (key, label, group_name) values
  ('zone.edit',        'Ubah poligon master zona',        'platform'),
  ('role.manage',      'Kelola role & permission',        'platform'),
  ('operator.manage',  'Buat & nonaktifkan operator',     'platform'),
  ('audit.read',       'Baca audit trail',                'platform'),
  ('tax.read',         'Baca laporan pajak',              'platform'),
  ('profit.read',      'Lihat saldo keuntungan',          'platform'),
  ('profit.withdraw',  'Tarik saldo keuntungan',          'platform'),
  ('switch.toggle',    'Ubah kill switch',                'platform'),
  ('ledger.read',      'Pantau ledger (read-only)',       'platform'),
  ('user.read',        'Lihat registri pengguna',         'platform'),
  ('tenant.status',    'Suspend & aktifkan kembali tenant','platform'),
  ('appeal.decide',    'Putuskan banding sengketa',       'platform'),
  ('tenant.approve',   'Setujui tenant & deposit',        'operasi'),
  ('tenant.reject',    'Tolak / suspend tenant',          'operasi'),
  ('dispute.level1',   'Putusan sengketa level-1',        'operasi'),
  ('cod.blacklist',    'Blacklist COD',                   'operasi'),
  ('liability.read',   'Lihat dashboard liability',       'operasi'),
  ('escalate.handle',  'Tindak alert SLA',                'operasi')
on conflict (key) do update set label = excluded.label, group_name = excluded.group_name;

alter table public.permissions enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='permissions' and policyname='permissions_public_read') then
    create policy permissions_public_read on public.permissions for select to public using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='permissions' and policyname='permissions_ops') then
    create policy permissions_ops on public.permissions for all to public
      using (public.app_is_ops()) with check (public.app_is_ops());
  end if;
end $$;

-- 2) set ulang role permission (id kanonik)
-- owner = semua platform; sa_ops = subset; cs_ops = grup operasi
update public.roles set permissions = '[
  "zone.edit","role.manage","operator.manage","audit.read","tax.read","profit.read",
  "profit.withdraw","switch.toggle","ledger.read","user.read","tenant.status","appeal.decide"
]'::jsonb where key = 'sa_owner';

update public.roles set permissions = '[
  "zone.edit","audit.read","tax.read","profit.read","ledger.read","user.read"
]'::jsonb where key = 'sa_ops';

update public.roles set permissions = '[
  "tenant.approve","tenant.reject","dispute.level1","cod.blacklist","liability.read","escalate.handle"
]'::jsonb where key = 'cs_ops';

commit;
