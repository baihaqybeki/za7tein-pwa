-- =============================================================================
-- Sa7tein — notifikasi journey otomatis per step × role (server-side)
-- =============================================================================
-- Trigger pada `orders`: saat status berubah, tulis baris `notifications` untuk
-- tiap peran yang relevan (customer/merchant/courier). INSERT ini memicu webhook
-- pg_net → Edge Function `send-push` → VAPID. Jadi push tiap step jalan tanpa FE.
-- Aditif & idempoten.
-- =============================================================================

begin;

create or replace function public.orders_journey_notify()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  cust_user  bigint;
  merch_user bigint;
  cour_user  bigint;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  select u.id into cust_user
    from customers c join users u on u.id = c.user_id where c.id = new.customer_id;
  select u.id into merch_user
    from merchants m join users u on u.id = m.user_id where m.id = new.merchant_id;
  select u.id into cour_user
    from couriers co join users u on u.id = co.user_id where co.id = new.courier_id;

  -- Customer
  if cust_user is not null then
    if new.status = 'prepare' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cust_user, 'order', 'Pesanan sedang disiapkan', 'Toko mulai menyiapkan pesananmu.', 'order', 'customer');
    elsif new.status = 'waitingDelivery' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cust_user, 'order', 'Kurir ditugaskan', 'Kurir akan mengantar pesananmu.', 'courier', 'customer');
    elsif new.status = 'delivery' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cust_user, 'order', 'Kurir menuju lokasimu', 'Kurir sedang mengantar pesananmu.', 'courier', 'customer');
    elsif new.status = 'done' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cust_user, 'order', 'Pesanan selesai', 'Pesananmu sudah diterima.', 'order', 'customer');
    elsif new.status = 'canceled' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cust_user, 'order', 'Pesanan dibatalkan', 'Pesananmu dibatalkan.', 'order', 'customer');
    end if;
  end if;

  -- Merchant
  if merch_user is not null then
    if new.status = 'delivery' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (merch_user, 'order', 'Kurir berangkat', 'Pesanan dalam pengantaran.', 'order', 'merchant');
    elsif new.status = 'done' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (merch_user, 'order', 'Order selesai', 'Pesanan telah selesai.', 'order', 'merchant');
    elsif new.status = 'canceled' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (merch_user, 'order', 'Order dibatalkan', 'Pesanan dibatalkan.', 'order', 'merchant');
    end if;
  end if;

  -- Courier
  if cour_user is not null then
    if new.status = 'waitingDelivery' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cour_user, 'courier', 'Tugas baru', 'Kamu ditugaskan mengantar pesanan.', 'courier', 'courier');
    elsif new.status = 'done' then
      insert into notifications (user_id, kind, title, body, sound, audience)
        values (cour_user, 'courier', 'Tugas selesai', 'Pengantaran selesai.', 'courier', 'courier');
    end if;
  end if;

  return new;
end $$;

drop trigger if exists orders_journey_notify on public.orders;
create trigger orders_journey_notify
  after update of status on public.orders
  for each row execute function public.orders_journey_notify();

commit;
