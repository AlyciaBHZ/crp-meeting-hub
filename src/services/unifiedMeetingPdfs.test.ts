// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260910090000_unified_meeting_pdfs.sql?raw'

const db = new PGlite()
const meeting = '00000000-0000-0000-0000-000000000001'
const group = '00000000-0000-0000-0000-000000000002'
const slot = '00000000-0000-0000-0000-000000000003'
const member = '00000000-0000-0000-0000-000000000004'

beforeAll(async () => {
  await db.exec(`
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_member() returns boolean language sql as $$ select auth.uid() = '${member}'::uuid $$;
    create function public.can_manage_agenda_slot(uuid) returns boolean language sql as $$ select current_setting('test.assigned', true) = 'yes' $$;
    create table public.meetings (id uuid primary key, meeting_date date);
    create table public.agenda_slots (id uuid primary key, meeting_id uuid references meetings, group_id uuid);
    create table public.slide_files (
      id uuid primary key, agenda_slot_id uuid references agenda_slots, object_path text,
      display_name text, original_name text, size_bytes bigint, uploaded_by uuid
    );
    create table public.archive_lab_files (id uuid primary key, meeting_id uuid, group_id uuid);
    insert into meetings values ('${meeting}', '2026-08-05');
    insert into agenda_slots values ('${slot}', '${meeting}', '${group}');
    set test.uid = '${member}';
    set test.assigned = 'yes';
  `)
  await db.exec(migration)
}, 30000)

afterAll(async () => { await db.close() })

async function reserve(name = 'Update', filename = 'update.pdf', size = 100) {
  return db.query('select public.reserve_slide_file($1, $2, $3, $4) as file', [slot, name, filename, size])
}

describe('unified meeting PDF database behavior', () => {
  it('allows assigned members to add PDFs to a past meeting', async () => {
    const result = await reserve()
    expect(result.rows[0]).toMatchObject({ file: { agenda_slot_id: slot, display_name: 'Update', uploaded_by: member } })
  })

  it('rejects unapproved users, unassigned members and invalid files', async () => {
    await db.exec("set test.uid = ''")
    await expect(reserve()).rejects.toThrow('Approved member access is required')
    await db.exec(`set test.uid = '${member}'; set test.assigned = 'no'`)
    await expect(reserve()).rejects.toThrow('assigned group')
    await db.exec("set test.assigned = 'yes'")
    await expect(reserve('')).rejects.toThrow('presenter or document name')
    await expect(reserve('Update', 'slides.pptx')).rejects.toThrow('Only PDF')
    await expect(reserve('Update', 'slides.pdf', 52428801)).rejects.toThrow('50 MB')
  })

  it('enforces a combined 20-PDF limit for both upload paths without removing old files', async () => {
    await db.query('insert into archive_lab_files select gen_random_uuid(), $1::uuid, $2::uuid from generate_series(1, 18)', [meeting, group])
    await reserve('Twentieth file')
    await expect(reserve('Too many')).rejects.toThrow('up to 20 PDFs')
    await expect(db.query('insert into archive_lab_files values (gen_random_uuid(), $1, $2)', [meeting, group])).rejects.toThrow('up to 20 PDFs')
    const counts = await db.query('select (select count(*) from slide_files)::int as slides, (select count(*) from archive_lab_files)::int as archive')
    expect(counts.rows[0]).toEqual({ slides: 2, archive: 18 })
  })

  it('preserves file ownership when an administrator changes the schedule', async () => {
    await expect(db.query('delete from agenda_slots where id = $1', [slot])).rejects.toThrow('preserve its files')
    await expect(db.query('update agenda_slots set group_id = gen_random_uuid() where id = $1', [slot])).rejects.toThrow('preserve its files')
    // Existing archive files remain protected even if there are no slide records.
    await db.exec('delete from slide_files')
    await expect(db.query('delete from agenda_slots where id = $1', [slot])).rejects.toThrow('preserve its files')
    await db.query('update agenda_slots set group_id = $1 where id = $2', [group, slot])
    expect((await db.query('select count(*)::int as total from archive_lab_files')).rows[0]).toEqual({ total: 18 })
  })
})
