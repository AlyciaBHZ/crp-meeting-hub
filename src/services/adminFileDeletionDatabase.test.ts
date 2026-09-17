// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260917090000_admin_file_deletion.sql?raw'

const db = new PGlite()
const admin = '00000000-0000-0000-0000-000000000001'
const member = '00000000-0000-0000-0000-000000000002'
const file = '00000000-0000-0000-0000-000000000003'
const meeting = '00000000-0000-0000-0000-000000000004'

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema storage;
    grant usage on schema public, storage, auth to authenticated, anon;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function is_member() returns boolean language sql as $$ select auth.uid() in ('${admin}', '${member}') $$;
    create function is_admin() returns boolean language sql as $$ select coalesce(auth.uid() = '${admin}', false) $$;
    create table storage.objects (bucket_id text, name text);
    alter table storage.objects enable row level security;
    grant select, delete on storage.objects to authenticated;
    create policy members_read on storage.objects for select to authenticated using (is_member());
    create table archive_lab_files (id uuid primary key, uploaded_by uuid, bucket_id text, object_path text);
    create table resources (id uuid primary key, meeting_id uuid, kind text, bucket_id text, object_path text);
    insert into archive_lab_files values ('${file}', '${member}', 'archive-lab-files', 'legacy.pdf');
    insert into resources values ('${file}', '${meeting}', 'minutes', 'minutes', 'meeting/minutes');
    insert into storage.objects values ('archive-lab-files', 'legacy.pdf'), ('minutes', 'meeting/minutes'), ('other', 'keep.pdf');
  `)
  await db.exec(migration)
}, 30000)
afterAll(async () => { await db.close() })

describe('admin deletion database authorization', () => {
  it('rejects members and anonymous callers and does not allow member storage deletion', async () => {
    await db.exec(`set role authenticated; set test.uid = '${member}'`)
    expect((await db.query('delete from storage.objects returning *')).rows).toHaveLength(0)
    await expect(db.query('select cancel_archive_lab_file($1)', [file])).rejects.toThrow('Remove the stored PDF')
    await expect(db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'meeting/minutes'])).rejects.toThrow('Only administrators')
    await db.exec("set test.uid = ''")
    await expect(db.query('select cancel_archive_lab_file($1)', [file])).rejects.toThrow('Approved member')
    await expect(db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'meeting/minutes'])).rejects.toThrow('Only administrators')
    await db.exec('reset role; set role anon')
    await expect(db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'meeting/minutes'])).rejects.toThrow('permission denied')
  })

  it('allows an admin to delete another uploader’s legacy file only after storage deletion', async () => {
    await db.exec(`reset role; set role authenticated; set test.uid = '${admin}'`)
    await expect(db.query('select cancel_archive_lab_file($1)', [file])).rejects.toThrow('Remove the stored PDF')
    expect((await db.query("delete from storage.objects where bucket_id = 'archive-lab-files' returning *")).rows).toHaveLength(1)
    await db.query('select cancel_archive_lab_file($1)', [file])
    await db.query('select cancel_archive_lab_file($1)', [file])
    await db.exec('reset role')
    expect((await db.query('select * from archive_lab_files')).rows).toHaveLength(0)
  })

  it('guards minutes path and existing storage and leaves unrelated storage untouched', async () => {
    await db.exec('set role authenticated')
    await expect(db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'wrong/path'])).rejects.toThrow('minutes have changed')
    await expect(db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'meeting/minutes'])).rejects.toThrow('Remove the stored minutes')
    expect((await db.query("delete from storage.objects where bucket_id = 'minutes' returning *")).rows).toHaveLength(1)
    await db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'meeting/minutes'])
    await db.query('select cancel_meeting_minutes($1, $2)', [meeting, 'meeting/minutes'])
    expect((await db.query("delete from storage.objects where bucket_id = 'other' returning *")).rows).toHaveLength(0)
    await db.exec('reset role')
    expect((await db.query('select * from resources')).rows).toHaveLength(0)
    expect((await db.query('select * from storage.objects')).rows).toEqual([{ bucket_id: 'other', name: 'keep.pdf' }])
  })
})
