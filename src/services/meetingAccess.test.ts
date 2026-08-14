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
        presenter_id: 'member-1', group_id: 'group-1',
      }],
      { object_path: 'meeting-1/minutes', original_name: 'minutes.pdf' },
      { zoom_url: 'https://zoom.us/j/123' },
      { 'group-1': ['member-1', 'member-2'] },
      [{
        id: 'archive-1', meeting_id: 'meeting-1', group_id: 'group-1', object_path: 'meeting-1/group-1/archive-1.pdf',
        original_name: 'analysis.pdf', size_bytes: 2048, uploaded_at: '2026-09-02T01:00:00Z',
      }],
      [{
        id: 'slide-file-1', agenda_slot_id: 'slot-1', display_name: 'Yang Li - immune adaptation',
        original_name: 'immune-adaptation.pdf', object_path: 'slot-1/slide-file-1.pdf', size_bytes: 4096,
        uploaded_by: 'member-1', uploaded_at: '2026-08-31T01:00:00Z',
      }],
    )

    expect(result.date).toBe('1 Sept 2026')
    expect(result.dateISO).toBe('2026-09-01')
    expect(result.slots[0]).toEqual(expect.objectContaining({
      presenterId: 'member-1', groupId: 'group-1', groupMemberIds: ['member-1', 'member-2'],
      slideStatus: 'uploaded',
    }))
    expect(result.zoomUrl).toBe('https://zoom.us/j/123')
    expect(result.minutesFileName).toBe('minutes.pdf')
    expect(result.archiveFiles).toEqual([expect.objectContaining({
      id: 'archive-1', groupId: 'group-1', groupName: "Prof Zhang Yang's group", originalName: 'analysis.pdf',
    })])
    expect(result.slots[0].slideFiles).toEqual([{
      id: 'slide-file-1', agendaSlotId: 'slot-1', displayName: 'Yang Li - immune adaptation',
      originalName: 'immune-adaptation.pdf', objectPath: 'slot-1/slide-file-1.pdf', sizeBytes: 4096,
      uploadedBy: 'member-1', uploadedAt: '2026-08-31T01:00:00Z',
    }])
  })
})
