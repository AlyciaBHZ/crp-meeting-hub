import { describe, expect, it, vi } from 'vitest'
import { createMeetingRepository } from './meetingRepository'

function queryResult<T>(data: T) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
    eq: vi.fn(() => chain),
    not: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data, error: null })),
  }
  return chain
}

describe('meetingRepository', () => {
  it('loads and classifies all dated meetings with private member details', async () => {
    const meetings = [
      { id: 'past', title: 'CRP Grant Meeting', meeting_date: '2026-06-14', timezone: 'Asia/Singapore', presentation_minutes: 15, qa_minutes: 5 },
      { id: 'future', title: 'CRP Grant Meeting', meeting_date: '2026-10-14', timezone: 'Asia/Singapore', presentation_minutes: 15, qa_minutes: 5 },
    ]
    const slots = [
      { id: 'slot-past', meeting_id: 'past', group_id: 'group-1', group_name: 'Group 1', starts_at: '09:00', ends_at: '09:20', resources: [] },
      { id: 'slot-future', meeting_id: 'future', group_id: 'group-1', group_name: 'Group 1', starts_at: '09:00', ends_at: '09:20', resources: [] },
    ]
    const rows = {
      meetings,
      agenda_slots: slots,
      resources: [],
      meeting_private_details: [{ meeting_id: 'future', zoom_url: 'https://zoom.us/j/123' }],
      group_members: [{ group_id: 'group-1', profile_id: 'member-1' }],
    } as Record<string, unknown[]>
    const from = vi.fn((table: string) => queryResult(rows[table]))
    const repository = createMeetingRepository({ from } as never)

    await expect(repository.getMeetings('2026-08-14')).resolves.toEqual(expect.objectContaining({
      upcoming: [expect.objectContaining({ id: 'future', zoomUrl: 'https://zoom.us/j/123' })],
      archive: [expect.objectContaining({ id: 'past' })],
    }))
    expect(from).toHaveBeenCalledWith('meetings')
    expect(from).toHaveBeenCalledWith('agenda_slots')
    expect(from).toHaveBeenCalledWith('meeting_private_details')
  })

  it('creates complete meetings through the transactional database function', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 'meeting-2', error: null }))
    const repository = createMeetingRepository({ rpc } as never)

    await expect(repository.createMeeting({
      date: '2026-10-14',
      zoomUrl: 'https://zoom.us/j/123',
      slots: [{ groupId: 'group-1', groupName: 'Group 1', startsAt: '09:00', endsAt: '09:20', sortOrder: 1 }],
    })).resolves.toBe('meeting-2')

    expect(rpc).toHaveBeenCalledWith('create_meeting_with_slots', {
      meeting_date_input: '2026-10-14',
      zoom_url_input: 'https://zoom.us/j/123',
      slots_input: [{ group_id: 'group-1', starts_at: '09:00', ends_at: '09:20', sort_order: 1 }],
    })
  })

  it('updates an existing meeting and its schedule transactionally', async () => {
    const rpc = vi.fn(() => Promise.resolve({ data: 'meeting-1', error: null }))
    const repository = createMeetingRepository({ rpc } as never)
    const draft = {
      date: '2026-10-15', zoomUrl: 'https://zoom.us/j/new',
      slots: [{ id: 'slot-1', groupId: 'group-1', groupName: 'Group 1', startsAt: '10:00', endsAt: '10:20', sortOrder: 1 }],
    }

    await expect(repository.updateMeetingSchedule('meeting-1', draft)).resolves.toBe('meeting-1')
    expect(rpc).toHaveBeenCalledWith('update_meeting_with_slots', {
      meeting_id_input: 'meeting-1',
      meeting_date_input: '2026-10-15',
      zoom_url_input: 'https://zoom.us/j/new',
      slots_input: [{ slot_id: 'slot-1', group_id: 'group-1', starts_at: '10:00', ends_at: '10:20', sort_order: 1 }],
    })
  })

  it('creates groups and updates group membership idempotently', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    const upsert = vi.fn(() => Promise.resolve({ error: null }))
    const deleteResult = { eq: vi.fn() }
    deleteResult.eq.mockReturnValueOnce(deleteResult).mockReturnValueOnce(Promise.resolve({ error: null }))
    const remove = vi.fn(() => deleteResult)
    const from = vi.fn((table: string) => table === 'groups' ? { insert } : { upsert, delete: remove })
    const repository = createMeetingRepository({ from } as never)

    await repository.createGroup('  New Group  ')
    await repository.setGroupMember('group-1', 'member-1', true)
    await repository.setGroupMember('group-1', 'member-1', false)

    expect(insert).toHaveBeenCalledWith({ name: 'New Group' })
    expect(upsert).toHaveBeenCalledWith({ group_id: 'group-1', profile_id: 'member-1' })
    expect(remove).toHaveBeenCalled()
  })

  it('uploads slides into the private slides bucket and records metadata', async () => {
    const upload = vi.fn(() => Promise.resolve({ data: { path: 'slot-1/slides' }, error: null }))
    const upsert = vi.fn(() => Promise.resolve({ error: null }))
    const slotQuery = queryResult({ meeting_id: 'meeting-1' })
    const repository = createMeetingRepository({
      storage: { from: vi.fn(() => ({ upload })) },
      from: vi.fn((table: string) => table === 'agenda_slots' ? slotQuery : ({ upsert })),
    } as never)
    const file = new File(['slides'], 'slides.pdf', { type: 'application/pdf' })

    await expect(repository.uploadSlides('slot-1', 'user-1', file)).resolves.toBe('slot-1/slides')
    expect(upload).toHaveBeenCalledWith('slot-1/slides', file, { upsert: true })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ agenda_slot_id: 'slot-1', uploaded_by: 'user-1' }),
      { onConflict: 'kind,agenda_slot_id' },
    )
  })

  it('creates a signed download URL for a private resource', async () => {
    const createSignedUrl = vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://signed.example/file' }, error: null }))
    const repository = createMeetingRepository({ storage: { from: vi.fn(() => ({ createSignedUrl })) } } as never)

    await expect(repository.getDownloadUrl('slides', 'slot-1/slides.pdf')).resolves.toBe('https://signed.example/file')
    expect(createSignedUrl).toHaveBeenCalledWith('slot-1/slides.pdf', 60)
  })

  it('adds an approved member using a normalized email address', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    const repository = createMeetingRepository({ from: vi.fn(() => ({ insert })) } as never)

    await repository.addMember('Presenter@Example.com', 'presenter')

    expect(insert).toHaveBeenCalledWith({ email: 'presenter@example.com', role: 'presenter' })
  })

  it('replaces meeting minutes metadata instead of creating duplicate records', async () => {
    const upload = vi.fn(() => Promise.resolve({ data: { path: 'meeting-1/minutes' }, error: null }))
    const upsert = vi.fn(() => Promise.resolve({ error: null }))
    const repository = createMeetingRepository({
      storage: { from: vi.fn(() => ({ upload })) },
      from: vi.fn(() => ({ upsert })),
    } as never)
    const file = new File(['minutes'], 'minutes.pdf', { type: 'application/pdf' })

    await repository.uploadMinutes('meeting-1', 'admin-1', file)

    expect(upload).toHaveBeenCalledWith('meeting-1/minutes', file, { upsert: true })
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ meeting_id: 'meeting-1', kind: 'minutes' }), { onConflict: 'kind,resource_scope' })
  })

})
