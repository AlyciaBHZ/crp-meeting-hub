import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { type FormEvent, useId, useRef, useState } from 'react'
import type { AgendaSlot, SlideFile } from '../data/meeting'
import type { MemberProfile } from '../services/meetingAccess'
import { MAX_SLIDE_FILES_PER_LAB, validateSlidePdf } from '../uploadValidation'

interface SlideFilesControlProps {
  slot: AgendaSlot
  profile: MemberProfile | null
  enabled: boolean
  onUpload?: (slot: AgendaSlot, displayName: string, file: File) => Promise<void>
  onDownload?: (file: SlideFile) => Promise<void>
  onRemove?: (file: SlideFile) => Promise<void>
}

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function SlideFilesControl({ slot, profile, enabled, onUpload, onDownload, onRemove }: SlideFilesControlProps) {
  const nameId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const files = slot.slideFiles ?? []
  const isFull = files.length >= MAX_SLIDE_FILES_PER_LAB

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!selectedFile) {
      setIsError(true)
      setMessage('Please choose a PDF file.')
      return
    }
    const validationError = validateSlidePdf(displayName, selectedFile, files.length)
    if (validationError) {
      setIsError(true)
      setMessage(validationError)
      return
    }
    if (!onUpload) return
    setPending(true)
    setIsError(false)
    setMessage(null)
    try {
      await onUpload(slot, displayName.trim(), selectedFile)
      setDisplayName('')
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setMessage('PDF uploaded.')
    } catch (error) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setPending(false)
    }
  }

  async function remove(file: SlideFile) {
    if (!onRemove || !window.confirm(`Remove ${file.displayName}?`)) return
    setPending(true)
    setIsError(false)
    setMessage(null)
    try {
      await onRemove(file)
      setMessage('PDF removed.')
    } catch (error) {
      setIsError(true)
      setMessage(error instanceof Error ? error.message : 'Remove failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="slide-files-control" aria-label={`Slides for ${slot.groupName}`}>
      <header className="slide-files-header">
        <strong>Slides</strong>
        <span>{files.length} / {MAX_SLIDE_FILES_PER_LAB} PDFs</span>
      </header>

      {files.length > 0 && (
        <ul className="slide-files-list">
          {files.map((file) => {
            const canRemove = Boolean(onRemove && profile && (profile.role === 'admin' || file.uploadedBy === profile.id))
            return (
              <li key={file.id}>
                <FileText aria-hidden="true" size={17} />
                <span><strong>{file.displayName}</strong><small>{file.originalName} - {formatBytes(file.sizeBytes)}</small></span>
                {onDownload && <button className="icon-button" type="button" title="Download PDF" aria-label={`Download ${file.displayName}`} onClick={() => void onDownload(file)}><Download aria-hidden="true" size={16} /></button>}
                {canRemove && <button className="icon-button danger" type="button" title="Remove PDF" aria-label={`Remove ${file.displayName}`} disabled={pending} onClick={() => void remove(file)}><Trash2 aria-hidden="true" size={16} /></button>}
              </li>
            )
          })}
        </ul>
      )}

      {enabled && (
        <form className="slide-upload-form" onSubmit={(event) => void submit(event)}>
          <label htmlFor={nameId}>Presenter / document name</label>
          <input id={nameId} value={displayName} maxLength={160} onChange={(event) => { setDisplayName(event.target.value); setMessage(null) }} placeholder="e.g. Yang Li - project update" />
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept=".pdf,application/pdf"
            aria-label={`PDF file for ${slot.groupName}`}
            onChange={(event) => { setSelectedFile(event.target.files?.[0] ?? null); setMessage(null) }}
          />
          <button className="secondary-button" type="button" disabled={pending || isFull} onClick={() => fileInputRef.current?.click()}>
            <FileText aria-hidden="true" size={16} /> Choose PDF
          </button>
          <span className="slide-selected-file" title={selectedFile?.name}>{selectedFile?.name ?? 'No PDF selected'}</span>
          <button className="upload-button" type="submit" disabled={pending || isFull || !onUpload}>
            <Upload aria-hidden="true" size={16} /> {pending ? 'Uploading...' : 'Upload PDF'}
          </button>
        </form>
      )}

      {message && <p className={`slide-upload-message ${isError ? 'error' : ''}`} role={isError ? 'alert' : 'status'}>{message}</p>}
    </section>
  )
}
