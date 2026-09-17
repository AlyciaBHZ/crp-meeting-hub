import { CalendarDays, CalendarPlus, ChevronDown, ChevronUp, Clock3, Pencil, Users, Video } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import type { AgendaSlot, ArchiveLabFile, Meeting, SlideFile } from '../data/meeting'
import { canManageSlot, type MemberProfile } from '../services/meetingAccess'
import type { MeetingView } from '../services/meetingLifecycle'
import { Agenda } from './Agenda'
import { Resources } from './Resources'
import { ShareLink } from './ShareLink'
import { meetingGroupAnchor, type MeetingTarget } from '../services/meetingLinks'
import type { DiscussionRepository } from '../services/discussionRepository'
import type { PdfResource } from '../data/discussion'

interface MeetingCollectionProps {
  view: MeetingView
  meetings: Meeting[]
  profile: MemberProfile | null
  target?: MeetingTarget | null
  discussionRepository?: DiscussionRepository
  onPreview?: (resource: PdfResource) => void
  onUploadSlides?: (meeting: Meeting, slot: AgendaSlot, displayName: string, file: File) => Promise<void>
  onDownloadSlides?: (meeting: Meeting, file: SlideFile) => Promise<void>
  onRemoveSlides?: (meeting: Meeting, file: SlideFile) => Promise<void>
  onUploadMinutes?: (meeting: Meeting, file: File) => Promise<void>
  onDownloadMinutes?: (meeting: Meeting) => Promise<void>
  onDownloadArchiveFile?: (meeting: Meeting, file: ArchiveLabFile) => Promise<void>
  onRemoveArchiveFile?: (meeting: Meeting, file: ArchiveLabFile) => Promise<void>
  onRemoveMinutes?: (meeting: Meeting) => Promise<void>
  onCreateMeeting?: () => void
  onEditMeeting?: (meeting: Meeting) => void
  onManageGroups?: () => void
}

function firstTime(meeting: Meeting) {
  return meeting.slots.map((slot) => slot.startsAt).sort()[0] ?? ''
}

function meetingTime(meeting: Meeting) {
  if (!meeting.slots.length) return 'Schedule pending'
  return firstTime(meeting) + ' - ' + meeting.slots.map((slot) => slot.endsAt).sort().at(-1)
}

interface MeetingCardProps extends Omit<MeetingCollectionProps, 'meetings'> {
  meeting: Meeting
  index: number
}

function MeetingCard({
  meeting, index, view, profile, onEditMeeting, onUploadSlides, onDownloadSlides,
  onRemoveSlides, onUploadMinutes, onDownloadMinutes, onDownloadArchiveFile,
  target, discussionRepository, onPreview,
  onRemoveArchiveFile, onRemoveMinutes,
}: MeetingCardProps) {
  const headingId = useId()
  const detailsId = useId()
  const dateId = useId()
  const [expanded, setExpanded] = useState(index === 0)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const headerRef = useRef<HTMLElement>(null)
  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (target?.meetingId !== meeting.id) return
    setExpanded(true)
    const timer = window.setTimeout(() => {
      const element = target.groupId ? document.getElementById(meetingGroupAnchor(meeting.id, target.groupId)) : headerRef.current
      const destination = element ?? headerRef.current
      destination?.scrollIntoView?.({ block: 'start' })
      destination?.focus({ preventScroll: true })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [target, meeting.id])

  function collapseFromBottom() {
    setExpanded(false)
    toggleRef.current?.focus({ preventScroll: true })
    headerRef.current?.scrollIntoView?.({
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }

  return (
    <article className={'meeting-entry' + (expanded ? '' : ' meeting-entry-collapsed')} aria-labelledby={headingId + ' ' + dateId}>
      <header className="meeting-entry-header" ref={headerRef} tabIndex={-1}>
        <div>
          <p className="meeting-sequence">{view === 'upcoming' && index === 0 ? 'Next meeting' : view === 'archive' ? 'Past meeting' : 'Upcoming meeting'}</p>
          <h2 id={headingId}>{meeting.title}</h2>
        </div>
        <dl className="online-meeting-facts">
          <div><dt><CalendarDays aria-hidden="true" size={16} /> Date</dt><dd id={dateId}>{meeting.date ?? 'Pending'}</dd></div>
          <div><dt><Clock3 aria-hidden="true" size={16} /> Time</dt><dd>{meetingTime(meeting)}</dd></div>
        </dl>
        <div className="meeting-entry-actions">
          <ShareLink meetingId={meeting.id} />
          {isAdmin && view === 'upcoming' && onEditMeeting && <button type="button" className="secondary-button" onClick={() => onEditMeeting(meeting)}><Pencil aria-hidden="true" size={16} /> Edit meeting</button>}
          {view === 'upcoming' && profile && meeting.zoomUrl && (
            <a className="zoom-link" href={meeting.zoomUrl} target="_blank" rel="noreferrer">
              <Video aria-hidden="true" size={17} /> Open Zoom meeting
            </a>
          )}
          <button ref={toggleRef} className="meeting-toggle" type="button" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
            {expanded ? 'Collapse meeting' : 'Expand meeting'}
          </button>
        </div>
      </header>

      <Resources
        meeting={meeting}
        compact
        isPast={view === 'archive'}
        isAdmin={isAdmin}
        onUpload={isAdmin && onUploadMinutes ? (file) => onUploadMinutes(meeting, file) : undefined}
        onRemove={isAdmin && onRemoveMinutes ? () => onRemoveMinutes(meeting) : undefined}
        onDownload={profile && meeting.minutesObjectPath && onDownloadMinutes ? () => onDownloadMinutes(meeting) : undefined}
        onPreview={profile && onPreview && meeting.minutesObjectPath && meeting.minutesFileName?.toLowerCase().endsWith('.pdf') ? () => onPreview({ bucket: 'minutes', path: meeting.minutesObjectPath!, name: meeting.minutesFileName! }) : undefined}
      />

      <div id={detailsId} className="meeting-details" hidden={!expanded}>
        <Agenda
          meeting={meeting}
          profile={profile}
          discussionRepository={discussionRepository}
          onPreview={onPreview}
          canUpload={(slot) => canManageSlot(profile, slot)}
          onUpload={onUploadSlides ? (slot, displayName, file) => onUploadSlides(meeting, slot, displayName, file) : undefined}
          onDownload={profile && onDownloadSlides ? (file) => onDownloadSlides(meeting, file) : undefined}
          onRemove={profile && onRemoveSlides ? (file) => onRemoveSlides(meeting, file) : undefined}
          onDownloadArchiveFile={profile && onDownloadArchiveFile ? (file) => onDownloadArchiveFile(meeting, file) : undefined}
          onRemoveArchiveFile={isAdmin && onRemoveArchiveFile ? (file) => onRemoveArchiveFile(meeting, file) : undefined}
        />
        <div className="meeting-collapse-footer">
          <button type="button" className="secondary-button" aria-expanded={expanded} aria-controls={detailsId} onClick={collapseFromBottom}>
            <ChevronUp aria-hidden="true" size={18} /> Collapse and back to meeting
          </button>
        </div>
      </div>
    </article>
  )
}

export function MeetingCollection(props: MeetingCollectionProps) {
  const { view, meetings, profile, onCreateMeeting, onManageGroups } = props
  const headingId = useId()
  const isAdmin = profile?.role === 'admin'
  const title = view === 'upcoming' ? 'Upcoming meetings' : 'Past meetings'
  const emptyMessage = view === 'upcoming' ? 'No online meeting is scheduled yet.' : 'No past meetings are available.'
  const sortedMeetings = [...meetings].sort((a, b) => {
    if (!a.dateISO || !b.dateISO) return a.dateISO ? -1 : b.dateISO ? 1 : 0
    const order = a.dateISO.localeCompare(b.dateISO) || firstTime(a).localeCompare(firstTime(b))
    return view === 'archive' ? -order : order
  })

  return (
    <section className="meeting-collection" aria-labelledby={headingId}>
      <header className="collection-heading">
        <div>
          <p className="eyebrow">CRP online meetings</p>
          <h1 id={headingId}>{title}</h1>
          {view === 'archive' && meetings.length > 0 && <p className="collection-description">Newest first. Expand a meeting for its agenda and group PDFs.</p>}
        </div>
        {isAdmin && <div className="collection-actions">
          {onManageGroups && <button type="button" className="secondary-button" onClick={onManageGroups}><Users aria-hidden="true" size={17} /> Groups and members</button>}
          {onCreateMeeting && <button type="button" className="upload-button" onClick={onCreateMeeting}><CalendarPlus aria-hidden="true" size={17} /> {view === 'upcoming' ? 'New meeting' : 'Add past meeting'}</button>}
        </div>}
      </header>
      {!meetings.length && <p className="empty-state">{emptyMessage}</p>}
      {sortedMeetings.map((meeting, index) => (
        <MeetingCard {...props} key={view + '-' + meeting.id} meeting={meeting} index={index} />
      ))}
    </section>
  )
}
