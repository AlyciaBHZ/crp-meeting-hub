import { CalendarDays, Clock3, Video } from 'lucide-react'
import { useId } from 'react'
import type { AgendaSlot, Meeting } from '../data/meeting'
import { canManageSlot, type MemberProfile } from '../services/meetingAccess'
import type { MeetingView } from '../services/meetingLifecycle'
import { Agenda } from './Agenda'
import { Resources } from './Resources'

interface MeetingCollectionProps {
  view: MeetingView
  meetings: Meeting[]
  profile: MemberProfile | null
  cloudMode?: boolean
  onUploadSlides?: (meeting: Meeting, slot: AgendaSlot, file: File) => Promise<void>
  onDownloadSlides?: (meeting: Meeting, slot: AgendaSlot) => Promise<void>
  onUploadMinutes?: (meeting: Meeting, file: File) => Promise<void>
  onDownloadMinutes?: (meeting: Meeting) => Promise<void>
}

function meetingTime(meeting: Meeting) {
  if (!meeting.slots.length) return 'Schedule pending'
  return `${meeting.slots[0].startsAt} - ${meeting.slots[meeting.slots.length - 1].endsAt}`
}

export function MeetingCollection({
  view,
  meetings,
  profile,
  cloudMode = true,
  onUploadSlides,
  onDownloadSlides,
  onUploadMinutes,
  onDownloadMinutes,
}: MeetingCollectionProps) {
  const headingId = useId()
  const isAdmin = profile?.role === 'admin'
  const title = view === 'upcoming' ? 'Upcoming meetings' : 'Past meetings'
  const emptyMessage = view === 'upcoming'
    ? 'No online meeting is scheduled yet.'
    : 'No past meetings are available.'

  return (
    <section className="meeting-collection" aria-labelledby={headingId}>
      <header className="collection-heading">
        <p className="eyebrow">CRP online meetings</p>
        <h1 id={headingId}>{title}</h1>
      </header>

      {!meetings.length && <p className="empty-state">{emptyMessage}</p>}

      {meetings.map((meeting, index) => {
        const meetingHeadingId = `${headingId}-${meeting.id}`
        return (
          <article className="meeting-entry" key={meeting.id} aria-labelledby={meetingHeadingId}>
            <header className="meeting-entry-header">
              <div>
                <p className="meeting-sequence">{view === 'upcoming' && index === 0 ? 'Next meeting' : meeting.title}</p>
                <h2 id={meetingHeadingId}>{meeting.date ?? 'Date pending'}</h2>
              </div>
              <dl className="online-meeting-facts">
                <div><dt><CalendarDays aria-hidden="true" size={16} /> Date</dt><dd>{meeting.date ?? 'Pending'}</dd></div>
                <div><dt><Clock3 aria-hidden="true" size={16} /> Time</dt><dd>{meetingTime(meeting)}</dd></div>
              </dl>
              {view === 'upcoming' && profile && meeting.zoomUrl && (
                <a className="zoom-link" href={meeting.zoomUrl} target="_blank" rel="noreferrer">
                  <Video aria-hidden="true" size={17} /> Open Zoom meeting
                </a>
              )}
            </header>

            <Agenda
              meeting={meeting}
              cloudMode={cloudMode}
              canUpload={(slot) => canManageSlot(profile, slot)}
              onUpload={onUploadSlides ? (slot, file) => onUploadSlides(meeting, slot, file) : undefined}
              onDownload={profile && onDownloadSlides ? (slot) => onDownloadSlides(meeting, slot) : undefined}
            />
            <Resources
              meeting={meeting}
              isAdmin={isAdmin}
              onUpload={isAdmin && onUploadMinutes ? (file) => onUploadMinutes(meeting, file) : undefined}
              onDownload={profile && meeting.minutesObjectPath && onDownloadMinutes ? () => onDownloadMinutes(meeting) : undefined}
            />
          </article>
        )
      })}
    </section>
  )
}
