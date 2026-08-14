drop policy if exists "uploaders remove failed PDF reservations" on public.archive_lab_files;
revoke delete on table public.archive_lab_files from authenticated;

create or replace function public.cancel_archive_lab_file(file_id_input uuid)
returns void
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  reservation public.archive_lab_files%rowtype;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;

  select * into reservation
  from public.archive_lab_files
  where id = file_id_input and uploaded_by = auth.uid()
  for update;
  if not found then
    raise exception 'The PDF reservation was not found.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects stored
    where stored.bucket_id = reservation.bucket_id and stored.name = reservation.object_path
  ) then
    delete from public.archive_lab_files where id = reservation.id;
    return;
  end if;

  raise exception 'A completed PDF upload cannot be cancelled.' using errcode = '42501';
end;
$$;

revoke all on function public.cancel_archive_lab_file(uuid) from public;
grant execute on function public.cancel_archive_lab_file(uuid) to authenticated;
