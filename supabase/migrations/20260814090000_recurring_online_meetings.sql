create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) > 0),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table public.meeting_private_details (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  zoom_url text not null check (zoom_url ~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)'),
  created_at timestamptz not null default now()
);

alter table public.agenda_slots add column group_id uuid references public.groups(id) on delete restrict;

insert into public.groups (name, sort_order)
select group_name, min(sort_order)
from public.agenda_slots
group by group_name
order by min(sort_order)
on conflict (name) do nothing;

update public.agenda_slots slot
set group_id = research_group.id
from public.groups research_group
where research_group.name = slot.group_name;

alter table public.agenda_slots alter column group_id set not null;

create index agenda_slots_group_id_idx on public.agenda_slots (group_id);
create index group_members_profile_id_idx on public.group_members (profile_id);
create unique index meetings_one_unscheduled_draft_idx
on public.meetings ((status)) where status = 'draft' and meeting_date is null;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.meeting_private_details enable row level security;

create policy "public can read groups" on public.groups for select using (true);
create policy "admins manage groups" on public.groups for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "members can read group memberships" on public.group_members for select to authenticated
using (public.is_member());
create policy "admins manage group memberships" on public.group_members for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "members can read meeting private details" on public.meeting_private_details for select to authenticated
using (public.is_member());
create policy "admins manage meeting private details" on public.meeting_private_details for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create or replace function public.can_manage_agenda_slot(slot_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.is_admin() or exists (
    select 1
    from public.agenda_slots slot
    join public.group_members membership on membership.group_id = slot.group_id
    where slot.id = slot_id and membership.profile_id = auth.uid()
  )
$$;

drop policy if exists "members add assigned slides" on public.resources;
drop policy if exists "members update assigned slides" on public.resources;

create policy "group members add slides" on public.resources for insert to authenticated
with check (
  uploaded_by = auth.uid()
  and kind = 'slides'
  and bucket_id = 'slides'
  and object_path = agenda_slot_id::text || '/slides'
  and exists (
    select 1 from public.agenda_slots slot
    where slot.id = resources.agenda_slot_id
      and slot.meeting_id = resources.meeting_id
  )
  and public.can_manage_agenda_slot(agenda_slot_id)
);

create policy "group members update slides" on public.resources for update to authenticated
using (kind = 'slides' and public.can_manage_agenda_slot(agenda_slot_id))
with check (
  uploaded_by = auth.uid()
  and kind = 'slides'
  and bucket_id = 'slides'
  and object_path = agenda_slot_id::text || '/slides'
  and exists (
    select 1 from public.agenda_slots slot
    where slot.id = resources.agenda_slot_id
      and slot.meeting_id = resources.meeting_id
  )
  and public.can_manage_agenda_slot(agenda_slot_id)
);

drop policy if exists "assigned presenters upload slides" on storage.objects;
drop policy if exists "assigned presenters replace slides" on storage.objects;

create policy "group members upload slides" on storage.objects for insert to authenticated
with check (
  bucket_id = 'slides'
  and public.can_manage_agenda_slot(((storage.foldername(name))[1])::uuid)
);

create policy "group members replace slides" on storage.objects for update to authenticated
using (
  bucket_id = 'slides'
  and public.can_manage_agenda_slot(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'slides'
  and public.can_manage_agenda_slot(((storage.foldername(name))[1])::uuid)
);

create or replace function public.create_meeting_with_slots(
  meeting_date_input date,
  zoom_url_input text,
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
  if zoom_url_input is null or zoom_url_input !~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)' then
    raise exception 'A secure Zoom URL is required.' using errcode = '22023';
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
  values ('CRP Grant Meeting', meeting_date_input, 'upcoming')
  returning id into new_meeting_id;

  insert into public.meeting_private_details (meeting_id, zoom_url)
  values (new_meeting_id, trim(zoom_url_input));

  for slot in select value from jsonb_array_elements(slots_input)
  loop
    select * into selected_group
    from public.groups
    where id = (slot ->> 'group_id')::uuid and active = true;
    if not found then
      raise exception 'Every agenda group must be active.' using errcode = '22023';
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

create or replace function public.update_meeting_with_slots(
  meeting_id_input uuid,
  meeting_date_input date,
  zoom_url_input text,
  slots_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  slot jsonb;
  selected_group public.groups%rowtype;
  existing_slot public.agenda_slots%rowtype;
  starts_at_input time;
  ends_at_input time;
  sort_order_input integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.meetings where id = meeting_id_input) then
    raise exception 'The meeting was not found.' using errcode = '22023';
  end if;
  if meeting_date_input is null then
    raise exception 'Meeting date is required.' using errcode = '22023';
  end if;
  if zoom_url_input is null or zoom_url_input !~* '^https://([a-z0-9-]+\.)*zoom\.us(/|$)' then
    raise exception 'A Zoom URL is required.' using errcode = '22023';
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
  if exists (
    select 1
    from public.agenda_slots old_slot
    join public.resources resource on resource.agenda_slot_id = old_slot.id
    where old_slot.meeting_id = meeting_id_input
      and not exists (
        select 1 from jsonb_array_elements(slots_input) incoming
        where incoming ->> 'slot_id' = old_slot.id::text
      )
  ) then
    raise exception 'A group with uploaded slides cannot be removed.' using errcode = '22023';
  end if;

  update public.meetings
  set meeting_date = meeting_date_input, status = 'upcoming'
  where id = meeting_id_input;

  insert into public.meeting_private_details (meeting_id, zoom_url)
  values (meeting_id_input, trim(zoom_url_input))
  on conflict (meeting_id) do update set zoom_url = excluded.zoom_url;

  delete from public.agenda_slots old_slot
  where old_slot.meeting_id = meeting_id_input
    and not exists (
      select 1 from jsonb_array_elements(slots_input) incoming
      where incoming ->> 'slot_id' = old_slot.id::text
    );

  update public.agenda_slots set sort_order = sort_order + 100000 where meeting_id = meeting_id_input;

  for slot in select value from jsonb_array_elements(slots_input)
  loop
    select * into selected_group
    from public.groups
    where id = (slot ->> 'group_id')::uuid and active = true;
    if not found then
      raise exception 'Every agenda group must be active.' using errcode = '22023';
    end if;

    starts_at_input := (slot ->> 'starts_at')::time;
    ends_at_input := (slot ->> 'ends_at')::time;
    sort_order_input := (slot ->> 'sort_order')::integer;
    if ends_at_input <= starts_at_input or sort_order_input < 1 then
      raise exception 'Every agenda slot requires a valid time range and order.' using errcode = '22023';
    end if;

    if nullif(slot ->> 'slot_id', '') is not null then
      select * into existing_slot
      from public.agenda_slots
      where id = (slot ->> 'slot_id')::uuid and meeting_id = meeting_id_input;
      if not found then
        raise exception 'An agenda slot does not belong to this meeting.' using errcode = '22023';
      end if;
      if existing_slot.group_id <> selected_group.id and exists (
        select 1 from public.resources where agenda_slot_id = existing_slot.id
      ) then
        raise exception 'A group with uploaded slides cannot be changed.' using errcode = '22023';
      end if;
      update public.agenda_slots
      set starts_at = starts_at_input,
          ends_at = ends_at_input,
          group_name = selected_group.name,
          group_id = selected_group.id,
          sort_order = sort_order_input
      where id = existing_slot.id;
    else
      insert into public.agenda_slots (
        meeting_id, starts_at, ends_at, group_name, group_id, sort_order
      ) values (
        meeting_id_input, starts_at_input, ends_at_input, selected_group.name, selected_group.id, sort_order_input
      );
    end if;
  end loop;

  return meeting_id_input;
end;
$$;

revoke all on function public.create_meeting_with_slots(date, text, jsonb) from public;
grant execute on function public.create_meeting_with_slots(date, text, jsonb) to authenticated;
revoke all on function public.update_meeting_with_slots(uuid, date, text, jsonb) from public;
grant execute on function public.update_meeting_with_slots(uuid, date, text, jsonb) to authenticated;
revoke all on function public.can_manage_agenda_slot(uuid) from public;
grant execute on function public.can_manage_agenda_slot(uuid) to authenticated;
