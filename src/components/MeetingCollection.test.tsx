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
}

const callbacks = {
  onUploadSlides: vi.fn(() => Promise.resolve()),
  onDownloadSlides: vi.fn(() => Promise.resolve()),
  onUploadMinutes: vi.fn(() => Promise.resolve()),
  onDownloadMinutes: vi.fn(() => Promise.resolve()),
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
})
