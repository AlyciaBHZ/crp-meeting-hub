create or replace function public.create_meeting_with_details(
  title_input text,
  meeting_date_input date,
  zoom_url_input text,
  presentation_minutes_input integer,
  qa_minutes_input integer,
  slots_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_meeting_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if title_input is null or length(trim(title_input)) = 0 then
    raise exception 'Meeting title is required.' using errcode = '22023';
  end if;
  if presentation_minutes_input is null or presentation_minutes_input < 1
    or qa_minutes_input is null or qa_minutes_input < 1 then
    raise exception 'Presentation and Q&A durations must be positive.' using errcode = '22023';
  end if;

  new_meeting_id := public.create_meeting_with_slots(meeting_date_input, zoom_url_input, slots_input);

  update public.meetings
  set title = trim(title_input),
      presentation_minutes = presentation_minutes_input,
      qa_minutes = qa_minutes_input
  where id = new_meeting_id;

  return new_meeting_id;
end;
$$;

create or replace function public.update_meeting_with_details(
  meeting_id_input uuid,
  title_input text,
  meeting_date_input date,
  zoom_url_input text,
  presentation_minutes_input integer,
  qa_minutes_input integer,
  slots_input jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required.' using errcode = '42501';
  end if;
  if title_input is null or length(trim(title_input)) = 0 then
    raise exception 'Meeting title is required.' using errcode = '22023';
  end if;
  if presentation_minutes_input is null or presentation_minutes_input < 1
    or qa_minutes_input is null or qa_minutes_input < 1 then
    raise exception 'Presentation and Q&A durations must be positive.' using errcode = '22023';
  end if;

  perform public.update_meeting_with_slots(
    meeting_id_input,
    meeting_date_input,
    zoom_url_input,
    slots_input
  );

  update public.meetings
  set title = trim(title_input),
      presentation_minutes = presentation_minutes_input,
      qa_minutes = qa_minutes_input
  where id = meeting_id_input;

  return meeting_id_input;
end;
$$;

revoke all on function public.create_meeting_with_details(text, date, text, integer, integer, jsonb) from public;
grant execute on function public.create_meeting_with_details(text, date, text, integer, integer, jsonb) to authenticated;
revoke all on function public.update_meeting_with_details(uuid, text, date, text, integer, integer, jsonb) from public;
grant execute on function public.update_meeting_with_details(uuid, text, date, text, integer, integer, jsonb) to authenticated;
