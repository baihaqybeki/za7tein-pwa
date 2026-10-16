-- =============================================================================
-- Sa7tein — AP6.3 terbitkan SP/punishment kurir partner (§17.3.3, §9.5)
-- =============================================================================
begin;

create or replace function public.issue_sp(
  p_subject_type text, p_subject_id bigint, p_kind text default 'sp',
  p_level integer default 1, p_reason text default null, p_dispute bigint default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if not public.app_is_ops() then raise exception 'hanya ops yang boleh menerbitkan SP'; end if;
  if p_subject_type not in ('merchant', 'courier', 'customer') then raise exception 'subjek tidak valid'; end if;
  if p_kind not in ('sp', 'fine', 'suspend') then raise exception 'jenis punishment tidak valid'; end if;
  insert into public.punishments (subject_type, subject_id, kind, level, reason, dispute_id)
    values (p_subject_type, p_subject_id, p_kind, p_level, p_reason, p_dispute)
    returning id into v_id;
  if p_subject_type = 'courier' and p_kind = 'sp' then
    update public.couriers set availability = 'unavailable' where id = p_subject_id;
  end if;
  return v_id;
end $$;

commit;
