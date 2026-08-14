create table public.slide_files (
  id uuid primary key default gen_random_uuid(),
  agenda_slot_id uuid not null references public.agenda_slots(id) on delete cascade,
  bucket_id text not null default 'slides' check (bucket_id = 'slides'),
  object_path text not null unique,
  display_name text not null check (length(trim(display_name)) between 1 and 160),
  original_name text not null check (length(trim(original_name)) > 4 and original_name ~* '\.pdf$'),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  uploaded_at timestamptz not null default now()
);

create index slide_files_slot_uploaded_idx
on public.slide_files (agenda_slot_id, uploaded_at);

create or replace function public.protect_agenda_slots_with_slide_files()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from public.slide_files where agenda_slot_id = old.id) then
      raise exception 'Remove uploaded slide PDFs before changing or removing this Lab.' using errcode = '22023';
    end if;
    return old;
  end if;
  if new.group_id is distinct from old.group_id
    and exists (select 1 from public.slide_files where agenda_slot_id = old.id) then
    raise exception 'Remove uploaded slide PDFs before changing or removing this Lab.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_agenda_slots_with_slide_files on public.agenda_slots;
create trigger protect_agenda_slots_with_slide_files
before delete or update of group_id on public.agenda_slots
for each row execute function public.protect_agenda_slots_with_slide_files();

alter table public.slide_files enable row level security;

create policy "members read slide PDFs" on public.slide_files for select to authenticated
using (public.is_member());

grant select on table public.slide_files to authenticated;
revoke insert, update, delete on table public.slide_files from authenticated;

update storage.buckets
set public = false,
    file_size_limit = 52428800,
    allowed_mime_types = array['application/pdf']
where id = 'slides';

drop policy if exists "assigned presenters upload slides" on storage.objects;
drop policy if exists "assigned presenters replace slides" on storage.objects;
drop policy if exists "group members upload slides" on storage.objects;
drop policy if exists "group members replace slides" on storage.objects;
drop policy if exists "reserved slide PDF uploads" on storage.objects;
drop policy if exists "uploaders delete slide PDFs" on storage.objects;

create policy "reserved slide PDF uploads" on storage.objects for insert to authenticated
with check (
  bucket_id = 'slides'
  and exists (
    select 1
    from public.slide_files file
    where file.object_path = storage.objects.name
      and file.uploaded_by = auth.uid()
  )
);

create policy "uploaders delete slide PDFs" on storage.objects for delete to authenticated
using (
  bucket_id = 'slides'
  and exists (
    select 1
    from public.slide_files file
    where file.object_path = storage.objects.name
      and (file.uploaded_by = auth.uid() or public.is_admin())
  )
);

drop policy if exists "group members add slides" on public.resources;
drop policy if exists "group members update slides" on public.resources;

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
    raise exception 'Only PDF files can be uploaded as slides.' using errcode = '22023';
  end if;
  if size_bytes_input is null or size_bytes_input < 1 or size_bytes_input > 52428800 then
    raise exception 'Slide PDFs must be 50 MB or smaller.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.agenda_slots slot
    join public.meetings meeting on meeting.id = slot.meeting_id
    where slot.id = agenda_slot_id_input
      and meeting.meeting_date >= (now() at time zone 'Asia/Singapore')::date
  ) then
    raise exception 'Choose a Lab from an upcoming meeting.' using errcode = '22023';
  end if;
  if not public.can_manage_agenda_slot(agenda_slot_id_input) then
    raise exception 'You can upload only for an assigned Lab.' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(agenda_slot_id_input::text, 0));
  if (select count(*) >= 20 from public.slide_files where agenda_slot_id = agenda_slot_id_input) then
    raise exception 'Each Lab can upload up to 20 slide PDFs for this meeting.' using errcode = '22023';
  end if;

  new_file.id := gen_random_uuid();
  insert into public.slide_files (
    id, agenda_slot_id, object_path, display_name, original_name, size_bytes, uploaded_by
  ) values (
    new_file.id,
    agenda_slot_id_input,
    agenda_slot_id_input::text || '/' || new_file.id::text || '.pdf',
    trim(display_name_input),
    trim(original_name_input),
    size_bytes_input,
    auth.uid()
  ) returning * into new_file;

  return to_jsonb(new_file);
end;
$$;

create or replace function public.cancel_slide_file(file_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  reservation public.slide_files%rowtype;
begin
  select * into reservation
  from public.slide_files
  where id = file_id_input;

  if not found then
    return;
  end if;
  if reservation.uploaded_by <> auth.uid() and not public.is_admin() then
    raise exception 'You cannot remove this slide PDF.' using errcode = '42501';
  end if;
  if exists (
    select 1
    from storage.objects object
    where object.bucket_id = reservation.bucket_id
      and object.name = reservation.object_path
  ) then
    raise exception 'Remove the stored PDF before releasing its metadata.' using errcode = '55000';
  end if;

  delete from public.slide_files where id = reservation.id;
end;
$$;

revoke all on function public.reserve_slide_file(uuid, text, text, bigint) from public;
grant execute on function public.reserve_slide_file(uuid, text, text, bigint) to authenticated;
revoke all on function public.cancel_slide_file(uuid) from public;
grant execute on function public.cancel_slide_file(uuid) to authenticated;
