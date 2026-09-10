import type { AgendaDraftSlot, HistoricalMeetingDraft, MeetingDraft, ResearchGroup } from '../data/meeting'

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

export function buildAgendaDraft(groups: ResearchGroup[], startsAt = '09:00', slotMinutes = 20) {
  let cursor = startsAt
  return groups.map((group, index) => {
    const endsAt = addMinutes(cursor, slotMinutes)
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

export function shiftAgendaStart(slots: AgendaDraftSlot[], startsAt: string): AgendaDraftSlot[] {
  if (!slots.length) return slots
  const minutes = (time: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Enter a valid meeting time.')
    const [hours, mins] = time.split(':').map(Number)
    return hours * 60 + mins
  }
  const offset = minutes(startsAt) - minutes(slots[0].startsAt)
  return slots.map((slot) => {
    if ([slot.startsAt, slot.endsAt].some((time) => minutes(time) + offset < 0 || minutes(time) + offset >= 1440)) {
      throw new Error('Keep all agenda times within the same Singapore calendar day.')
    }
    return { ...slot, startsAt: addMinutes(slot.startsAt, offset), endsAt: addMinutes(slot.endsAt, offset) }
  })
}

export function validateMeetingDraft(draft: MeetingDraft): string | null {
  if (!draft.date) return 'Meeting date is required.'
  if (!draft.title.trim()) return 'Meeting title is required.'
  if (!Number.isInteger(draft.presentationMinutes) || !Number.isInteger(draft.qaMinutes)
    || draft.presentationMinutes < 1 || draft.qaMinutes < 1) {
    return 'Enter positive presentation and Q&A durations.'
  }
  let zoomUrl: URL
  try {
    zoomUrl = new URL(draft.zoomUrl)
  } catch {
    return 'Enter a valid Zoom URL.'
  }
  if (zoomUrl.protocol !== 'https:') return 'Enter a secure Zoom URL.'
  if (zoomUrl.hostname !== 'zoom.us' && !zoomUrl.hostname.endsWith('.zoom.us')) return 'Enter a Zoom URL.'
  return validateAgenda(draft.slots)
}

function validateAgenda(slots: HistoricalMeetingDraft['slots']): string | null {
  if (!slots.length) return 'Select at least one presenting group.'
  if (slots.some((slot) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.startsAt) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(slot.endsAt))) return 'Enter a valid start and end time for every group.'
  if (new Set(slots.map((slot) => slot.groupId)).size !== slots.length) return 'Choose each group only once.'
  if (slots.some((slot) => slot.endsAt <= slot.startsAt)) {
    return 'Every agenda end time must be after its start time.'
  }
  const hasOverlap = slots.some((slot, index) => slots.some((other, otherIndex) => (
    index < otherIndex && slot.startsAt < other.endsAt && other.startsAt < slot.endsAt
  )))
  if (hasOverlap) return 'Agenda times cannot overlap.'
  if (slots.some((slot, index) => index > 0 && slot.startsAt < slots[index - 1].endsAt)) return 'Agenda times must follow presentation order.'
  return null
}

export function validateHistoricalMeetingDraft(draft: HistoricalMeetingDraft, todayISO: string): string | null {
  if (!draft.date) return 'Meeting date is required.'
  if (draft.date >= todayISO) return 'Choose a date before today.'
  return validateAgenda(draft.slots)
}
