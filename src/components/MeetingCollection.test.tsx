import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Meeting } from '../data/meeting'
import { MeetingCollection } from './MeetingCollection'

const pastMeeting: Meeting = {
  id: 'meeting-past',
  title: 'CRP Grant Meeting',
  date: '14 Jun 2026',
  dateISO: '2026-06-14',
  timezone: 'Asia/Singapore',
  presentationMinutes: 15,
  qaMinutes: 5,
  zoomUrl: 'https://zoom.us/j/past',
  slots: [{
    id: 'slot-1', startsAt: '09:00', endsAt: '09:20', groupName: 'Group 1', groupId: 'group-1',
    groupMemberIds: ['member-1'], slideStatus: 'uploaded', slideFiles: [{
      id: 'slide-file-1', agendaSlotId: 'slot-1', displayName: 'Project update', originalName: 'slides.pdf',
      objectPath: 'slot-1/slide-file-1.pdf', sizeBytes: 1024, uploadedBy: 'member-1', uploadedAt: '2026-06-13T01:00:00Z',
    }],
  }],
  minutesFileName: 'minutes.pdf',
  minutesObjectPath: 'meeting-past/minutes',
  archiveFiles: [
    { id: 'file-1', meetingId: 'meeting-past', groupId: 'group-1', groupName: 'Group 1', originalName: 'results.pdf', objectPath: 'meeting-past/group-1/file-1.pdf', sizeBytes: 1024, uploadedAt: '2026-06-15T01:00:00Z' },
  ],
}

const callbacks = {
  onUploadSlides: vi.fn(() => Promise.resolve()),
  onDownloadSlides: vi.fn(() => Promise.resolve()),
  onUploadMinutes: vi.fn(() => Promise.resolve()),
  onDownloadMinutes: vi.fn(() => Promise.resolve()),
  onDownloadArchiveFile: vi.fn(() => Promise.resolve()),
}

describe('MeetingCollection', () => {
  it('expands and focuses an older linked group without preventing later collapse', async () => {
    const newest = { ...pastMeeting, id: 'newest', dateISO: '2026-09-01' }
    const target = { meetingId: pastMeeting.id, groupId: 'group-1' }
    render(<MeetingCollection view="archive" meetings={[newest, pastMeeting]} profile={null} target={target} />)
    const cards = screen.getAllByRole('article')
    expect(within(cards[1]).getByRole('button', { name: 'Collapse meeting' })).toBeVisible()
    await waitFor(() => expect(document.activeElement?.id).toBe('meeting-meeting-past-group-group-1'))
    await userEvent.click(within(cards[1]).getByRole('button', { name: 'Collapse meeting' }))
    expect(within(cards[1]).getByRole('button', { name: 'Expand meeting' })).toBeVisible()
  })

  it('does not expose discussion or preview actions to signed-out visitors', () => {
    const repository = { list: vi.fn(), ask: vi.fn(), reply: vi.fn(), setStatus: vi.fn() }
    render(<MeetingCollection view="archive" meetings={[pastMeeting]} profile={null} discussionRepository={repository} />)
    expect(screen.queryByRole('button', { name: /Questions & discussion/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Preview/ })).not.toBeInTheDocument()
    expect(repository.list).not.toHaveBeenCalled()
  })

  it('orders archived meetings newest first and keeps minutes available on collapsed cards', async () => {
    const older = { ...pastMeeting, id: 'older', date: '5 May 2026', dateISO: '2026-05-05', minutesFileName: undefined, minutesObjectPath: undefined }
    const newer = { ...pastMeeting, id: 'newer', date: '5 Aug 2026', dateISO: '2026-08-05' }
    const input = [older, newer]
    render(<MeetingCollection {...callbacks} view="archive" meetings={input} profile={{ id: 'admin', role: 'admin' }} />)
    const cards = screen.getAllByRole('article')
    expect(within(cards[0]).getByText('5 Aug 2026')).toBeVisible()
    expect(within(cards[1]).getByText('5 May 2026')).toBeVisible()
    expect(input[0]).toBe(older)
    expect(within(cards[0]).getByRole('button', { name: 'Collapse meeting' })).toHaveAttribute('aria-expanded', 'true')
    expect(within(cards[1]).getByRole('button', { name: 'Expand meeting' })).toHaveAttribute('aria-expanded', 'false')
    expect(within(cards[1]).queryByRole('region', { name: 'PDFs for Group 1' })).not.toBeInTheDocument()
    expect(within(cards[1]).getByRole('button', { name: 'Upload minutes' })).toBeVisible()
    expect(within(cards[1]).getByText('Not uploaded yet')).toBeVisible()
    const minutes = new File(['minutes'], 'may-minutes.pdf', { type: 'application/pdf' })
    await userEvent.upload(within(cards[1]).getByLabelText('Meeting minutes file'), minutes)
    expect(callbacks.onUploadMinutes).toHaveBeenCalledWith(older, minutes)
    expect(within(cards[0]).queryByText('Uploaded: may-minutes.pdf')).not.toBeInTheDocument()
    await userEvent.click(within(cards[0]).getByRole('button', { name: 'Download' }))
    expect(callbacks.onDownloadMinutes).toHaveBeenCalledWith(newer)
  })

  it('collapses from the bottom, restores focus, and preserves unfinished PDF input', async () => {
    render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)
    await userEvent.type(screen.getByLabelText('Presenter / document name'), 'Draft update')
    await userEvent.click(screen.getByRole('button', { name: 'Collapse and back to meeting' }))
    const toggle = screen.getByRole('button', { name: 'Expand meeting' })
    expect(toggle).toHaveFocus()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('minutes.pdf')).toBeVisible()
    await userEvent.keyboard('{Enter}')
    expect(screen.getByLabelText('Presenter / document name')).toHaveValue('Draft update')
    expect(screen.getByRole('region', { name: 'PDFs for Group 1' })).toBeVisible()
  })

  it('keeps collapse choices with their meetings when data refreshes or order changes', async () => {
    const older = { ...pastMeeting, id: 'older', date: '5 May 2026', dateISO: '2026-05-05' }
    const { rerender } = render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting, older]} profile={null} />)
    const olderCard = screen.getByRole('article', { name: 'CRP Grant Meeting 5 May 2026' })
    await userEvent.click(within(olderCard).getByRole('button', { name: 'Expand meeting' }))
    rerender(<MeetingCollection {...callbacks} view="archive" meetings={[{ ...older, dateISO: '2026-07-05', date: '5 Jul 2026' }, pastMeeting]} profile={null} />)
    expect(within(screen.getAllByRole('article')[0]).getByRole('button', { name: 'Collapse meeting' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows archived meetings without exposing their old Zoom links', () => {
    render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)

    expect(screen.getByRole('heading', { name: 'Past meetings' })).toBeInTheDocument()
    expect(screen.getAllByText('14 Jun 2026')).toHaveLength(1)
    expect(screen.queryByRole('link', { name: 'Open Zoom meeting' })).not.toBeInTheDocument()
    expect(screen.getByText('Project update')).toBeInTheDocument()
    expect(screen.getByText(/slides\.pdf/)).toBeInTheDocument()
    expect(screen.getByText('minutes.pdf')).toBeInTheDocument()
  })

  it('shows the Zoom link to approved members for an upcoming meeting', () => {
    const upcoming = { ...pastMeeting, id: 'meeting-future', date: '14 Oct 2026', dateISO: '2026-10-14', zoomUrl: 'https://zoom.us/j/future' }
    render(<MeetingCollection {...callbacks} view="upcoming" meetings={[upcoming]} profile={{ id: 'member-1', role: 'presenter' }} />)

    expect(screen.getByRole('heading', { name: 'Upcoming meetings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Zoom meeting' })).toHaveAttribute('href', 'https://zoom.us/j/future')
  })

  it('does not expose the Zoom link to public visitors', () => {
    render(<MeetingCollection {...callbacks} view="upcoming" meetings={[pastMeeting]} profile={null} />)
    expect(screen.queryByRole('link', { name: 'Open Zoom meeting' })).not.toBeInTheDocument()
  })

  it('shows a useful empty state when no meeting is scheduled', () => {
    render(<MeetingCollection {...callbacks} view="upcoming" meetings={[]} profile={null} />)
    expect(screen.getByText('No online meeting is scheduled yet.')).toBeInTheDocument()
  })

  it('unifies old archive PDFs and slides in one group card, visible only to members', () => {
    const { rerender } = render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={null} />)
    expect(screen.queryByText('Lab PDF archive')).not.toBeInTheDocument()
    expect(screen.queryByText('results.pdf')).not.toBeInTheDocument()
    expect(screen.queryByText('Project update')).not.toBeInTheDocument()

    rerender(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)
    expect(screen.queryByText('Lab PDF archive')).not.toBeInTheDocument()
    const group = within(screen.getByRole('region', { name: 'PDFs for Group 1' }))
    expect(group.getByText('results.pdf')).toBeInTheDocument()
    expect(group.getByText('Project update')).toBeInTheDocument()
    expect(group.getByText('2 / 20 PDFs')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { name: 'Group 1' })).toHaveLength(1)
  })

  it('lets an administrator upload for every participating Lab', () => {
    const meeting = {
      ...pastMeeting,
      slots: [...pastMeeting.slots, { id: 'slot-2', startsAt: '09:20', endsAt: '09:40', groupName: 'Group 2', groupId: 'group-2', groupMemberIds: [], slideStatus: 'awaiting' as const }],
    }
    render(<MeetingCollection {...callbacks} view="archive" meetings={[meeting]} profile={{ id: 'admin-1', role: 'admin' }} />)

    expect(within(screen.getByRole('region', { name: 'PDFs for Group 1' })).getByRole('button', { name: 'Upload PDF' })).toBeEnabled()
    expect(within(screen.getByRole('region', { name: 'PDFs for Group 2' })).getByRole('button', { name: 'Upload PDF' })).toBeEnabled()
  })

  it('keeps the same upload control before and after a meeting for an assigned group', () => {
    const upcoming = {
      ...pastMeeting,
      id: 'meeting-future',
      date: '14 Oct 2026',
      dateISO: '2026-10-14',
      archiveFiles: [],
      slots: pastMeeting.slots.map((slot) => ({ ...slot, slideStatus: 'awaiting' as const, slideFiles: [] })),
    }
    const { rerender } = render(
      <MeetingCollection {...callbacks} view="upcoming" meetings={[upcoming]} profile={{ id: 'member-1', role: 'presenter' }} />,
    )

    expect(screen.getByLabelText('Presenter / document name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose PDF' })).toBeInTheDocument()
    expect(screen.getByText('0 / 20 PDFs')).toBeInTheDocument()

    rerender(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)
    expect(screen.getByLabelText('Presenter / document name')).toBeInTheDocument()
    rerender(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'unassigned', role: 'presenter' }} />)
    expect(screen.queryByRole('button', { name: 'Upload PDF' })).not.toBeInTheDocument()
  })

  it('routes archived PDFs and new PDF uploads to the correct meeting', async () => {
    render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Download results.pdf' }))
    expect(callbacks.onDownloadArchiveFile).toHaveBeenCalledWith(pastMeeting, pastMeeting.archiveFiles![0])
    await userEvent.type(screen.getByLabelText('Presenter / document name'), 'Follow-up')
    const pdf = new File(['pdf'], 'follow-up.pdf', { type: 'application/pdf' })
    await userEvent.upload(screen.getByLabelText('PDF file for Group 1'), pdf)
    await userEvent.click(screen.getByRole('button', { name: 'Upload PDF' }))
    expect(callbacks.onUploadSlides).toHaveBeenCalledWith(pastMeeting, pastMeeting.slots[0], 'Follow-up', pdf)
    expect(screen.queryByRole('button', { name: /Upload minutes|Replace minutes/ })).not.toBeInTheDocument()
  })

  it('exposes creation and editing directly to administrators only', async () => {
    const onCreateMeeting = vi.fn()
    const onEditMeeting = vi.fn()
    const { rerender } = render(<MeetingCollection {...callbacks} view="upcoming" meetings={[pastMeeting]} profile={{ id: 'admin', role: 'admin' }} onCreateMeeting={onCreateMeeting} onEditMeeting={onEditMeeting} />)
    await userEvent.click(screen.getByRole('button', { name: 'New meeting' }))
    await userEvent.click(screen.getByRole('button', { name: 'Edit meeting' }))
    expect(onCreateMeeting).toHaveBeenCalledOnce()
    expect(onEditMeeting).toHaveBeenCalledWith(pastMeeting)
    rerender(<MeetingCollection {...callbacks} view="upcoming" meetings={[pastMeeting]} profile={{ id: 'member', role: 'presenter' }} onCreateMeeting={onCreateMeeting} onEditMeeting={onEditMeeting} />)
    expect(screen.queryByRole('button', { name: 'New meeting' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit meeting' })).not.toBeInTheDocument()
    rerender(<MeetingCollection {...callbacks} view="upcoming" meetings={[]} profile={{ id: 'admin', role: 'admin' }} onCreateMeeting={onCreateMeeting} />)
    expect(screen.getByRole('button', { name: 'New meeting' })).toBeEnabled()
  })
})
