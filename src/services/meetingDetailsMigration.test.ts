import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260814180000_editable_meeting_details.sql?raw'

describe('editable meeting details migration', () => {
  it('adds administrator-only transactional wrappers for all editable meeting details', () => {
    expect(migration).toContain('public.create_meeting_with_details')
    expect(migration).toContain('public.update_meeting_with_details')
    expect(migration).toContain('title_input')
    expect(migration).toContain('presentation_minutes_input')
    expect(migration).toContain('qa_minutes_input')
    expect(migration).toContain('public.create_meeting_with_slots')
    expect(migration).toContain('public.update_meeting_with_slots')
    expect(migration).toContain('grant execute')
  })
})
