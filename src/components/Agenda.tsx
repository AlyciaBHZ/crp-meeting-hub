import { Check, Clock3, Download, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { AgendaSlot, Meeting } from '../data/meeting'
import { validateSlidesFile } from '../uploadValidation'

function formatTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'PM' : 'AM'
  const displayHours = hours % 12 || 12
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`
}

interface SlideUploadControlProps {
  slot: AgendaSlot
  enabled: boolean
  cloudMode: boolean
  onUpload?: (slot: AgendaSlot, file: File) => Promise<void>
  onDownload?: (slot: AgendaSlot) => Promise<void>
}

function SlideUploadControl({ slot, enabled, cloudMode, onUpload, onDownload }: SlideUploadControlProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [selection, setSelection] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [pending, setPending] = useState(false)

  async function handleFile(file?: File) {
    if (!file) return
    const validationError = validateSlidesFile(file)
    setError(validationError)
    setSelection(validationError ? null : file.name)
    if (!validationError && onUpload) {
      setPending(true)
      try {
        await onUpload(slot, file)
        setSelection(`Uploaded: ${file.name}`)
      } catch (uploadError) {
        setSelection(null)
        setError(uploadError instanceof Error ? uploadError.message : 'Upload failed.')
      } finally {
        setPending(false)
      }
    }
  }

  return (
    <div className="upload-control">
      <input
        ref={inputRef}
        id={inputId}
        hidden
        type="file"
        accept=".pdf,.ppt,.pptx"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />
      {slot.slideObjectPath && onDownload && (
        <button className="download-button" type="button" onClick={() => void onDownload(slot)} aria-label={`Download slides for ${slot.groupName}`}>
          <Download aria-hidden="true" size={17} /> Download
        </button>
      )}
      <button
        className="upload-button"
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={`Upload slides for ${slot.groupName}`}
        disabled={!enabled || pending}
        title={!enabled && cloudMode ? 'Sign in with an assigned member account to upload.' : undefined}
      >
        <Upload aria-hidden="true" size={17} />
        {pending ? 'Uploading...' : slot.slideStatus === 'uploaded' ? 'Replace slides' : 'Upload slides'}
      </button>
      {selection && (
        <p className="file-feedback selected" title={selection}>
          <Check aria-hidden="true" size={14} /> {cloudMode ? selection : `Selected locally: ${selection}`}
        </p>
      )}
      {error && <p className="file-feedback error" role="alert">{error}</p>}
    </div>
  )
}

interface AgendaProps {
  meeting: Meeting
  cloudMode?: boolean
  canUpload?: (slot: AgendaSlot) => boolean
  onUpload?: (slot: AgendaSlot, file: File) => Promise<void>
  onDownload?: (slot: AgendaSlot) => Promise<void>
}

export function Agenda({ meeting, cloudMode = false, canUpload = () => true, onUpload, onDownload }: AgendaProps) {
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
              {slot.slideFileName && <p className="slide-file-name">{slot.slideFileName}</p>}
              <p>{meeting.presentationMinutes} min presentation / {meeting.qaMinutes} min Q&amp;A</p>
            </div>
            <div className="agenda-status">
              <span className={`status ${slot.slideStatus}`}>
                <span aria-hidden="true" />
                {slot.slideStatus === 'uploaded' ? 'Slides ready' : 'Awaiting slides'}
              </span>
            </div>
            <SlideUploadControl
              slot={slot}
              enabled={canUpload(slot)}
              cloudMode={cloudMode}
              onUpload={onUpload}
              onDownload={onDownload}
            />
          </li>
        ))}
      </ol>
    </section>
  )
}
