import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260814170000_archive_lab_files.sql?raw'

describe('archive Lab files migration', () => {
  const sql = migration.toLowerCase()

  it('creates private PDF storage with RLS and a transactional 20-file reservation', () => {
    expect(sql).toContain('create table public.archive_lab_files')
    expect(sql).toContain("'archive-lab-files'")
    expect(sql).toContain('public.reserve_archive_lab_file')
    expect(sql).toContain('count(*) >= 20')
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('storage.objects')
  })

  it('provides an administrator-only historical meeting RPC', () => {
    expect(sql).toContain('public.register_historical_meeting')
    expect(sql).toContain("meeting_date_input >= (now() at time zone 'asia/singapore')::date")
  })
})
