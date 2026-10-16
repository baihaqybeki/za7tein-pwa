-- =============================================================================
-- Sa7tein — pastikan bucket Storage ada (idempoten)
-- =============================================================================
-- Konteks: `26-storage.sql` mendefinisikan bucket menu-images/merchant-photos/
-- avatars + RLS, tetapi pada DB live bucket-nya hilang (policy ada, bucket tidak)
-- sehingga unggah foto merchant/menu/avatar gagal (keluhan FE: "profil toko
-- (…, foto) belum bisa disimpan"). Migrasi ini memastikan bucket ada lagi.
--
-- Tidak mengubah docs. PostgREST/Storage API yang dipakai FE lewat
-- `src/api/storage.ts` (`uploadToBucket`). Path objek = `<auth.uid()>/berkas`.
-- =============================================================================

insert into storage.buckets (id, name, public) values
  ('menu-images', 'menu-images', true),
  ('merchant-photos', 'merchant-photos', true),
  ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;
