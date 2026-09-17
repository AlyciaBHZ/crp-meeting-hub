import { Download, FileText, LockKeyhole, Trash2, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { Meeting } from '../data/meeting'
import { validateMinutesFile } from '../uploadValidation'

interface ResourcesProps {
  meeting?: Meeting
  isAdmin?: boolean
  compact?: boolean
  isPast?: boolean
  onUpload?: (file: File) => Promise<void>
  onDownload?: () => Promise<void>
  onPreview?: () => void
  onRemove?: () => Promise<void>
}

export function Resources({ meeting, isAdmin = false, compact = false, isPast = false, onUpload, onDownload, onPreview, onRemove }: ResourcesProps) {
  const headingId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  async function remove() {
    if (!isAdmin || !onRemove || !window.confirm(`Delete ${meeting?.minutesFileName ?? 'meeting minutes'} for ${meeting?.date ?? 'this meeting'}? This permanently deletes the file and cannot be undone.`)) return
    setRemoving(true)
    setMessage(null)
    try {
      await onRemove()
      setMessage('Minutes deleted.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Delete failed. Please try again.')
    } finally { setRemoving(false) }
  }

  async function handleFile(file?: File) {
    if (!file || !onUpload) return
    const validationError = validateMinutesFile(file)
    if (validationError) {
      setMessage(validationError)
      return
    }
    setPending(true)
    setMessage(null)
    try {
      await onUpload(file)
      setMessage(`Uploaded: ${file.name}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className={'resources-section' + (compact ? ' compact-minutes' : '')} aria-labelledby={headingId}>
      {!compact && <div className="section-heading">
        <div>
          <p className="eyebrow">After the meeting</p>
          <h2>Meeting records</h2>
        </div>
      </div>}

      <div className="minutes-row">
        <div className="resource-icon"><FileText aria-hidden="true" size={22} /></div>
        <div className="resource-copy">
          <h3 id={headingId}>Meeting minutes</h3>
          <p>{meeting?.minutesFileName ?? (isPast ? 'Not uploaded yet' : 'Available after the meeting')}</p>
          {message && <p className="resource-message" role="status">{message}</p>}
        </div>
        <span className="admin-note"><LockKeyhole aria-hidden="true" size={15} /> Uploaded by admin</span>
        <div className="resource-actions">
          {onPreview && <button className="secondary-button" type="button" onClick={onPreview}>Preview minutes</button>}
          {meeting?.minutesObjectPath && onDownload && (
            <button className="secondary-button" type="button" onClick={() => void onDownload().catch(() => setMessage('Download failed. Please try again.'))}>
              <Download aria-hidden="true" size={17} /> Download
            </button>
          )}
          <input ref={inputRef} aria-label="Meeting minutes file" hidden type="file" accept=".pdf,.docx,.md" onChange={(event) => void handleFile(event.target.files?.[0])} />
          {isAdmin && <button className="secondary-button" type="button" disabled={!onUpload || pending || removing} onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" size={17} /> {pending ? 'Uploading...' : meeting?.minutesObjectPath ? 'Replace minutes' : 'Upload minutes'}
          </button>}
          {isAdmin && meeting?.minutesObjectPath && onRemove && <button className="secondary-button danger" type="button" disabled={pending || removing} onClick={() => void remove()}><Trash2 aria-hidden="true" size={17} /> {removing ? 'Deleting minutes...' : 'Delete minutes'}</button>}
        </div>
      </div>
    </section>
  )
}
