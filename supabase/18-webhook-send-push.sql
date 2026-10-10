-- =============================================================================
-- Sa7tein — Database Webhook (via pg_net) : notifications INSERT → Edge Function
-- =============================================================================
-- Mengganti langkah "Database Webhook" Dashboard dengan trigger SQL. Panggilan
-- HTTP dilakukan asinkron oleh pg_net; service-role disimpan terenkripsi di
-- Supabase Vault (TIDAK di repo).
--
-- Prasyarat (jalankan sekali, manual — isi service_role Anda):
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'send_push_service_key',
--                              'service-role untuk webhook send-push');
-- =============================================================================

begin;

create extension if not exists pg_net;

create or replace function public.notifications_send_push()
returns trigger language plpgsql security definer set search_path = public, net, extensions
as $$
declare svc text;
begin
  select decrypted_secret into svc from vault.decrypted_secrets
    where name = 'send_push_service_key' limit 1;
  perform net.http_post(
    url := 'https://dwzxtnfesmpobnepilhl.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(svc, '')
    ),
    body := jsonb_build_object('type', 'INSERT', 'table', 'notifications', 'record', to_jsonb(new))
  );
  return new;
end $$;

drop trigger if exists notifications_send_push on public.notifications;
create trigger notifications_send_push
  after insert on public.notifications
  for each row execute function public.notifications_send_push();

commit;
