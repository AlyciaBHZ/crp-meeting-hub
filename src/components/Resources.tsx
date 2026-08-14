import { Download, FileText, LockKeyhole, Upload } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import type { Meeting } from '../data/meeting'
import { validateMinutesFile } from '../uploadValidation'

interface ResourcesProps {
  meeting?: Meeting
  isAdmin?: boolean
  onUpload?: (file: File) => Promise<void>
  onDownload?: () => Promise<void>
}

export function Resources({ meeting, isAdmin = false, onUpload, onDownload }: ResourcesProps) {
  const headingId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
    }
  }

  return (
    <section className="resources-section" aria-labelledby={headingId}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">After the meeting</p>
          <h2 id={headingId}>Meeting records</h2>
        </div>
      </div>

      <div className="minutes-row">
        <div className="resource-icon"><FileText aria-hidden="true" size={22} /></div>
        <div className="resource-copy">
          <h3>Meeting minutes</h3>
          <p>{meeting?.minutesFileName ?? 'Available after the meeting'}</p>
          {message && <p className="resource-message" role="status">{message}</p>}
        </div>
        <span className="admin-note"><LockKeyhole aria-hidden="true" size={15} /> Admin only</span>
        <div className="resource-actions">
          {meeting?.minutesObjectPath && onDownload && (
            <button className="secondary-button" type="button" onClick={() => void onDownload()}>
              <Download aria-hidden="true" size={17} /> Download
            </button>
          )}
          <input ref={inputRef} hidden type="file" accept=".pdf,.docx,.md" onChange={(event) => void handleFile(event.target.files?.[0])} />
          <button className="secondary-button" type="button" disabled={!isAdmin || !onUpload || pending} onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" size={17} /> {pending ? 'Uploading...' : 'Upload minutes'}
          </button>
        </div>
      </div>
    </section>
  )
}
