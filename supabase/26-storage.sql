-- =============================================================================
-- Sa7tein — Storage: bucket unggahan + RLS (menu, foto toko, avatar)
-- Baca publik; tulis/hapus hanya pemilik folder (uid).
-- =============================================================================

begin;

insert into storage.buckets (id, name, public) values
  ('menu-images', 'menu-images', true),
  ('merchant-photos', 'merchant-photos', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sa7tein_public_read') then
    create policy sa7tein_public_read on storage.objects for select to public
      using (bucket_id in ('menu-images','merchant-photos','avatars'));
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sa7tein_owner_write') then
    create policy sa7tein_owner_write on storage.objects for insert to authenticated
      with check (bucket_id in ('menu-images','merchant-photos','avatars')
                  and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sa7tein_owner_update') then
    create policy sa7tein_owner_update on storage.objects for update to authenticated
      using ((storage.foldername(name))[1] = auth.uid()::text)
      with check ((storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='sa7tein_owner_delete') then
    create policy sa7tein_owner_delete on storage.objects for delete to authenticated
      using ((storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;

commit;
