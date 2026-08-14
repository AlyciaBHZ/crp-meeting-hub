import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260814173000_protect_archive_reservations.sql?raw'

describe('archive reservation cleanup migration', () => {
  it('removes direct metadata deletion and only cancels reservations without stored objects', () => {
    expect(migration).toContain('drop policy if exists "uploaders remove failed PDF reservations"')
    expect(migration).toContain('revoke delete on table public.archive_lab_files from authenticated')
    expect(migration).toContain('create or replace function public.cancel_archive_lab_file')
    expect(migration).toContain('not exists')
    expect(migration).toContain('from storage.objects')
  })
})
