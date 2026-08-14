import { Clock3 } from 'lucide-react'
import { useId } from 'react'
import type { AgendaSlot, Meeting, SlideFile } from '../data/meeting'
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
}

export function Agenda({ meeting, profile, canUpload = () => true, onUpload, onDownload, onRemove }: AgendaProps) {
  const headingId = useId()
  return (
    <section className="agenda-section" aria-labelledby={headingId}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">Presentation order</p>
          <h2 id={headingId}>Meeting agenda</h2>
        </div>
        <p className="timezone"><Clock3 aria-hidden="true" size={16} /> Singapore time</p>
      </div>

      <ol className="agenda-list">
        {meeting.slots.map((slot, index) => (
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
            <div className="agenda-status">
              <span className={`status ${slot.slideStatus}`}>
                <span aria-hidden="true" />
                {slot.slideStatus === 'uploaded' ? 'Slides ready' : 'Awaiting slides'}
              </span>
            </div>
            <SlideFilesControl
              slot={slot}
              profile={profile}
              enabled={canUpload(slot) && Boolean(onUpload)}
              onUpload={onUpload}
              onDownload={onDownload}
              onRemove={onRemove}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}
