import { MessageSquare, RefreshCw } from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react'
import type { AgendaSlot, ArchiveLabFile } from '../data/meeting'
import { questionStatuses, type DiscussionQuestion, type PdfResource, type QuestionStatus, type ReplyDraft } from '../data/discussion'
import type { DiscussionRepository } from '../services/discussionRepository'
import { canManageSlot, type MemberProfile } from '../services/meetingAccess'

function authorValid(draft: ReplyDraft) {
  return draft.authorName.trim() && draft.authorGroup.trim() && draft.body.trim()
}

function AuthorFields({ name, group, onName, onGroup }: { name: string; group: string; onName: (value: string) => void; onGroup: (value: string) => void }) {
  const id = useId()
  return <div className="discussion-author-fields">
    <label htmlFor={id + '-name'}>Your name<input id={id + '-name'} value={name} onChange={(event) => onName(event.target.value)} required maxLength={100} autoComplete="name" /></label>
    <label htmlFor={id + '-group'}>Your group<input id={id + '-group'} value={group} onChange={(event) => onGroup(event.target.value)} required maxLength={160} /></label>
  </div>
}

function ReplyForm({ onReply }: { onReply: (draft: ReplyDraft) => Promise<void> }) {
  const id = useId()
  const [authorName, setName] = useState('')
  const [authorGroup, setGroup] = useState('')
  const [body, setBody] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    const draft = { authorName, authorGroup, body }
    if (!authorValid(draft)) { setMessage('Enter your name, group and reply.'); return }
    setPending(true)
    setMessage('')
    try { await onReply(draft); setBody(''); setMessage('Reply posted.') }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to post reply.') }
    finally { setPending(false) }
  }
  return <form className="discussion-form" onSubmit={(event) => void submit(event)}>
    <AuthorFields name={authorName} group={authorGroup} onName={setName} onGroup={setGroup} />
    <label htmlFor={id}>Your reply</label>
    <textarea id={id} value={body} required maxLength={4000} rows={3} onChange={(event) => setBody(event.target.value)} />
    <button className="upload-button" disabled={pending} type="submit">{pending ? 'Posting...' : 'Post reply'}</button>
    {message && <p role="status">{message}</p>}
  </form>
}

export function Discussion({ slot, archiveFiles = [], profile, repository, onPreview }: {
  slot: AgendaSlot
  archiveFiles?: ArchiveLabFile[]
  profile: MemberProfile
  repository: DiscussionRepository
  onPreview?: (resource: PdfResource) => void
}) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [questions, setQuestions] = useState<DiscussionQuestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [authorName, setName] = useState('')
  const [authorGroup, setGroup] = useState('')
  const [body, setBody] = useState('')
  const [fileKey, setFileKey] = useState('')
  const [pageNumber, setPageNumber] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')
  const [activeReply, setActiveReply] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState<string | null>(null)
  const generation = useRef(0)
  const files = [
    ...(slot.slideFiles ?? []).map((file) => ({ key: 'slides:' + file.id, id: file.id, bucket: 'slides' as const, name: file.originalName, path: file.objectPath })),
    ...archiveFiles.map((file) => ({ key: 'archive-lab-files:' + file.id, id: file.id, bucket: 'archive-lab-files' as const, name: file.originalName, path: file.objectPath })),
  ]

  const refresh = useCallback(async () => {
    const request = ++generation.current
    setLoading(true)
    setLoadError('')
    try {
      const next = await repository.list(slot.id)
      if (request === generation.current) { setQuestions(next); setLoaded(true) }
    } catch (error) {
      if (request === generation.current) setLoadError(error instanceof Error ? error.message : 'Unable to load discussion.')
    } finally {
      if (request === generation.current) setLoading(false)
    }
  }, [repository, slot.id])

  useEffect(() => {
    if (!open) return
    void refresh()
    const focus = () => { if (document.visibilityState === 'visible') void refresh() }
    window.addEventListener('focus', focus)
    return () => { ++generation.current; window.removeEventListener('focus', focus) }
  }, [open, refresh])

  async function ask(event: FormEvent) {
    event.preventDefault()
    if (!authorValid({ authorName, authorGroup, body })) { setMessage('Enter your name, group and question.'); return }
    const file = files.find((item) => item.key === fileKey)
    if (fileKey && !file) { setMessage('That PDF is no longer available. Choose another file.'); return }
    setPending(true)
    setMessage('')
    try {
      await repository.ask(slot.id, { authorName, authorGroup, body, fileSource: file?.bucket, fileId: file?.id, pageNumber: file && pageNumber ? Number(pageNumber) : undefined })
      setBody(''); setFileKey(''); setPageNumber(''); setMessage('Question posted.')
      await refresh()
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to post question.') }
    finally { setPending(false) }
  }

  async function updateStatus(questionId: string, status: QuestionStatus) {
    setStatusPending(questionId)
    setMessage('')
    try { await repository.setStatus(questionId, status); await refresh() }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update status.') }
    finally { setStatusPending(null) }
  }

  return <section className="discussion" aria-label={'Discussion for ' + slot.groupName}>
    <button type="button" className="discussion-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <MessageSquare aria-hidden="true" size={17} /> Questions &amp; discussion {loaded ? '(' + questions.length + ')' : ''}
    </button>
    <div id={id} hidden={!open}>
      <p className="pdf-help">Ask before the meeting or continue the discussion afterwards. With shared accounts, please sign with your name and group.</p>
      <button type="button" className="secondary-button" disabled={loading} onClick={() => void refresh()}><RefreshCw aria-hidden="true" size={15} /> {loading ? 'Loading...' : 'Refresh discussion'}</button>
      {loadError && <p role="alert">{loadError}</p>}
      {loaded && !questions.length && <p className="pdf-help">No questions yet. Start the discussion below.</p>}
      <div className="question-list">
        {questions.map((question) => {
          const reference = files.find((file) => file.id === question.file_id && file.bucket === question.file_source)
          return <article className="question" key={question.id} aria-label={'Question by ' + question.author_name}>
            <header><strong>{question.author_name}</strong><span>{question.author_group}</span><time dateTime={question.created_at}>{new Date(question.created_at).toLocaleString('en-SG', { timeZone: 'Asia/Singapore', dateStyle: 'medium', timeStyle: 'short' })} SGT</time></header>
            <p className="question-body">{question.body}</p>
            {question.file_name && <div className="question-reference">
              <span>{question.file_name}{question.page_number ? ' · p. ' + question.page_number : ''}</span>
              {reference && onPreview ? <button className="text-button" type="button" onClick={() => onPreview({ ...reference, page: question.page_number ?? undefined })}>View referenced PDF</button> : <small>Original PDF no longer available.</small>}
            </div>}
            <div className="question-actions">
              {canManageSlot(profile, slot) ? <label>Question status<select aria-label={'Status of question by ' + question.author_name} value={question.status} disabled={statusPending !== null} onChange={(event) => void updateStatus(question.id, event.target.value as QuestionStatus)}>
                {Object.entries(questionStatuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select></label> : <span className={'question-status ' + question.status}>{questionStatuses[question.status]}</span>}
              <button className="secondary-button" type="button" onClick={() => setActiveReply(activeReply === question.id ? null : question.id)}>{activeReply === question.id ? 'Close reply' : 'Reply'}</button>
            </div>
            {question.replies.map((reply) => <div className="discussion-reply" key={reply.id}><strong>{reply.author_name}</strong><span> · {reply.author_group}</span><p className="question-body">{reply.body}</p></div>)}
            {activeReply === question.id && <ReplyForm onReply={async (draft) => { await repository.reply(question.id, draft); await refresh() }} />}
          </article>
        })}
      </div>
      <form className="discussion-form" aria-label="Ask a question" onSubmit={(event) => void ask(event)}>
        <h4>Ask a question</h4>
        <AuthorFields name={authorName} group={authorGroup} onName={setName} onGroup={setGroup} />
        <label htmlFor={id + '-body'}>Your question</label>
        <textarea id={id + '-body'} rows={3} required maxLength={4000} value={body} onChange={(event) => setBody(event.target.value)} />
        <div className="discussion-author-fields">
          <label htmlFor={id + '-file'}>Related PDF (optional)<select id={id + '-file'} value={fileKey} onChange={(event) => { setFileKey(event.target.value); setPageNumber('') }}>
            <option value="">General question</option>
            {files.map((file) => <option key={file.key} value={file.key}>{file.name}</option>)}
          </select></label>
          {fileKey && <label htmlFor={id + '-page'}>Page (optional)<input id={id + '-page'} type="number" min={1} max={10000} value={pageNumber} onChange={(event) => setPageNumber(event.target.value)} /></label>}
        </div>
        <button className="upload-button" type="submit" disabled={pending}>{pending ? 'Posting...' : 'Post question'}</button>
        {message && <p role="status">{message}</p>}
      </form>
    </div>
  </section>
}
