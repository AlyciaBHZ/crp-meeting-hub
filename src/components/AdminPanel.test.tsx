import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { AdminPanel } from './AdminPanel'

const groups = [
  { id: 'group-1', name: "Prof Zhang Yang's group", active: true, memberIds: [] },
  { id: 'group-2', name: "Prof Li Yang's group", active: true, memberIds: [] },
]

const profiles = [
  { id: 'member-1', email: 'member@example.com', display_name: 'Member One', role: 'presenter' as const },
]

const baseProps = {
  profiles,
  groups,
  onCreateMeeting: vi.fn(() => Promise.resolve()),
  onUpdateMeeting: vi.fn(() => Promise.resolve()),
  onRegisterHistoricalMeeting: vi.fn(() => Promise.resolve()),
  onCreateGroup: vi.fn(() => Promise.resolve()),
  onUpdateGroup: vi.fn(() => Promise.resolve()),
  onSetGroupMember: vi.fn(() => Promise.resolve()),
  meetings: [],
}

describe('AdminPanel', () => {
  it('creates an online meeting from selected groups and proposed times', async () => {
    const onCreateMeeting = vi.fn(() => Promise.resolve())
    render(<AdminPanel {...baseProps} onCreateMeeting={onCreateMeeting} />)

    await userEvent.type(screen.getByLabelText('Meeting date'), '2026-10-14')
    await userEvent.type(screen.getByLabelText('Zoom link'), 'https://zoom.us/j/123')
    await userEvent.click(screen.getByLabelText("Select Prof Zhang Yang's group"))
    await userEvent.click(screen.getByRole('button', { name: 'Create meeting' }))

    expect(onCreateMeeting).toHaveBeenCalledWith({
      date: '2026-10-14',
      zoomUrl: 'https://zoom.us/j/123',
      slots: [{
        groupId: 'group-1', groupName: "Prof Zhang Yang's group", startsAt: '09:00', endsAt: '09:20', sortOrder: 1,
      }],
    })
  })

  it('creates a reusable research group', async () => {
    const onCreateGroup = vi.fn(() => Promise.resolve())
    render(<AdminPanel {...baseProps} onCreateGroup={onCreateGroup} />)

    await userEvent.type(screen.getByLabelText('New group name'), 'Prof New Group')
    await userEvent.click(screen.getByRole('button', { name: 'Add group' }))

    expect(onCreateGroup).toHaveBeenCalledWith('Prof New Group')
  })

  it('registers a past meeting with an agenda and no Zoom link', async () => {
    const onRegisterHistoricalMeeting = vi.fn(() => Promise.resolve())
    render(<AdminPanel {...baseProps} onRegisterHistoricalMeeting={onRegisterHistoricalMeeting} />)

    await userEvent.click(screen.getByRole('button', { name: 'Past meeting' }))
    await userEvent.type(screen.getByLabelText('Past meeting date'), '2026-06-14')
    await userEvent.click(screen.getByLabelText("Select Prof Zhang Yang's group"))
    await userEvent.click(screen.getByRole('button', { name: 'Register past meeting' }))

    expect(screen.queryByLabelText('Zoom link')).not.toBeInTheDocument()
    expect(onRegisterHistoricalMeeting).toHaveBeenCalledWith({
      date: '2026-06-14',
      slots: [{
        groupId: 'group-1', groupName: "Prof Zhang Yang's group", startsAt: '09:00', endsAt: '09:20', sortOrder: 1,
      }],
    })
  })

  it('loads and updates an existing future meeting', async () => {
    const onUpdateMeeting = vi.fn(() => Promise.resolve())
    const meeting = {
      id: 'meeting-1', title: 'CRP Grant Meeting', date: '14 Oct 2026', dateISO: '2026-10-14',
      timezone: 'Asia/Singapore', presentationMinutes: 15, qaMinutes: 5, zoomUrl: 'https://zoom.us/j/old',
      slots: [{ id: 'slot-1', groupId: 'group-1', groupMemberIds: [], groupName: "Prof Zhang Yang's group", startsAt: '09:00', endsAt: '09:20', slideStatus: 'awaiting' as const }],
    }
    render(<AdminPanel {...baseProps} meetings={[meeting]} onUpdateMeeting={onUpdateMeeting} />)

    await userEvent.selectOptions(screen.getByLabelText('Meeting to manage'), 'meeting-1')
    await userEvent.clear(screen.getByLabelText('Zoom link'))
    await userEvent.type(screen.getByLabelText('Zoom link'), 'https://zoom.us/j/new')
    await userEvent.click(screen.getByRole('button', { name: 'Save meeting' }))

    expect(onUpdateMeeting).toHaveBeenCalledWith('meeting-1', expect.objectContaining({
      date: '2026-10-14', zoomUrl: 'https://zoom.us/j/new',
      slots: [expect.objectContaining({ id: 'slot-1', groupId: 'group-1' })],
    }))
  })

  it('reorders an existing schedule without rebinding groups to different slot ids', async () => {
    const onUpdateMeeting = vi.fn(() => Promise.resolve())
    const meeting = {
      id: 'meeting-1', title: 'CRP Grant Meeting', date: '14 Oct 2026', dateISO: '2026-10-14',
      timezone: 'Asia/Singapore', presentationMinutes: 15, qaMinutes: 5, zoomUrl: 'https://zoom.us/j/old',
      slots: [
        { id: 'slot-1', groupId: 'group-1', groupMemberIds: [], groupName: "Prof Zhang Yang's group", startsAt: '09:00', endsAt: '09:20', slideStatus: 'uploaded' as const },
        { id: 'slot-2', groupId: 'group-2', groupMemberIds: [], groupName: "Prof Li Yang's group", startsAt: '09:20', endsAt: '09:40', slideStatus: 'awaiting' as const },
      ],
    }
    render(<AdminPanel {...baseProps} meetings={[meeting]} onUpdateMeeting={onUpdateMeeting} />)

    await userEvent.selectOptions(screen.getByLabelText('Meeting to manage'), 'meeting-1')
    await userEvent.click(screen.getByRole('button', { name: "Move Prof Li Yang's group up" }))
    await userEvent.click(screen.getByRole('button', { name: 'Save meeting' }))

    expect(onUpdateMeeting).toHaveBeenCalledWith('meeting-1', expect.objectContaining({
      slots: [
        expect.objectContaining({ id: 'slot-2', groupId: 'group-2', startsAt: '09:00', endsAt: '09:20', sortOrder: 1 }),
        expect.objectContaining({ id: 'slot-1', groupId: 'group-1', startsAt: '09:20', endsAt: '09:40', sortOrder: 2 }),
      ],
    }))
  })

  it('does not offer account creation because the team uses shared credentials', () => {
    render(<AdminPanel {...baseProps} />)

    expect(screen.queryByLabelText('Member email')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add member' })).not.toBeInTheDocument()
  })

  it('assigns an activated presenter to a group', async () => {
    const onSetGroupMember = vi.fn(() => Promise.resolve())
    render(<AdminPanel {...baseProps} onSetGroupMember={onSetGroupMember} />)

    await userEvent.click(screen.getByLabelText("Member One in Prof Zhang Yang's group"))
    expect(onSetGroupMember).toHaveBeenCalledWith('group-1', 'member-1', true)
  })
})
