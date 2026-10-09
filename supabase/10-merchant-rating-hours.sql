-- =============================================================================
-- Sa7tein — rating + jam operasional per merchant
-- =============================================================================
-- Menambah kolom yang belum ada (frontend menampilkan kosong) lalu mengisi.
-- rating_avg/rating_count denormalized (agregat rating_reviews) supaya katalog
-- bisa menampilkan tanpa join; sumber ulangnya `rating_reviews`.
-- open_time/close_time = jam operasional harian.
-- Aditif & idempoten.
-- =============================================================================

begin;

alter table public.merchants add column if not exists rating_avg numeric(3, 2) not null default 0;
alter table public.merchants add column if not exists rating_count integer not null default 0;
alter table public.merchants add column if not exists open_time time;
alter table public.merchants add column if not exists close_time time;

-- seed per merchant (rating, jumlah ulasan, jam buka-tutup)
update public.merchants as m set rating_avg = v.r, rating_count = v.c, open_time = v.o, close_time = v.cl
from (values
  (1, 4.80::numeric, 214, '07:00'::time, '22:00'::time),
  (2, 4.70, 168, '10:00', '23:00'),
  (3, 4.60,  92, '06:30', '21:00'),
  (4, 4.50,  57, '06:00', '14:00'),
  (5, 4.90, 301, '11:00', '23:30'),
  (6, 4.40,  78, '07:00', '22:00'),
  (7, 4.70, 143, '10:30', '23:00'),
  (8, 4.60,  66, '08:00', '23:00'),
  (9, 4.80, 256, '07:00', '22:30')
) as v(id, r, c, o, cl)
where m.id = v.id;

commit;
