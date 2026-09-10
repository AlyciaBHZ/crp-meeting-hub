-- Keep existing Storage objects and metadata in place. Both collections now
-- share one per-meeting, per-group limit and are shown in the same agenda card.
create or replace function public.enforce_meeting_pdf_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_meeting uuid;
  target_group uuid;
  pdf_count bigint;
begin
  if tg_table_name = 'slide_files' then
    select meeting_id, group_id into target_meeting, target_group
    from public.agenda_slots where id = new.agenda_slot_id;
  else
    target_meeting := new.meeting_id;
    target_group := new.group_id;
  end if;

  if target_meeting is null or target_group is null then
    raise exception 'Choose a participating group for this meeting.' using errcode = '22023';
  end if;
  perform id from public.agenda_slots
  where meeting_id = target_meeting and group_id = target_group for share;
  if not found then
    raise exception 'Choose a participating group for this meeting.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(target_meeting::text || ':' || target_group::text, 0));
  select
    (select count(*) from public.slide_files file
      join public.agenda_slots slot on slot.id = file.agenda_slot_id
      where slot.meeting_id = target_meeting and slot.group_id = target_group)
    + (select count(*) from public.archive_lab_files
      where meeting_id = target_meeting and group_id = target_group)
    into pdf_count;
  if pdf_count >= 20 then
    raise exception 'Each group can upload up to 20 PDFs for this meeting.' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger enforce_meeting_pdf_limit
before insert on public.slide_files
for each row execute function public.enforce_meeting_pdf_limit();

create trigger enforce_meeting_pdf_limit
before insert on public.archive_lab_files
for each row execute function public.enforce_meeting_pdf_limit();

create or replace function public.reserve_slide_file(
  agenda_slot_id_input uuid,
  display_name_input text,
  original_name_input text,
  size_bytes_input bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_file public.slide_files%rowtype;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;
  if display_name_input is null or length(trim(display_name_input)) < 1 then
    raise exception 'Enter a presenter or document name.' using errcode = '22023';
  end if;
  if length(trim(display_name_input)) > 160 then
    raise exception 'Keep the presenter or document name within 160 characters.' using errcode = '22023';
  end if;
  if original_name_input is null or trim(original_name_input) !~* '\.pdf$' then
    raise exception 'Only PDF files can be uploaded.' using errcode = '22023';
  end if;
  if size_bytes_input is null or size_bytes_input < 1 or size_bytes_input > 52428800 then
    raise exception 'PDFs must be 50 MB or smaller.' using errcode = '22023';
  end if;

  -- Lock the agenda row so an edit cannot remove/reassign the group during an upload.
  perform slot.id from public.agenda_slots slot
  join public.meetings meeting on meeting.id = slot.meeting_id
  where slot.id = agenda_slot_id_input and meeting.meeting_date is not null
  for share of slot;
  if not found then
    raise exception 'Choose a group from a scheduled or past meeting.' using errcode = '22023';
  end if;
  if not public.can_manage_agenda_slot(agenda_slot_id_input) then
    raise exception 'You can upload only for an assigned group.' using errcode = '42501';
  end if;

  new_file.id := gen_random_uuid();
  insert into public.slide_files (
    id, agenda_slot_id, object_path, display_name, original_name, size_bytes, uploaded_by
  ) values (
    new_file.id, agenda_slot_id_input,
    agenda_slot_id_input::text || '/' || new_file.id::text || '.pdf',
    trim(display_name_input), trim(original_name_input), size_bytes_input, auth.uid()
  ) returning * into new_file;
  return to_jsonb(new_file);
end;
$$;

-- A schedule edit must preserve old archive PDFs as well as new uploads.
create or replace function public.protect_agenda_slots_with_slide_files()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.group_id is not distinct from old.group_id
      and new.meeting_id is not distinct from old.meeting_id then
      return new;
    end if;
  end if;
  if exists (select 1 from public.slide_files where agenda_slot_id = old.id)
    or exists (select 1 from public.archive_lab_files
      where meeting_id = old.meeting_id and group_id = old.group_id) then
    raise exception 'This group has meeting PDFs. Keep the group in this meeting to preserve its files.' using errcode = '22023';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_agenda_slots_with_slide_files on public.agenda_slots;
create trigger protect_agenda_slots_with_slide_files
before delete or update of group_id, meeting_id on public.agenda_slots
for each row execute function public.protect_agenda_slots_with_slide_files();

revoke all on function public.enforce_meeting_pdf_limit() from public;
revoke all on function public.reserve_slide_file(uuid, text, text, bigint) from public;
grant execute on function public.reserve_slide_file(uuid, text, text, bigint) to authenticated;
