import type { HistoricalMeetingDraft, MeetingDraft, ResearchGroup } from '../data/meeting'

export type MeetingView = 'upcoming' | 'archive'

export function classifyMeetingDate(dateISO: string, todayISO: string): MeetingView {
  return dateISO < todayISO ? 'archive' : 'upcoming'
}

export function getSingaporeTodayISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Singapore',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function addMinutes(time: string, minutes: number): string {
  const [hours, currentMinutes] = time.split(':').map(Number)
  const total = hours * 60 + currentMinutes + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function buildAgendaDraft(groups: ResearchGroup[], startsAt = '09:00') {
  let cursor = startsAt
  return groups.map((group, index) => {
    const endsAt = addMinutes(cursor, 20)
    const slot = {
      groupId: group.id,
      groupName: group.name,
      startsAt: cursor,
      endsAt,
      sortOrder: index + 1,
    }
    cursor = endsAt
    return slot
  })
}

export function validateMeetingDraft(draft: MeetingDraft): string | null {
  if (!draft.date) return 'Meeting date is required.'
  let zoomUrl: URL
  try {
    zoomUrl = new URL(draft.zoomUrl)
  } catch {
    return 'Enter a valid Zoom URL.'
  }
  if (zoomUrl.protocol !== 'https:') return 'Enter a secure Zoom URL.'
  if (zoomUrl.hostname !== 'zoom.us' && !zoomUrl.hostname.endsWith('.zoom.us')) return 'Enter a Zoom URL.'
  if (!draft.slots.length) return 'Select at least one presenting group.'
  if (draft.slots.some((slot) => slot.endsAt <= slot.startsAt)) {
    return 'Every agenda end time must be after its start time.'
  }
  const hasOverlap = draft.slots.some((slot, index) => draft.slots.some((other, otherIndex) => (
    index < otherIndex && slot.startsAt < other.endsAt && other.startsAt < slot.endsAt
  )))
  if (hasOverlap) return 'Agenda times cannot overlap.'
  return null
}

function validateAgenda(slots: HistoricalMeetingDraft['slots']): string | null {
  if (!slots.length) return 'Select at least one presenting group.'
  if (slots.some((slot) => slot.endsAt <= slot.startsAt)) {
    return 'Every agenda end time must be after its start time.'
  }
  const hasOverlap = slots.some((slot, index) => slots.some((other, otherIndex) => (
    index < otherIndex && slot.startsAt < other.endsAt && other.startsAt < slot.endsAt
  )))
  return hasOverlap ? 'Agenda times cannot overlap.' : null
}

export function validateHistoricalMeetingDraft(draft: HistoricalMeetingDraft, todayISO: string): string | null {
  if (!draft.date) return 'Meeting date is required.'
  if (draft.date >= todayISO) return 'Choose a date before today.'
  return validateAgenda(draft.slots)
}
