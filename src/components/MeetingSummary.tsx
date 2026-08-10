import { CalendarDays, Clock3, MapPin } from 'lucide-react'
import type { Meeting } from '../data/meeting'

interface MeetingSummaryProps {
  meeting: Meeting
}

export function MeetingSummary({ meeting }: MeetingSummaryProps) {
  return (
    <section className="meeting-summary" aria-labelledby="meeting-title">
      <div className="summary-copy">
        <p className="eyebrow">Upcoming meeting</p>
        <h1 id="meeting-title">{meeting.title}</h1>
        <p className="summary-note">
          Each group presents its latest progress, followed by a focused discussion.
        </p>
      </div>

      <dl className="meeting-facts">
        <div>
          <dt><CalendarDays aria-hidden="true" size={18} /> Date</dt>
          <dd>{meeting.date ?? 'To be confirmed'}</dd>
        </div>
        <div>
          <dt><Clock3 aria-hidden="true" size={18} /> Time</dt>
          <dd>9:00 AM - 11:00 AM</dd>
        </div>
        <div>
          <dt><MapPin aria-hidden="true" size={18} /> Venue</dt>
          <dd>{meeting.venue ?? 'To be confirmed'}</dd>
        </div>
      </dl>

      <div className="format-strip" aria-label="Presentation format">
        <span>{meeting.presentationMinutes} min presentation</span>
        <span className="format-divider" aria-hidden="true" />
        <span>{meeting.qaMinutes} min Q&amp;A</span>
      </div>
    </section>
  )
}
