import { CalendarDays, CalendarPlus, Clock3, Pencil, Users, Video } from 'lucide-react'
import { useId } from 'react'
import type { AgendaSlot, ArchiveLabFile, Meeting, SlideFile } from '../data/meeting'
import { canManageSlot, type MemberProfile } from '../services/meetingAccess'
import type { MeetingView } from '../services/meetingLifecycle'
import { Agenda } from './Agenda'
import { Resources } from './Resources'

interface MeetingCollectionProps {
  view: MeetingView
  meetings: Meeting[]
  profile: MemberProfile | null
  onUploadSlides?: (meeting: Meeting, slot: AgendaSlot, displayName: string, file: File) => Promise<void>
  onDownloadSlides?: (meeting: Meeting, file: SlideFile) => Promise<void>
  onRemoveSlides?: (meeting: Meeting, file: SlideFile) => Promise<void>
  onUploadMinutes?: (meeting: Meeting, file: File) => Promise<void>
  onDownloadMinutes?: (meeting: Meeting) => Promise<void>
  onDownloadArchiveFile?: (meeting: Meeting, file: ArchiveLabFile) => Promise<void>
  onCreateMeeting?: () => void
  onEditMeeting?: (meeting: Meeting) => void
  onManageGroups?: () => void
}

function meetingTime(meeting: Meeting) {
  if (!meeting.slots.length) return 'Schedule pending'
  return `${meeting.slots.map((slot) => slot.startsAt).sort()[0]} - ${meeting.slots.map((slot) => slot.endsAt).sort().at(-1)}`
}

export function MeetingCollection({
  view,
  meetings,
  profile,
  onUploadSlides,
  onDownloadSlides,
  onRemoveSlides,
  onUploadMinutes,
  onDownloadMinutes,
  onDownloadArchiveFile,
  onCreateMeeting,
  onEditMeeting,
  onManageGroups,
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
        <div>
        <p className="eyebrow">CRP online meetings</p>
        <h1 id={headingId}>{title}</h1>
        </div>
        {isAdmin && <div className="collection-actions">
          {onManageGroups && <button type="button" className="secondary-button" onClick={onManageGroups}><Users aria-hidden="true" size={17} /> Groups and members</button>}
          {onCreateMeeting && <button type="button" className="upload-button" onClick={onCreateMeeting}><CalendarPlus aria-hidden="true" size={17} /> {view === 'upcoming' ? 'New meeting' : 'Add past meeting'}</button>}
        </div>}
      </header>

      {!meetings.length && <p className="empty-state">{emptyMessage}</p>}

      {meetings.map((meeting, index) => {
        const meetingHeadingId = `${headingId}-${meeting.id}`
        return (
          <article className="meeting-entry" key={meeting.id} aria-labelledby={meetingHeadingId}>
            <header className="meeting-entry-header">
              <div>
                <p className="meeting-sequence">{view === 'upcoming' && index === 0 ? 'Next meeting' : view === 'archive' ? 'Past meeting' : 'Upcoming meeting'}</p>
                <h2 id={meetingHeadingId}>{meeting.title}</h2>
              </div>
              <dl className="online-meeting-facts">
                <div><dt><CalendarDays aria-hidden="true" size={16} /> Date</dt><dd>{meeting.date ?? 'Pending'}</dd></div>
                <div><dt><Clock3 aria-hidden="true" size={16} /> Time</dt><dd>{meetingTime(meeting)}</dd></div>
              </dl>
              <div className="meeting-entry-actions">
              {isAdmin && view === 'upcoming' && onEditMeeting && <button type="button" className="secondary-button" onClick={() => onEditMeeting(meeting)}><Pencil aria-hidden="true" size={16} /> Edit meeting</button>}
              {view === 'upcoming' && profile && meeting.zoomUrl && (
                <a className="zoom-link" href={meeting.zoomUrl} target="_blank" rel="noreferrer">
                  <Video aria-hidden="true" size={17} /> Open Zoom meeting
                </a>
              )}
              </div>
            </header>

            <Agenda
              meeting={meeting}
              profile={profile}
              canUpload={(slot) => canManageSlot(profile, slot)}
              onUpload={onUploadSlides ? (slot, displayName, file) => onUploadSlides(meeting, slot, displayName, file) : undefined}
              onDownload={profile && onDownloadSlides ? (file) => onDownloadSlides(meeting, file) : undefined}
              onRemove={profile && onRemoveSlides ? (file) => onRemoveSlides(meeting, file) : undefined}
              onDownloadArchiveFile={profile && onDownloadArchiveFile ? (file) => onDownloadArchiveFile(meeting, file) : undefined}
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
