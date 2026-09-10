import { Clock3 } from 'lucide-react'
import { useId } from 'react'
import type { AgendaSlot, ArchiveLabFile, Meeting, SlideFile } from '../data/meeting'
import type { MemberProfile } from '../services/meetingAccess'
import { SlideFilesControl } from './SlideFilesControl'

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

interface AgendaProps {
  meeting: Meeting
  profile: MemberProfile | null
  canUpload?: (slot: AgendaSlot) => boolean
  onUpload?: (slot: AgendaSlot, displayName: string, file: File) => Promise<void>
  onDownload?: (file: SlideFile) => Promise<void>
  onRemove?: (file: SlideFile) => Promise<void>
  onDownloadArchiveFile?: (file: ArchiveLabFile) => Promise<void>
}

export function Agenda({ meeting, profile, canUpload = () => true, onUpload, onDownload, onRemove, onDownloadArchiveFile }: AgendaProps) {
  const headingId = useId()
  return (
    <section className="agenda-section" aria-labelledby={headingId}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Presentation order</p>
          <h2 id={headingId}>Agenda &amp; group PDFs</h2>
        </div>
        <p className="timezone"><Clock3 aria-hidden="true" size={16} /> Singapore time</p>
      </div>

      <ol className="agenda-list">
        {meeting.slots.map((slot, index) => {
          const archiveFiles = profile ? meeting.archiveFiles?.filter((file) => file.groupId === slot.groupId) ?? [] : []
          const count = (profile ? slot.slideFiles?.length ?? 0 : 0) + archiveFiles.length
          return (
          <li className="agenda-row" key={slot.id}>
            <div className="agenda-index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</div>
            <time className="agenda-time" dateTime={slot.startsAt}>
              <strong>{formatTime(slot.startsAt)}</strong>
              <span>{formatTime(slot.endsAt)}</span>
            </time>
            <div className="agenda-group">
              <h3>{slot.groupName}</h3>
              <p>{meeting.presentationMinutes} min presentation / {meeting.qaMinutes} min Q&amp;A</p>
            </div>
            {profile && <div className="agenda-status">
              <span className={`status ${count ? 'uploaded' : 'awaiting'}`}>
                <span aria-hidden="true" />
                {count ? 'PDFs available' : 'No PDFs yet'}
              </span>
            </div>}
            <SlideFilesControl
              slot={slot}
              profile={profile}
              enabled={canUpload(slot) && Boolean(onUpload)}
              onUpload={onUpload}
              onDownload={onDownload}
              onRemove={onRemove}
              archiveFiles={archiveFiles}
              onDownloadArchiveFile={onDownloadArchiveFile}
            />
          </li>
        )})}
      </ol>
    </section>
  )
}
