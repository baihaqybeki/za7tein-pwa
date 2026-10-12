-- =============================================================================
-- Sa7tein — kolom entity UI yang belum ada di backend
-- =============================================================================

begin;

-- users: profil generik
alter table public.users add column if not exists name text;
alter table public.users add column if not exists dob date;
alter table public.users add column if not exists gender text check (gender in ('male', 'female', 'other'));
alter table public.users add column if not exists avatar text;

-- customers
alter table public.customers add column if not exists avatar text;
alter table public.customers add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended', 'blocked'));

-- couriers
alter table public.couriers add column if not exists phone text;
alter table public.couriers add column if not exists phone_verified boolean not null default false;
alter table public.couriers add column if not exists active_order_count integer not null default 0;

-- menus
alter table public.menus add column if not exists discount_percent integer check (discount_percent between 0 and 100);
alter table public.menus add column if not exists is_popular boolean not null default false;
alter table public.menus add column if not exists calories integer;

-- orders: verifikasi serah terima (OTP) + estimasi masak
alter table public.orders add column if not exists otp text;
alter table public.orders add column if not exists otp_verified boolean not null default false;
alter table public.orders add column if not exists cook_minutes integer;

-- seed
update public.users u set name = c.name from public.customers c where c.user_id = u.id and u.name is null;
update public.users u set name = m.owner from public.merchants m where m.user_id = u.id and u.name is null;
update public.users u set name = co.name from public.couriers co where co.user_id = u.id and u.name is null;
update public.users set avatar = coalesce(avatar, '/assets/img/profile.png'),
                        dob = coalesce(dob, date '1995-01-01'),
                        gender = coalesce(gender, 'male')
  where avatar is null or dob is null or gender is null;

update public.customers set avatar = coalesce(avatar, '/assets/img/profile.png'), status = coalesce(status, 'active');
update public.couriers set phone = coalesce(phone, (select phone from public.users u where u.id = couriers.user_id)),
                           phone_verified = coalesce(phone_verified, true);

update public.menus set discount_percent = case when id % 3 = 0 then 20 when id % 3 = 1 then 10 else null end,
                        is_popular = (id % 4 = 0),
                        calories = 200 + (id * 13 % 600);

update public.orders set otp = coalesce(otp, lpad((1000 + (id * 7) % 9000)::text, 4, '0')), cook_minutes = coalesce(cook_minutes, 20);

commit;
