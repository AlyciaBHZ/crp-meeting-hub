import { UserPlus, Users } from 'lucide-react'
import { FormEvent, useState } from 'react'
import type { AgendaSlot } from '../data/meeting'

interface Profile {
  id: string
  email: string
  display_name?: string | null
  role: 'presenter' | 'admin'
}

interface AdminPanelProps {
  meeting: { id: string; dateISO?: string; venue?: string }
  profiles: Profile[]
  slots: AgendaSlot[]
  onAddMember: (email: string, role: 'presenter' | 'admin') => Promise<void>
  onAssign: (slotId: string, presenterId: string | null) => Promise<void>
  onUpdateMeeting: (date: string, venue: string) => Promise<void>
}

export function AdminPanel({ meeting, profiles, slots, onAddMember, onAssign, onUpdateMeeting }: AdminPanelProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'presenter' | 'admin'>('presenter')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [meetingDate, setMeetingDate] = useState(meeting.dateISO ?? '')
  const [venue, setVenue] = useState(meeting.venue ?? '')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await onAddMember(email, role)
      setMessage('Member approved. They can now request a sign-in link.')
      setEmail('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add the member.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="admin-section" aria-labelledby="admin-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Administrator</p>
          <h2 id="admin-heading">Members and assignments</h2>
        </div>
        <p className="timezone"><Users aria-hidden="true" size={16} /> {profiles.length} active members</p>
      </div>

      <form className="member-form" onSubmit={submit}>
        <label htmlFor="new-member-email">Member email</label>
        <input id="new-member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@institution.edu" />
        <label htmlFor="new-member-role">Role</label>
        <select id="new-member-role" value={role} onChange={(event) => setRole(event.target.value as 'presenter' | 'admin')}>
          <option value="presenter">Presenter</option>
          <option value="admin">Administrator</option>
        </select>
        <button className="upload-button" type="submit" disabled={pending}>
          <UserPlus aria-hidden="true" size={17} /> {pending ? 'Adding...' : 'Add member'}
        </button>
        {message && <p className="member-message" role="status">{message}</p>}
      </form>

      <form className="schedule-form" onSubmit={(event) => {
        event.preventDefault()
        void onUpdateMeeting(meetingDate, venue)
      }}>
        <label htmlFor="meeting-date">Meeting date</label>
        <input id="meeting-date" type="date" required value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
        <label htmlFor="meeting-venue">Venue</label>
        <input id="meeting-venue" type="text" required value={venue} onChange={(event) => setVenue(event.target.value)} placeholder="Room or online meeting link" />
        <button className="secondary-button" type="submit">Save schedule</button>
      </form>

      <div className="assignment-list">
        {slots.map((slot) => (
          <label key={slot.id} className="assignment-row">
            <span>{slot.groupName}</span>
            <select value={slot.presenterId ?? ''} onChange={(event) => void onAssign(slot.id, event.target.value || null)}>
              <option value="">Not assigned</option>
              {profiles.filter((profile) => profile.role === 'presenter').map((profile) => (
                <option key={profile.id} value={profile.id}>{profile.display_name || profile.email}</option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <p className="admin-help">New members appear in assignment menus after their first successful email sign-in.</p>
    </section>
  )
}
