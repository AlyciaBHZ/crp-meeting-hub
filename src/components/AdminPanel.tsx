import { ArrowDown, ArrowUp, CalendarPlus, Save, UserPlus, Users, X } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import type { AgendaDraftSlot, HistoricalMeetingDraft, Meeting, MeetingDraft, ResearchGroup } from '../data/meeting'
import { buildAgendaDraft, getSingaporeTodayISO, validateHistoricalMeetingDraft, validateMeetingDraft } from '../services/meetingLifecycle'

export interface ProfileRecord {
  id: string
  email: string
  display_name?: string | null
  role: 'presenter' | 'admin'
}

interface AdminPanelProps {
  profiles: ProfileRecord[]
  groups: ResearchGroup[]
  meetings: Meeting[]
  onAddMember: (email: string, role: 'presenter' | 'admin') => Promise<void>
  onCreateMeeting: (draft: MeetingDraft) => Promise<void>
  onUpdateMeeting: (meetingId: string, draft: MeetingDraft) => Promise<void>
  onRegisterHistoricalMeeting: (draft: HistoricalMeetingDraft) => Promise<void>
  onCreateGroup: (name: string) => Promise<void>
  onUpdateGroup: (groupId: string, updates: { name?: string; active?: boolean }) => Promise<void>
  onSetGroupMember: (groupId: string, profileId: string, enabled: boolean) => Promise<void>
}

function MeetingBuilder({ groups, meetings, onCreateMeeting, onUpdateMeeting, onRegisterHistoricalMeeting }: Pick<AdminPanelProps, 'groups' | 'meetings' | 'onCreateMeeting' | 'onUpdateMeeting' | 'onRegisterHistoricalMeeting'>) {
  const [mode, setMode] = useState<'upcoming' | 'past'>('upcoming')
  const [editingMeetingId, setEditingMeetingId] = useState('')
  const [date, setDate] = useState('')
  const [zoomUrl, setZoomUrl] = useState('')
  const [slots, setSlots] = useState<AgendaDraftSlot[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function changeMode(nextMode: 'upcoming' | 'past') {
    setMode(nextMode)
    setEditingMeetingId('')
    setDate('')
    setZoomUrl('')
    setSlots([])
    setMessage(null)
  }

  function selectMeeting(meetingId: string) {
    setEditingMeetingId(meetingId)
    setMessage(null)
    if (!meetingId) {
      setDate('')
      setZoomUrl('')
      setSlots([])
      return
    }
    const meeting = meetings.find((candidate) => candidate.id === meetingId)
    if (!meeting) return
    setDate(meeting.dateISO ?? '')
    setZoomUrl(meeting.zoomUrl ?? '')
    setSlots(meeting.slots.flatMap((slot, index) => slot.groupId ? [{
      id: slot.id,
      groupId: slot.groupId,
      groupName: slot.groupName,
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      sortOrder: index + 1,
    }] : []))
  }

  function toggleGroup(group: ResearchGroup, selected: boolean) {
    if (selected) {
      const startsAt = slots.at(-1)?.endsAt ?? '09:00'
      const nextSlot = buildAgendaDraft([group], startsAt)[0]
      setSlots([...slots, { ...nextSlot, sortOrder: slots.length + 1 }])
      return
    }
    setSlots(slots.filter((slot) => slot.groupId !== group.id).map((slot, index) => ({ ...slot, sortOrder: index + 1 })))
  }

  function updateSlot(index: number, updates: Partial<AgendaDraftSlot>) {
    setSlots(slots.map((slot, slotIndex) => slotIndex === index ? { ...slot, ...updates } : slot))
  }

  function moveGroup(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= slots.length) return
    const reordered = [...slots]
    const movedSlot = reordered[index]
    reordered[index] = reordered[target]
    reordered[target] = movedSlot
    setSlots(reordered.map((slot, slotIndex) => ({
      ...slot,
      startsAt: slots[slotIndex].startsAt,
      endsAt: slots[slotIndex].endsAt,
      sortOrder: slotIndex + 1,
    })))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const meetingDraft = { date, zoomUrl: zoomUrl.trim(), slots }
    const historicalDraft = { date, slots }
    const validationError = mode === 'past'
      ? validateHistoricalMeetingDraft(historicalDraft, getSingaporeTodayISO())
      : validateMeetingDraft(meetingDraft)
    if (validationError) {
      setMessage(validationError)
      return
    }
    setPending(true)
    setMessage(null)
    try {
      if (mode === 'past') {
        await onRegisterHistoricalMeeting(historicalDraft)
      } else if (editingMeetingId) {
        await onUpdateMeeting(editingMeetingId, meetingDraft)
      } else {
        await onCreateMeeting(meetingDraft)
      }
      setEditingMeetingId('')
      setDate('')
      setZoomUrl('')
      setSlots([])
      setMessage(mode === 'past' ? 'Past meeting registered.' : editingMeetingId ? 'Meeting updated.' : 'Meeting created.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create the meeting.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="admin-workspace-section" aria-labelledby="create-meeting-heading">
      <div className="admin-subheading">
        <div><p className="eyebrow">Online schedule</p><h3 id="create-meeting-heading">{mode === 'past' ? 'Register past meeting' : editingMeetingId ? 'Edit meeting' : 'Create meeting'}</h3></div>
        <CalendarPlus aria-hidden="true" size={20} />
      </div>
      <div className="meeting-mode-tabs" aria-label="Meeting type">
        <button type="button" className={mode === 'upcoming' ? 'active' : ''} onClick={() => changeMode('upcoming')}>Upcoming meeting</button>
        <button type="button" className={mode === 'past' ? 'active' : ''} onClick={() => changeMode('past')}>Past meeting</button>
      </div>
      <form className="meeting-builder" onSubmit={submit}>
        <div className="meeting-core-fields">
          {mode === 'upcoming' && <>
            <label htmlFor="meeting-to-manage">Meeting to manage</label>
            <select id="meeting-to-manage" value={editingMeetingId} onChange={(event) => selectMeeting(event.target.value)}>
              <option value="">Create a new meeting</option>
              {meetings.map((meeting) => <option key={meeting.id} value={meeting.id}>{meeting.date ?? meeting.title}</option>)}
            </select>
          </>}
          <label htmlFor="new-meeting-date">{mode === 'past' ? 'Past meeting date' : 'Meeting date'}</label>
          <input id="new-meeting-date" type="date" required max={mode === 'past' ? getSingaporeTodayISO() : undefined} value={date} onChange={(event) => setDate(event.target.value)} />
          {mode === 'upcoming' && <>
            <label htmlFor="new-meeting-zoom">Zoom link</label>
            <input id="new-meeting-zoom" type="url" required placeholder="https://zoom.us/j/..." value={zoomUrl} onChange={(event) => setZoomUrl(event.target.value)} />
          </>}
        </div>

        <fieldset className="group-picker">
          <legend>Presenting groups</legend>
          {groups.filter((group) => group.active).map((group) => (
            <label key={group.id}>
              <input
                type="checkbox"
                aria-label={`Select ${group.name}`}
                checked={slots.some((slot) => slot.groupId === group.id)}
                onChange={(event) => toggleGroup(group, event.target.checked)}
              />
              <span>{group.name}</span>
            </label>
          ))}
        </fieldset>

        {slots.length > 0 && (
          <div className="agenda-builder" aria-label="Selected presentation schedule">
            {slots.map((slot, index) => (
              <div className="agenda-draft-row" key={slot.groupId}>
                <span className="agenda-draft-order">{String(index + 1).padStart(2, '0')}</span>
                <strong>{slot.groupName}</strong>
                <label>Start <input type="time" value={slot.startsAt} onChange={(event) => updateSlot(index, { startsAt: event.target.value })} /></label>
                <label>End <input type="time" value={slot.endsAt} onChange={(event) => updateSlot(index, { endsAt: event.target.value })} /></label>
                <div className="row-tools">
                  <button type="button" className="icon-button" aria-label={`Move ${slot.groupName} up`} disabled={index === 0} onClick={() => moveGroup(index, -1)}><ArrowUp aria-hidden="true" size={16} /></button>
                  <button type="button" className="icon-button" aria-label={`Move ${slot.groupName} down`} disabled={index === slots.length - 1} onClick={() => moveGroup(index, 1)}><ArrowDown aria-hidden="true" size={16} /></button>
                  <button type="button" className="icon-button danger" aria-label={`Remove ${slot.groupName}`} onClick={() => toggleGroup(groups.find((group) => group.id === slot.groupId)!, false)}><X aria-hidden="true" size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="form-command-row">
          <button className="upload-button" type="submit" disabled={pending}>
            <CalendarPlus aria-hidden="true" size={17} /> {pending ? 'Saving...' : mode === 'past' ? 'Register past meeting' : editingMeetingId ? 'Save meeting' : 'Create meeting'}
          </button>
          {message && <p className="member-message" role="status">{message}</p>}
        </div>
      </form>
    </section>
  )
}

function GroupManager({ groups, profiles, onCreateGroup, onUpdateGroup, onSetGroupMember }: Pick<AdminPanelProps, 'groups' | 'profiles' | 'onCreateGroup' | 'onUpdateGroup' | 'onSetGroupMember'>) {
  const [newGroupName, setNewGroupName] = useState('')
  const [names, setNames] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setNames(Object.fromEntries(groups.map((group) => [group.id, group.name])))
  }, [groups])

  async function createGroup(event: FormEvent) {
    event.preventDefault()
    setMessage(null)
    try {
      await onCreateGroup(newGroupName.trim())
      setNewGroupName('')
      setMessage('Group added.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add the group.')
    }
  }

  return (
    <section className="admin-workspace-section" aria-labelledby="groups-heading">
      <div className="admin-subheading">
        <div><p className="eyebrow">Long-term units</p><h3 id="groups-heading">Groups and members</h3></div>
        <Users aria-hidden="true" size={20} />
      </div>
      <form className="add-group-form" onSubmit={createGroup}>
        <label htmlFor="new-group-name">New group name</label>
        <input id="new-group-name" required value={newGroupName} onChange={(event) => setNewGroupName(event.target.value)} />
        <button className="secondary-button" type="submit">Add group</button>
        {message && <p className="member-message" role="status">{message}</p>}
      </form>

      <div className="group-admin-list">
        {groups.map((group) => (
          <section className="group-admin-row" key={group.id} aria-label={group.name}>
            <div className="group-name-controls">
              <input aria-label={`${group.name} name`} value={names[group.id] ?? group.name} onChange={(event) => setNames({ ...names, [group.id]: event.target.value })} />
              <button type="button" className="icon-button" aria-label={`Save ${group.name} name`} onClick={() => void onUpdateGroup(group.id, { name: names[group.id]?.trim() })}><Save aria-hidden="true" size={16} /></button>
              <label className="status-toggle"><input type="checkbox" checked={group.active} onChange={(event) => void onUpdateGroup(group.id, { active: event.target.checked })} /> Active</label>
            </div>
            <div className="group-member-options">
              {profiles.map((profile) => {
                const label = profile.display_name || profile.email
                return (
                  <label key={profile.id}>
                    <input
                      type="checkbox"
                      aria-label={`${label} in ${group.name}`}
                      checked={group.memberIds.includes(profile.id)}
                      onChange={(event) => void onSetGroupMember(group.id, profile.id, event.target.checked)}
                    />
                    <span>{label}</span>
                  </label>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  )
}

function MemberManager({ profiles, onAddMember }: Pick<AdminPanelProps, 'profiles' | 'onAddMember'>) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'presenter' | 'admin'>('presenter')
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage(null)
    try {
      await onAddMember(email.trim().toLowerCase(), role)
      setEmail('')
      setMessage('Member approved. They can set up a password now.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add the member.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="admin-workspace-section" aria-labelledby="members-heading">
      <div className="admin-subheading">
        <div><p className="eyebrow">Account access</p><h3 id="members-heading">Approved members</h3></div>
        <span className="member-count"><Users aria-hidden="true" size={16} /> {profiles.length} active</span>
      </div>
      <form className="member-form" onSubmit={submit}>
        <label htmlFor="new-member-email">Member email</label>
        <input id="new-member-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@institution.edu" />
        <label htmlFor="new-member-role">Role</label>
        <select id="new-member-role" aria-label="Role" value={role} onChange={(event) => setRole(event.target.value as 'presenter' | 'admin')}>
          <option value="presenter">Presenter</option>
          <option value="admin">Administrator</option>
        </select>
        <button className="upload-button" type="submit" disabled={pending}>
          <UserPlus aria-hidden="true" size={17} /> {pending ? 'Adding...' : 'Add member'}
        </button>
        {message && <p className="member-message" role="status">{message}</p>}
      </form>
    </section>
  )
}

export function AdminPanel(props: AdminPanelProps) {
  return (
    <section className="admin-section" aria-labelledby="admin-heading">
      <div className="section-heading">
        <div><p className="eyebrow">Administrator</p><h2 id="admin-heading">Meeting administration</h2></div>
      </div>
      <MeetingBuilder
        groups={props.groups}
        meetings={props.meetings}
        onCreateMeeting={props.onCreateMeeting}
        onUpdateMeeting={props.onUpdateMeeting}
        onRegisterHistoricalMeeting={props.onRegisterHistoricalMeeting}
      />
      <GroupManager {...props} />
      <MemberManager profiles={props.profiles} onAddMember={props.onAddMember} />
    </section>
  )
}
