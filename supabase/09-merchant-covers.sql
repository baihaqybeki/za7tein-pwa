-- =============================================================================
-- Sa7tein — cover toko per merchant (foto lebih relevan & variatif)
-- =============================================================================
-- Aset lokal: public/assets/img/merchant/<slug>.svg (SVG branded: inisial +
-- palet unik per toko — bukan ilustrasi stok, bukan URL eksternal).
-- Mengisi merchants.photo yang sebelumnya NULL. Aditif & idempoten.
-- =============================================================================

begin;

update public.merchants set photo = '/assets/img/merchant/warung-sate-pak-ali.svg'        where id = 1;
update public.merchants set photo = '/assets/img/merchant/sate-kambing-haji-umar.svg'     where id = 2;
update public.merchants set photo = '/assets/img/merchant/nasi-goreng-bu-ratna.svg'       where id = 3;
update public.merchants set photo = '/assets/img/merchant/lontong-sayur-mak-cik.svg'      where id = 4;
update public.merchants set photo = '/assets/img/merchant/kedai-sate-pak-tono.svg'        where id = 5;
update public.merchants set photo = '/assets/img/merchant/warung-nasi-goreng-mas-budi.svg' where id = 6;
update public.merchants set photo = '/assets/img/merchant/sate-kambing-sederhana.svg'     where id = 7;
update public.merchants set photo = '/assets/img/merchant/teahouse-segar-irbid.svg'       where id = 8;
update public.merchants set photo = '/assets/img/merchant/dapur-nusantara-irbid.svg'      where id = 9;

commit;
