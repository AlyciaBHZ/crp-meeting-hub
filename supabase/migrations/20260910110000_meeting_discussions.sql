create table public.meeting_questions (
  id uuid primary key default gen_random_uuid(),
  agenda_slot_id uuid not null references public.agenda_slots(id) on delete restrict,
  author_name text not null check (length(trim(author_name)) between 1 and 100),
  author_group text not null check (length(trim(author_group)) between 1 and 160),
  body text not null check (length(trim(body)) between 1 and 4000),
  status text not null default 'open' check (status in ('open', 'meeting', 'answered', 'follow_up')),
  file_source text check (file_source in ('slides', 'archive-lab-files')),
  file_id uuid,
  file_name text,
  page_number integer check (page_number between 1 and 10000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check ((file_source is null and file_id is null and file_name is null and page_number is null)
    or (file_source is not null and file_id is not null and file_name is not null))
);

create table public.meeting_replies (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.meeting_questions(id) on delete cascade,
  author_name text not null check (length(trim(author_name)) between 1 and 100),
  author_group text not null check (length(trim(author_group)) between 1 and 160),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index meeting_questions_slot_idx on public.meeting_questions(agenda_slot_id, created_at desc);
create index meeting_replies_question_idx on public.meeting_replies(question_id, created_at);
alter table public.meeting_questions enable row level security;
alter table public.meeting_replies enable row level security;
create policy "members read meeting questions" on public.meeting_questions for select to authenticated using (public.is_member());
create policy "members read meeting replies" on public.meeting_replies for select to authenticated using (public.is_member());
-- Supabase may grant ALL through default privileges; remove TRUNCATE and other
-- table privileges as well as row writes before exposing read-only tables.
revoke all on public.meeting_questions, public.meeting_replies from public, anon, authenticated;
grant select on public.meeting_questions, public.meeting_replies to authenticated;

create or replace function public.ask_meeting_question(
  slot_id_input uuid, author_name_input text, author_group_input text, body_input text,
  file_source_input text default null, file_id_input uuid default null, page_number_input integer default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  slot public.agenda_slots%rowtype;
  source_name text;
  question_id uuid;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;
  select * into slot from public.agenda_slots where id = slot_id_input for share;
  if not found then raise exception 'This meeting group is no longer available.' using errcode = '22023'; end if;
  if file_source_input = 'slides' then
    select original_name into source_name from public.slide_files where id = file_id_input and agenda_slot_id = slot.id;
  elsif file_source_input = 'archive-lab-files' then
    select original_name into source_name from public.archive_lab_files
      where id = file_id_input and meeting_id = slot.meeting_id and group_id = slot.group_id;
  end if;
  if (file_source_input is not null or file_id_input is not null or page_number_input is not null) and source_name is null then
    raise exception 'Choose a PDF from this meeting group.' using errcode = '22023';
  end if;
  insert into public.meeting_questions (agenda_slot_id, author_name, author_group, body, file_source, file_id, file_name, page_number, created_by)
  values (slot.id, trim(author_name_input), trim(author_group_input), trim(body_input), file_source_input, file_id_input, source_name, page_number_input, auth.uid())
  returning id into question_id;
  return question_id;
end;
$$;

create or replace function public.reply_to_meeting_question(
  question_id_input uuid, author_name_input text, author_group_input text, body_input text
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare reply_id uuid;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;
  insert into public.meeting_replies (question_id, author_name, author_group, body, created_by)
  values (question_id_input, trim(author_name_input), trim(author_group_input), trim(body_input), auth.uid())
  returning id into reply_id;
  return reply_id;
end;
$$;

create or replace function public.set_meeting_question_status(question_id_input uuid, status_input text)
returns void language plpgsql security definer set search_path = public
as $$
declare target_slot uuid;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;
  select agenda_slot_id into target_slot from public.meeting_questions where id = question_id_input for update;
  if not found then raise exception 'Question not found.' using errcode = '22023'; end if;
  if not public.can_manage_agenda_slot(target_slot) then
    raise exception 'Only this group or an administrator can change question status.' using errcode = '42501';
  end if;
  update public.meeting_questions set status = status_input where id = question_id_input;
end;
$$;

-- Existing questions must continue to refer to the original presenting group.
create or replace function public.protect_discussion_group()
returns trigger language plpgsql set search_path = public
as $$
begin
  if (new.group_id is distinct from old.group_id or new.meeting_id is distinct from old.meeting_id)
    and exists(select 1 from public.meeting_questions where agenda_slot_id = old.id) then
    raise exception 'This group has a discussion. Keep its meeting and group assignment.' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger protect_discussion_group before update of group_id, meeting_id on public.agenda_slots
for each row execute function public.protect_discussion_group();

revoke all on function public.ask_meeting_question(uuid, text, text, text, text, uuid, integer) from public;
revoke all on function public.reply_to_meeting_question(uuid, text, text, text) from public;
revoke all on function public.set_meeting_question_status(uuid, text) from public;
grant execute on function public.ask_meeting_question(uuid, text, text, text, text, uuid, integer) to authenticated;
grant execute on function public.reply_to_meeting_question(uuid, text, text, text) to authenticated;
grant execute on function public.set_meeting_question_status(uuid, text) to authenticated;
