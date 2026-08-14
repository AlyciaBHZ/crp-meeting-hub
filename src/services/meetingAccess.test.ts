import { describe, expect, it } from 'vitest'
import { canManageSlot, mapCloudMeeting } from './meetingAccess'

describe('meeting access', () => {
  it('allows administrators to manage every agenda slot', () => {
    expect(canManageSlot({ id: 'admin-1', role: 'admin' }, { groupMemberIds: [] })).toBe(true)
  })

  it('allows presenters to manage slots for their groups', () => {
    expect(canManageSlot({ id: 'member-1', role: 'presenter' }, { groupMemberIds: ['member-1'] })).toBe(true)
    expect(canManageSlot({ id: 'member-1', role: 'presenter' }, { groupMemberIds: ['member-2'] })).toBe(false)
    expect(canManageSlot(null, { groupMemberIds: ['member-1'] })).toBe(false)
  })

  it('maps database records into the meeting view model', () => {
    const result = mapCloudMeeting(
      {
        id: 'meeting-1', title: 'CRP Grant Meeting', meeting_date: '2026-09-01', venue: 'Seminar Room',
        timezone: 'Asia/Singapore', presentation_minutes: 15, qa_minutes: 5,
      },
      [{
        id: 'slot-1', starts_at: '09:00:00', ends_at: '09:20:00', group_name: "Prof Zhang Yang's group",
        presenter_id: 'member-1', group_id: 'group-1', resources: [{ kind: 'slides', object_path: 'slot-1/slides.pdf', original_name: 'slides.pdf' }],
      }],
      { object_path: 'meeting-1/minutes', original_name: 'minutes.pdf' },
      { zoom_url: 'https://zoom.us/j/123' },
      { 'group-1': ['member-1', 'member-2'] },
    )

    expect(result.date).toBe('1 Sept 2026')
    expect(result.dateISO).toBe('2026-09-01')
    expect(result.slots[0]).toEqual(expect.objectContaining({
      presenterId: 'member-1', groupId: 'group-1', groupMemberIds: ['member-1', 'member-2'],
      slideStatus: 'uploaded', slideFileName: 'slides.pdf', slideObjectPath: 'slot-1/slides.pdf',
    }))
    expect(result.zoomUrl).toBe('https://zoom.us/j/123')
    expect(result.minutesFileName).toBe('minutes.pdf')
  })
})
