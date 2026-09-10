import { Link } from 'lucide-react'
import { useState } from 'react'
import { meetingLink } from '../services/meetingLinks'

export function ShareLink({ meetingId, groupId }: { meetingId: string; groupId?: string }) {
  const [message, setMessage] = useState('')
  const [manualLink, setManualLink] = useState('')
  async function copy() {
    const link = meetingLink(meetingId, groupId)
    try {
      await navigator.clipboard.writeText(link)
      setManualLink('')
      setMessage('Link copied. Members can sign in to view materials.')
    } catch {
      setManualLink(link)
      setMessage('Copy this link to share the meeting with your team.')
    }
  }
  return (
    <div className="share-link">
      <button type="button" className="secondary-button" onClick={() => void copy()}><Link aria-hidden="true" size={16} /> {groupId ? 'Copy group link' : 'Copy meeting link'}</button>
      {message && <small role="status">{message}</small>}
      {manualLink && <input aria-label="Meeting link to copy" value={manualLink} readOnly onFocus={(event) => event.target.select()} />}
    </div>
  )
}
