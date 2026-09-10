// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260910110000_meeting_discussions.sql?raw'

const db = new PGlite()
const member = '00000000-0000-0000-0000-000000000001'
const slot = '00000000-0000-0000-0000-000000000002'
const meeting = '00000000-0000-0000-0000-000000000003'
const group = '00000000-0000-0000-0000-000000000004'
const file = '00000000-0000-0000-0000-000000000005'
let question: string

beforeAll(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    create schema auth;
    grant usage on schema public, auth to anon, authenticated;
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_member() returns boolean language sql as $$ select auth.uid() = '${member}'::uuid $$;
    create function public.can_manage_agenda_slot(uuid) returns boolean language sql as $$ select current_setting('test.assigned', true) = 'yes' $$;
    create table profiles (id uuid primary key);
    create table agenda_slots (id uuid primary key, meeting_id uuid, group_id uuid);
    create table slide_files (id uuid primary key, agenda_slot_id uuid, original_name text);
    create table archive_lab_files (id uuid primary key, meeting_id uuid, group_id uuid, original_name text);
    insert into profiles values ('${member}');
    insert into agenda_slots values ('${slot}', '${meeting}', '${group}');
    insert into slide_files values ('${file}', '${slot}', 'research.pdf');
    insert into archive_lab_files values ('${file}', '${meeting}', '${group}', 'legacy.pdf');
    set test.uid = '${member}'; set test.assigned = 'no';
  `)
  await db.exec(migration)
}, 30000)
afterAll(async () => { await db.close() })

async function ask(source: string | null = null, id: string | null = null, page: number | null = null, name = 'Wenlin', body = 'How was this measured?') {
  return db.query<{ id: string }>('select ask_meeting_question($1, $2, $3, $4, $5, $6, $7) as id', [slot, name, 'Research group', body, source, id, page])
}

describe('meeting discussion database permissions and integrity', () => {
  it('lets an approved member ask in another group and reply with an attributed PDF page', async () => {
    await db.exec('set role authenticated')
    question = (await ask('slides', file, 2)).rows[0].id
    await db.query('select reply_to_meeting_question($1, $2, $3, $4)', [question, 'Yang', 'Presenting group', 'Using the baseline experiment.'])
    expect((await db.query('select file_name, page_number, created_by, status from meeting_questions')).rows[0]).toEqual({ file_name: 'research.pdf', page_number: 2, created_by: member, status: 'open' })
    expect((await db.query('select count(*)::int as total from meeting_replies')).rows[0]).toEqual({ total: 1 })
  })

  it('denies anonymous and unapproved access, including direct writes', async () => {
    await expect(db.query('truncate meeting_replies')).rejects.toThrow('permission denied')
    await expect(db.query('update meeting_questions set status = $1', ['answered'])).rejects.toThrow('permission denied')
    await expect(db.query('delete from meeting_replies')).rejects.toThrow('permission denied')
    await db.exec("set test.uid = ''")
    expect((await db.query('select * from meeting_questions')).rows).toHaveLength(0)
    expect((await db.query('select * from meeting_replies')).rows).toHaveLength(0)
    await expect(ask()).rejects.toThrow('Approved member')
    await expect(db.query('select reply_to_meeting_question($1, $2, $3, $4)', [question, 'Name', 'Group', 'Reply'])).rejects.toThrow('Approved member')
    await expect(db.query('select set_meeting_question_status($1, $2)', [question, 'answered'])).rejects.toThrow('Approved member')
    await db.exec('reset role; set role anon')
    await expect(db.query('select * from meeting_questions')).rejects.toThrow('permission denied')
    await expect(ask()).rejects.toThrow('permission denied')
    await db.exec(`reset role; set role authenticated; set test.uid = '${member}'`)
  })

  it('restricts status changes to the assigned group or admin', async () => {
    await expect(db.query('select set_meeting_question_status($1, $2)', [question, 'answered'])).rejects.toThrow('Only this group')
    await db.exec("set test.assigned = 'yes'")
    for (const status of ['meeting', 'answered', 'follow_up', 'open']) {
      await db.query('select set_meeting_question_status($1, $2)', [question, status])
      expect((await db.query('select status from meeting_questions where id = $1', [question])).rows[0]).toEqual({ status })
    }
    await expect(db.query('select set_meeting_question_status($1, $2)', [question, 'invalid'])).rejects.toThrow('check constraint')
  })

  it('validates file ownership, signature, message length and page numbers', async () => {
    await expect(ask('slides', member, 1)).rejects.toThrow('Choose a PDF')
    await expect(ask(null, null, 1)).rejects.toThrow('Choose a PDF')
    await expect(ask('slides', file, 0)).rejects.toThrow('check constraint')
    await expect(ask(null, null, null, ' ')).rejects.toThrow('check constraint')
    await expect(ask(null, null, null, 'Wenlin', 'x'.repeat(4001))).rejects.toThrow('check constraint')
    await ask('archive-lab-files', file, 1)
    await db.exec('reset role')
    await db.query('update archive_lab_files set group_id = $1', [member])
    await expect(ask('archive-lab-files', file, 1)).rejects.toThrow('Choose a PDF')
  })

  it('keeps discussions attached to the original group and retains removed file references', async () => {
    await expect(db.query('update agenda_slots set group_id = $1', [member])).rejects.toThrow('Keep its meeting and group')
    await expect(db.query('delete from agenda_slots')).rejects.toThrow('foreign key constraint')
    await db.query('delete from slide_files')
    expect((await db.query('select file_name from meeting_questions where id = $1', [question])).rows[0]).toEqual({ file_name: 'research.pdf' })
  })
})
