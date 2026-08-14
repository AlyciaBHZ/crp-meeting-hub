import { Download, FileArchive, FileText, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { ArchiveLabFile, Meeting } from '../data/meeting'
import type { MemberProfile } from '../services/meetingAccess'
import { MAX_ARCHIVE_FILES_PER_LAB, validateArchivePdfBatch } from '../uploadValidation'

interface ArchiveLabFilesProps {
  meeting: Meeting
  profile: MemberProfile
  onUpload?: (groupId: string, files: File[]) => Promise<void>
  onDownload?: (file: ArchiveLabFile) => Promise<void>
}

function formatBytes(size: number) {
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function ArchiveLabFiles({ meeting, profile, onUpload, onDownload }: ArchiveLabFilesProps) {
  const groups = useMemo(() => meeting.slots.flatMap((slot) => slot.groupId ? [{
    id: slot.groupId,
    name: slot.groupName,
    memberIds: slot.groupMemberIds ?? [],
  }] : []).filter((group, index, all) => all.findIndex((candidate) => candidate.id === group.id) === index), [meeting.slots])
  const uploadGroups = groups.filter((group) => profile.role === 'admin' || group.memberIds.includes(profile.id))
  const [selectedGroupId, setSelectedGroupId] = useState(uploadGroups[0]?.id ?? '')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedCount = meeting.archiveFiles?.filter((file) => file.groupId === selectedGroupId).length ?? 0

  async function handleFiles(list: FileList | null) {
    const files = Array.from(list ?? [])
    if (!selectedGroupId || !onUpload) return
    const validationError = validateArchivePdfBatch(files, selectedCount)
    if (validationError) {
      setMessage(validationError)
      return
    }
    setPending(true)
    setMessage(null)
    try {
      await onUpload(selectedGroupId, files)
      setMessage(`${files.length} PDF${files.length === 1 ? '' : 's'} uploaded.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload failed.')
    } finally {
      setPending(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <section className="archive-files-section" aria-labelledby={`archive-files-${meeting.id}`}>
      <div className="section-heading archive-files-heading">
        <div>
          <p className="eyebrow">Meeting materials</p>
          <h2 id={`archive-files-${meeting.id}`}>Lab PDF archive</h2>
        </div>
        <FileArchive aria-hidden="true" size={21} />
      </div>

      {uploadGroups.length > 0 && (
        <div className="archive-upload-bar">
          <label htmlFor={`archive-group-${meeting.id}`}>Upload for Lab</label>
          <select id={`archive-group-${meeting.id}`} value={selectedGroupId} onChange={(event) => { setSelectedGroupId(event.target.value); setMessage(null) }}>
            {uploadGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
          </select>
          <span className="archive-limit">{selectedCount} / {MAX_ARCHIVE_FILES_PER_LAB} PDFs</span>
          <input ref={inputRef} hidden multiple type="file" accept=".pdf,application/pdf" onChange={(event) => void handleFiles(event.target.files)} />
          <button className="upload-button" type="button" disabled={!onUpload || pending || selectedCount >= MAX_ARCHIVE_FILES_PER_LAB} onClick={() => inputRef.current?.click()}>
            <Upload aria-hidden="true" size={17} /> {pending ? 'Uploading...' : 'Upload PDFs'}
          </button>
          {message && <p className="archive-upload-message" role="status">{message}</p>}
        </div>
      )}

      <div className="archive-lab-list">
        {groups.map((group) => {
          const files = meeting.archiveFiles?.filter((file) => file.groupId === group.id) ?? []
          return (
            <section className="archive-lab-row" key={group.id} aria-label={`${group.name} PDFs`}>
              <header>
                <div><h3>{group.name}</h3><p>{files.length} / {MAX_ARCHIVE_FILES_PER_LAB} PDFs</p></div>
              </header>
              {files.length === 0 ? <p className="archive-empty">No PDFs uploaded.</p> : (
                <ul>
                  {files.map((file) => (
                    <li key={file.id}>
                      <FileText aria-hidden="true" size={18} />
                      <span><strong>{file.originalName}</strong><small>{formatBytes(file.sizeBytes)}</small></span>
                      {onDownload && <button className="icon-button" type="button" title="Download PDF" aria-label={`Download ${file.originalName}`} onClick={() => void onDownload(file)}><Download aria-hidden="true" size={16} /></button>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
    </section>
  )
}
