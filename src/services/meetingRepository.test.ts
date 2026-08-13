import { describe, expect, it, vi } from 'vitest'
import { createMeetingRepository } from './meetingRepository'

function queryResult<T>(data: T) {
  const chain = {
    select: vi.fn(() => chain),
    order: vi.fn(() => Promise.resolve({ data, error: null })),
    eq: vi.fn(() => chain),
    single: vi.fn(() => Promise.resolve({ data, error: null })),
  }
  return chain
}

describe('meetingRepository', () => {
  it('loads the upcoming meeting and ordered agenda slots', async () => {
    const meeting = { id: 'meeting-1', title: 'CRP Grant Meeting' }
    const slots = [{ id: 'slot-1', starts_at: '09:00:00' }]
    const from = vi.fn((table: string) => table === 'meetings' ? queryResult(meeting) : queryResult(slots))
    const repository = createMeetingRepository({ from } as never)

    await expect(repository.getUpcomingMeeting()).resolves.toEqual({ meeting, slots, minutes: null })
    expect(from).toHaveBeenCalledWith('meetings')
    expect(from).toHaveBeenCalledWith('agenda_slots')
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

  it('adds approved members and assigns a presenter to an agenda slot', async () => {
    const insert = vi.fn(() => Promise.resolve({ error: null }))
    const updateChain = { eq: vi.fn(() => Promise.resolve({ error: null })) }
    const update = vi.fn(() => updateChain)
    const client = {
      from: vi.fn((table: string) => table === 'member_allowlist' ? { insert } : { update }),
    }
    const repository = createMeetingRepository(client as never)

    await repository.addMember('Presenter@Example.com', 'presenter')
    await repository.assignPresenter('slot-1', 'member-1')

    expect(insert).toHaveBeenCalledWith({ email: 'presenter@example.com', role: 'presenter' })
    expect(update).toHaveBeenCalledWith({ presenter_id: 'member-1' })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'slot-1')
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

  it('updates the meeting date and venue', async () => {
    const updateChain = { eq: vi.fn(() => Promise.resolve({ error: null })) }
    const update = vi.fn(() => updateChain)
    const repository = createMeetingRepository({ from: vi.fn(() => ({ update })) } as never)

    await repository.updateMeeting('meeting-1', { meeting_date: '2026-09-01', venue: 'Seminar Room' })

    expect(update).toHaveBeenCalledWith({ meeting_date: '2026-09-01', venue: 'Seminar Room' })
    expect(updateChain.eq).toHaveBeenCalledWith('id', 'meeting-1')
  })
})
