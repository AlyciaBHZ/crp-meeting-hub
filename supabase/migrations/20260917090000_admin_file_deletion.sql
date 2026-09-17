-- Storage deletion must use the Storage API so both object bytes and metadata
-- are removed. Cleanup RPCs refuse to hide a file that still exists in Storage.
create policy "admins delete archived PDFs" on storage.objects
for delete to authenticated
using (bucket_id = 'archive-lab-files' and public.is_admin());

create policy "admins delete minutes" on storage.objects
for delete to authenticated
using (bucket_id = 'minutes' and public.is_admin());

create or replace function public.cancel_archive_lab_file(file_id_input uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare reservation public.archive_lab_files%rowtype;
begin
  if auth.uid() is null or not public.is_member() then
    raise exception 'Approved member access is required.' using errcode = '42501';
  end if;
  select * into reservation from public.archive_lab_files where id = file_id_input for update;
  if not found then return; end if;
  if reservation.uploaded_by <> auth.uid() and not public.is_admin() then
    raise exception 'You cannot remove this archived PDF.' using errcode = '42501';
  end if;
  if exists (select 1 from storage.objects where bucket_id = reservation.bucket_id and name = reservation.object_path) then
    raise exception 'Remove the stored PDF before releasing its metadata.' using errcode = '55000';
  end if;
  delete from public.archive_lab_files where id = reservation.id;
end;
$$;

create or replace function public.cancel_meeting_minutes(meeting_id_input uuid, object_path_input text)
returns void language plpgsql security definer set search_path = public
as $$
declare minutes public.resources%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Only administrators can delete meeting minutes.' using errcode = '42501';
  end if;
  select * into minutes from public.resources
  where meeting_id = meeting_id_input and kind = 'minutes' for update;
  if not found then return; end if;
  if minutes.object_path is distinct from object_path_input or minutes.bucket_id <> 'minutes' then
    raise exception 'The minutes have changed. Refresh this meeting before deleting.' using errcode = '22023';
  end if;
  if exists (select 1 from storage.objects where bucket_id = minutes.bucket_id and name = minutes.object_path) then
    raise exception 'Remove the stored minutes before releasing their metadata.' using errcode = '55000';
  end if;
  delete from public.resources where id = minutes.id;
end;
$$;

revoke all on function public.cancel_archive_lab_file(uuid) from public;
revoke all on function public.cancel_meeting_minutes(uuid, text) from public;
grant execute on function public.cancel_archive_lab_file(uuid) to authenticated;
grant execute on function public.cancel_meeting_minutes(uuid, text) to authenticated;
