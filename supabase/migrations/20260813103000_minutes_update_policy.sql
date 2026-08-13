create policy "admins update minutes" on public.resources for update to authenticated
using (kind = 'minutes' and public.is_admin())
with check (kind = 'minutes' and public.is_admin() and uploaded_by = auth.uid());
