import { Check, Clock3, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { AgendaSlot, Meeting } from '../data/meeting'
import { validateSlidesFile } from '../uploadValidation'

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

function SlideUploadControl({ slot }: { slot: AgendaSlot }) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFile(file?: File) {
    if (!file) return
    const validationError = validateSlidesFile(file)
    setError(validationError)
    setSelection(validationError ? null : file.name)
  }

  return (
    <div className="upload-control">
      <input
        ref={inputRef}
        id={inputId}
        hidden
        type="file"
        accept=".pdf,.ppt,.pptx"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
      <button
        className="upload-button"
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`Upload slides for ${slot.groupName}`}
      >
        <Upload aria-hidden="true" size={17} />
        Upload slides
      </button>
      {selection && (
        <p className="file-feedback selected" title={selection}>
          <Check aria-hidden="true" size={14} /> Selected locally: {selection}
        </p>
      )}
      {error && <p className="file-feedback error" role="alert">{error}</p>}
    </div>
  )
}

interface AgendaProps {
  meeting: Meeting
}

export function Agenda({ meeting }: AgendaProps) {
  return (
    <section className="agenda-section" aria-labelledby="agenda-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Presentation order</p>
          <h2 id="agenda-heading">Meeting agenda</h2>
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
              <p>{meeting.presentationMinutes} min presentation · {meeting.qaMinutes} min Q&amp;A</p>
            </div>
            <div className="agenda-status">
              <span className={`status ${slot.slideStatus}`}>
                <span aria-hidden="true" />
                {slot.slideStatus === 'uploaded' ? 'Slides ready' : 'Awaiting slides'}
              </span>
            </div>
            <SlideUploadControl slot={slot} />
          </li>
        ))}
      </ol>
    </section>
  )
}
