import { describe, expect, it } from 'vitest'
import migration from '../../supabase/migrations/20260814090000_recurring_online_meetings.sql?raw'
import {
  buildAgendaDraft,
  classifyMeetingDate,
  getSingaporeTodayISO,
  validateHistoricalMeetingDraft,
  validateMeetingDraft,
} from './meetingLifecycle'

const groups = [
  { id: 'group-1', name: "Prof Zhang Yang's group", active: true, memberIds: [] },
  { id: 'group-2', name: "Prof Li Yang's group", active: true, memberIds: [] },
]

describe('meeting lifecycle', () => {
  it('classifies meetings from Singapore calendar dates', () => {
    expect(classifyMeetingDate('2026-08-13', '2026-08-14')).toBe('archive')
    expect(classifyMeetingDate('2026-08-14', '2026-08-14')).toBe('upcoming')
    expect(classifyMeetingDate('2026-08-15', '2026-08-14')).toBe('upcoming')
  })

  it('derives the Singapore date without depending on the browser timezone', () => {
    expect(getSingaporeTodayISO(new Date('2026-08-13T16:30:00.000Z'))).toBe('2026-08-14')
  })

  it('proposes consecutive twenty-minute slots for selected groups', () => {
    expect(buildAgendaDraft(groups, '09:00')).toEqual([
      { groupId: 'group-1', groupName: "Prof Zhang Yang's group", startsAt: '09:00', endsAt: '09:20', sortOrder: 1 },
      { groupId: 'group-2', groupName: "Prof Li Yang's group", startsAt: '09:20', endsAt: '09:40', sortOrder: 2 },
    ])
  })

  it('rejects incomplete and unsafe meeting drafts', () => {
    expect(validateMeetingDraft({ date: '', zoomUrl: '', slots: [] })).toBe('Meeting date is required.')
    expect(validateMeetingDraft({ date: '2026-10-14', zoomUrl: 'not-a-url', slots: [] })).toBe('Enter a valid Zoom URL.')
    expect(validateMeetingDraft({ date: '2026-10-14', zoomUrl: 'http://zoom.us/j/123', slots: [] })).toBe('Enter a secure Zoom URL.')
    expect(validateMeetingDraft({ date: '2026-10-14', zoomUrl: 'https://example.com/meeting', slots: [] })).toBe('Enter a Zoom URL.')
    expect(validateMeetingDraft({ date: '2026-10-14', zoomUrl: 'https://zoom.us/j/123', slots: [] })).toBe('Select at least one presenting group.')
    expect(validateMeetingDraft({
      date: '2026-10-14', zoomUrl: 'https://zoom.us/j/123',
      slots: [{ groupId: 'group-1', groupName: 'Group 1', startsAt: '09:20', endsAt: '09:00', sortOrder: 1 }],
    })).toBe('Every agenda end time must be after its start time.')
  })

  it('rejects overlapping group times', () => {
    expect(validateMeetingDraft({
      date: '2026-10-14', zoomUrl: 'https://zoom.us/j/123',
      slots: [
        { groupId: 'group-1', groupName: 'Group 1', startsAt: '09:00', endsAt: '09:20', sortOrder: 1 },
        { groupId: 'group-2', groupName: 'Group 2', startsAt: '09:10', endsAt: '09:30', sortOrder: 2 },
      ],
    })).toBe('Agenda times cannot overlap.')
  })

  it('accepts a complete meeting draft', () => {
    expect(validateMeetingDraft({
      date: '2026-10-14', zoomUrl: 'https://zoom.us/j/123',
      slots: [{ groupId: 'group-1', groupName: 'Group 1', startsAt: '09:00', endsAt: '09:20', sortOrder: 1 }],
    })).toBeNull()
  })

  it('accepts a past meeting without Zoom and rejects today or future dates', () => {
    const draft = {
      date: '2026-06-14',
      slots: [{ groupId: 'group-1', groupName: 'Group 1', startsAt: '09:00', endsAt: '09:20', sortOrder: 1 }],
    }
    expect(validateHistoricalMeetingDraft(draft, '2026-08-14')).toBeNull()
    expect(validateHistoricalMeetingDraft({ ...draft, date: '2026-08-14' }, '2026-08-14')).toBe('Choose a date before today.')
  })
})

describe('recurring meeting migration contract', () => {
  it('keeps Zoom links private and creates group-based scheduling primitives', () => {
    expect(migration).toContain('create table public.groups')
    expect(migration).toContain('create table public.group_members')
    expect(migration).toContain('create table public.meeting_private_details')
    expect(migration).toContain('create or replace function public.create_meeting_with_slots')
    expect(migration).toContain('create or replace function public.update_meeting_with_slots')
    expect(migration).toContain('alter table public.agenda_slots add column group_id')
    expect(migration).not.toMatch(/alter table public\.meetings add column zoom_url/i)
  })

  it('binds slide metadata to the authorized agenda slot and private storage path', () => {
    expect(migration).toContain("bucket_id = 'slides'")
    expect(migration).toContain("object_path = agenda_slot_id::text || '/slides'")
    expect(migration).toContain('slot.meeting_id = resources.meeting_id')
    expect(migration).toContain('revoke all on function public.can_manage_agenda_slot(uuid) from public')
  })
})
