create table public.archive_lab_files (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete restrict,
  bucket_id text not null default 'archive-lab-files' check (bucket_id = 'archive-lab-files'),
  object_path text not null unique,
  original_name text not null check (length(trim(original_name)) > 4 and original_name ~* '\.pdf$'),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

create index archive_lab_files_meeting_group_idx
on public.archive_lab_files (meeting_id, group_id, uploaded_at);

alter table public.archive_lab_files enable row level security;

create policy "members read archived Lab PDFs" on public.archive_lab_files for select to authenticated
using (public.is_member());

create policy "uploaders remove failed PDF reservations" on public.archive_lab_files for delete to authenticated
using (uploaded_by = auth.uid() or public.is_admin());

grant select, delete on table public.archive_lab_files to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('archive-lab-files', 'archive-lab-files', false, 52428800, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "members download archived Lab PDFs" on storage.objects for select to authenticated
using (
  bucket_id = 'archive-lab-files'
  and public.is_member()
  and exists (
    select 1 from public.archive_lab_files file
    where file.object_path = storage.objects.name
  )
);

create policy "reserved archived Lab PDF uploads" on storage.objects for insert to authenticated
with check (
  bucket_id = 'archive-lab-files'
  and exists (
    select 1 from public.archive_lab_files file
    where file.object_path = storage.objects.name
      and file.uploaded_by = auth.uid()
  )
);

create or replace function public.reserve_archive_lab_file(
  meeting_id_input uuid,
  group_id_input uuid,
  original_name_input text,
  size_bytes_input bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  new_file public.archive_lab_files%rowtype;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;
  if original_name_input is null or trim(original_name_input) !~* '\.pdf$' then
    raise exception 'Only PDF files can be archived.' using errcode = '22023';
  end if;
  if size_bytes_input is null or size_bytes_input < 1 or size_bytes_input > 52428800 then
    raise exception 'PDF files must be 50 MB or smaller.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.meetings meeting
    join public.agenda_slots slot on slot.meeting_id = meeting.id
    where meeting.id = meeting_id_input
      and meeting.meeting_date < (now() at time zone 'Asia/Singapore')::date
      and slot.group_id = group_id_input
  ) then
    raise exception 'Choose a Lab from this archived meeting.' using errcode = '22023';
  end if;
  if not public.is_admin() and not exists (
    select 1 from public.group_members membership
    where membership.group_id = group_id_input and membership.profile_id = auth.uid()
  ) then
    raise exception 'You can upload only for your assigned Lab.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(meeting_id_input::text || ':' || group_id_input::text, 0));
  if (select count(*) >= 20 from public.archive_lab_files where meeting_id = meeting_id_input and group_id = group_id_input) then
    raise exception 'Each Lab can store up to 20 PDFs for this meeting.' using errcode = '22023';
  end if;

  new_file.id := gen_random_uuid();
  insert into public.archive_lab_files (
    id, meeting_id, group_id, object_path, original_name, size_bytes, uploaded_by
  ) values (
    new_file.id,
    meeting_id_input,
    group_id_input,
    meeting_id_input::text || '/' || group_id_input::text || '/' || new_file.id::text || '.pdf',
    trim(original_name_input),
    size_bytes_input,
    auth.uid()
  ) returning * into new_file;

  return to_jsonb(new_file);
end;
$$;

create or replace function public.register_historical_meeting(
  meeting_date_input date,
  slots_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_meeting_id uuid;
  slot jsonb;
  selected_group public.groups%rowtype;
  starts_at_input time;
  ends_at_input time;
  sort_order_input integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if meeting_date_input is null then
    raise exception 'Meeting date is required.' using errcode = '22023';
  end if;
  if meeting_date_input >= (now() at time zone 'Asia/Singapore')::date then
    raise exception 'Historical meetings must use a date before today.' using errcode = '22023';
  end if;
  if slots_input is null or jsonb_typeof(slots_input) <> 'array' or jsonb_array_length(slots_input) = 0 then
    raise exception 'At least one presenting group is required.' using errcode = '22023';
  end if;
  if (
    select count(*) <> count(distinct (value ->> 'sort_order')::integer)
      or count(*) <> count(distinct value ->> 'group_id')
    from jsonb_array_elements(slots_input)
  ) then
    raise exception 'Agenda groups and order values must be unique.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(slots_input) first_slot
    cross join jsonb_array_elements(slots_input) second_slot
    where (first_slot ->> 'sort_order')::integer < (second_slot ->> 'sort_order')::integer
      and (first_slot ->> 'starts_at')::time < (second_slot ->> 'ends_at')::time
      and (second_slot ->> 'starts_at')::time < (first_slot ->> 'ends_at')::time
  ) then
    raise exception 'Agenda times cannot overlap.' using errcode = '22023';
  end if;

  insert into public.meetings (title, meeting_date, status)
  values ('CRP Grant Meeting', meeting_date_input, 'archived')
  returning id into new_meeting_id;

  for slot in select value from jsonb_array_elements(slots_input)
  loop
    select * into selected_group
    from public.groups
    where id = (slot ->> 'group_id')::uuid;
    if not found then
      raise exception 'Every agenda group must exist.' using errcode = '22023';
    end if;

    starts_at_input := (slot ->> 'starts_at')::time;
    ends_at_input := (slot ->> 'ends_at')::time;
    sort_order_input := (slot ->> 'sort_order')::integer;
    if ends_at_input <= starts_at_input or sort_order_input < 1 then
      raise exception 'Every agenda slot requires a valid time range and order.' using errcode = '22023';
    end if;

    insert into public.agenda_slots (
      meeting_id, starts_at, ends_at, group_name, group_id, sort_order
    ) values (
      new_meeting_id, starts_at_input, ends_at_input, selected_group.name, selected_group.id, sort_order_input
    );
  end loop;

  return new_meeting_id;
end;
$$;

revoke all on function public.reserve_archive_lab_file(uuid, uuid, text, bigint) from public;
grant execute on function public.reserve_archive_lab_file(uuid, uuid, text, bigint) to authenticated;
revoke all on function public.register_historical_meeting(date, jsonb) from public;
grant execute on function public.register_historical_meeting(date, jsonb) to authenticated;
