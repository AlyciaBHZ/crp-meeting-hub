import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260814190000_named_slide_files.sql?raw'

describe('named slide files migration', () => {
  it('creates private transactional named PDF collections for agenda slots', () => {
    expect(migration).toContain('public.slide_files')
    expect(migration).toContain('display_name')
    expect(migration).toContain('reserve_slide_file')
    expect(migration).toContain('cancel_slide_file')
    expect(migration).toContain('pg_advisory_xact_lock')
    expect(migration).toMatch(/count\(\*\)\s*>=\s*20/)
    expect(migration).toContain('application/pdf')
    expect(migration).toContain('public.can_manage_agenda_slot')
    expect(migration).toContain('storage.objects')
    expect(migration).toContain('protect_agenda_slots_with_slide_files')
    expect(migration).toContain('before delete or update of group_id')
    expect(migration).toContain('grant execute')
    expect(migration).toContain('to authenticated')
  })
})
