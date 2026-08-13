create extension if not exists pgcrypto;

create type public.member_role as enum ('presenter', 'admin');
create type public.resource_kind as enum ('slides', 'minutes');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role public.member_role not null default 'presenter',
  created_at timestamptz not null default now()
);

create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  meeting_date date,
  venue text,
  timezone text not null default 'Asia/Singapore',
  presentation_minutes integer not null default 15 check (presentation_minutes > 0),
  qa_minutes integer not null default 5 check (qa_minutes > 0),
  status text not null default 'upcoming' check (status in ('draft', 'upcoming', 'completed', 'archived')),
  created_at timestamptz not null default now()
);

create table public.agenda_slots (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  starts_at time not null,
  ends_at time not null,
  group_name text not null,
  presenter_id uuid references public.profiles(id) on delete set null,
  sort_order integer not null,
  unique (meeting_id, sort_order),
  check (ends_at > starts_at)
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  agenda_slot_id uuid references public.agenda_slots(id) on delete cascade,
  kind public.resource_kind not null,
  bucket_id text not null,
  object_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  uploaded_by uuid not null references public.profiles(id),
  uploaded_at timestamptz not null default now(),
  unique (kind, agenda_slot_id),
  check ((kind = 'slides' and agenda_slot_id is not null) or (kind = 'minutes' and agenda_slot_id is null))
);

create table public.member_allowlist (
  email text primary key,
  role public.member_role not null default 'presenter',
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid()) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  select
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    allowlist.role
  from public.member_allowlist allowlist where allowlist.email = lower(new.email)
  on conflict (id) do update set email = excluded.email, display_name = excluded.display_name, role = excluded.role;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.handle_allowlist_insert()
returns trigger language plpgsql security definer set search_path = public, auth
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  select id, lower(email), coalesce(raw_user_meta_data ->> 'full_name', split_part(email, '@', 1)), new.role
  from auth.users where lower(email) = new.email
  on conflict (id) do update set role = excluded.role;
  return new;
end;
$$;

create trigger on_member_allowed
after insert or update on public.member_allowlist for each row execute procedure public.handle_allowlist_insert();

alter table public.profiles enable row level security;
alter table public.meetings enable row level security;
alter table public.agenda_slots enable row level security;
alter table public.resources enable row level security;
alter table public.member_allowlist enable row level security;

create policy "public can read meetings" on public.meetings for select using (status <> 'draft');
create policy "public can read agenda" on public.agenda_slots for select using (
  exists (select 1 from public.meetings m where m.id = meeting_id and m.status <> 'draft')
);
create policy "members can read profiles" on public.profiles for select to authenticated using (
  public.is_member()
);
create policy "members can read resources" on public.resources for select to authenticated using (
  public.is_member()
);
create policy "admins manage member allowlist" on public.member_allowlist for all to authenticated
using (public.is_admin()) with check (public.is_admin());
create policy "admins manage meetings" on public.meetings for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admins manage agenda" on public.agenda_slots for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "members add assigned slides" on public.resources for insert to authenticated with check (
  uploaded_by = auth.uid() and kind = 'slides' and exists (
    select 1 from public.agenda_slots s where s.id = agenda_slot_id and (s.presenter_id = auth.uid() or public.is_admin())
  )
);
create policy "members update assigned slides" on public.resources for update to authenticated using (
  kind = 'slides' and exists (
    select 1 from public.agenda_slots s where s.id = agenda_slot_id and (s.presenter_id = auth.uid() or public.is_admin())
  )
) with check (
  uploaded_by = auth.uid() and kind = 'slides' and exists (
    select 1 from public.agenda_slots s where s.id = agenda_slot_id and (s.presenter_id = auth.uid() or public.is_admin())
  )
);
create policy "admins add minutes" on public.resources for insert to authenticated with check (
  kind = 'minutes' and public.is_admin()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('slides', 'slides', false, 52428800, array['application/pdf','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation']),
  ('minutes', 'minutes', false, 52428800, array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/markdown'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "authenticated members read meeting files" on storage.objects for select to authenticated
using (
  bucket_id in ('slides', 'minutes') and public.is_member()
);
create policy "assigned presenters upload slides" on storage.objects for insert to authenticated
with check (
  bucket_id = 'slides' and exists (
    select 1 from public.agenda_slots s where s.id::text = (storage.foldername(name))[1] and (s.presenter_id = auth.uid() or public.is_admin())
  )
);
create policy "assigned presenters replace slides" on storage.objects for update to authenticated
using (
  bucket_id = 'slides' and exists (
    select 1 from public.agenda_slots s where s.id::text = (storage.foldername(name))[1] and (s.presenter_id = auth.uid() or public.is_admin())
  )
);
create policy "admins upload minutes" on storage.objects for insert to authenticated
with check (bucket_id = 'minutes' and public.is_admin());
create policy "admins replace minutes" on storage.objects for update to authenticated
using (bucket_id = 'minutes' and public.is_admin());

with new_meeting as (
  insert into public.meetings (title, status) values ('CRP Grant Meeting', 'upcoming') returning id
)
insert into public.agenda_slots (meeting_id, starts_at, ends_at, group_name, sort_order)
select id, slot.starts_at::time, slot.ends_at::time, slot.group_name, slot.sort_order
from new_meeting cross join (values
  ('09:00', '09:20', 'Prof Zhang Yang''s group', 1),
  ('09:20', '09:40', 'Prof Li Yang''s group', 2),
  ('09:40', '10:00', 'Prof Low Jun Siong''s group', 3),
  ('10:00', '10:20', 'Prof Tan Yong Zi''s group', 4),
  ('10:20', '10:40', 'Prof Wu Wei''s group', 5),
  ('10:40', '11:00', 'Prof Li Qi Jing''s group', 6)
) as slot(starts_at, ends_at, group_name, sort_order);
