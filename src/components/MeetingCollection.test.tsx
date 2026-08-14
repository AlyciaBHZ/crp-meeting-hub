import { render, screen } from '@testing-library/react'
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
    groupMemberIds: ['member-1'], slideStatus: 'uploaded', slideFileName: 'slides.pdf', slideObjectPath: 'slot-1/slides',
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
  onUploadArchiveFiles: vi.fn(() => Promise.resolve()),
  onDownloadArchiveFile: vi.fn(() => Promise.resolve()),
}

describe('MeetingCollection', () => {
  it('shows archived meetings without exposing their old Zoom links', () => {
    render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)

    expect(screen.getByRole('heading', { name: 'Past meetings' })).toBeInTheDocument()
    expect(screen.getAllByText('14 Jun 2026')).toHaveLength(2)
    expect(screen.queryByRole('link', { name: 'Open Zoom meeting' })).not.toBeInTheDocument()
    expect(screen.getByText('slides.pdf')).toBeInTheDocument()
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

  it('shows Lab PDF archives only to signed-in members', () => {
    const { rerender } = render(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={null} />)
    expect(screen.queryByText('Lab PDF archive')).not.toBeInTheDocument()
    expect(screen.queryByText('results.pdf')).not.toBeInTheDocument()

    rerender(<MeetingCollection {...callbacks} view="archive" meetings={[pastMeeting]} profile={{ id: 'member-1', role: 'presenter' }} />)
    expect(screen.getByText('Lab PDF archive')).toBeInTheDocument()
    expect(screen.getByText('results.pdf')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Group 1' })).toBeInTheDocument()
  })

  it('lets an administrator upload for every participating Lab', () => {
    const meeting = {
      ...pastMeeting,
      slots: [...pastMeeting.slots, { id: 'slot-2', startsAt: '09:20', endsAt: '09:40', groupName: 'Group 2', groupId: 'group-2', groupMemberIds: [], slideStatus: 'awaiting' as const }],
    }
    render(<MeetingCollection {...callbacks} view="archive" meetings={[meeting]} profile={{ id: 'admin-1', role: 'admin' }} />)

    expect(screen.getByRole('option', { name: 'Group 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Group 2' })).toBeInTheDocument()
  })
})
