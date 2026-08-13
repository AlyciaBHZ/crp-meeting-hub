import type { Meeting } from '../data/meeting'

export interface MemberProfile {
  id: string
  role: 'presenter' | 'admin'
  email?: string
}

export function canManageSlot(profile: MemberProfile | null, slot: { presenter_id?: string | null; presenterId?: string }) {
  if (!profile) return false
  return profile.role === 'admin' || (slot.presenter_id ?? slot.presenterId) === profile.id
}

function formatDate(date?: string | null) {
  if (!date) return undefined
  return new Intl.DateTimeFormat('en-SG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00Z`))
}

export function mapCloudMeeting(
  meeting: Record<string, unknown>,
  slots: Array<Record<string, unknown>>,
  minutes?: Record<string, unknown> | null,
): Meeting {
  return {
    id: String(meeting.id),
    title: String(meeting.title),
    date: formatDate(meeting.meeting_date as string | null),
    dateISO: meeting.meeting_date ? String(meeting.meeting_date) : undefined,
    venue: meeting.venue ? String(meeting.venue) : undefined,
    timezone: String(meeting.timezone),
    presentationMinutes: Number(meeting.presentation_minutes),
    qaMinutes: Number(meeting.qa_minutes),
    minutesFileName: minutes?.original_name ? String(minutes.original_name) : undefined,
    minutesObjectPath: minutes?.object_path ? String(minutes.object_path) : undefined,
    slots: slots.map((slot) => {
      const resources = (slot.resources ?? []) as Array<Record<string, unknown>>
      const slides = resources.find((resource) => resource.kind === 'slides') ?? resources[0]
      return {
        id: String(slot.id),
        startsAt: String(slot.starts_at).slice(0, 5),
        endsAt: String(slot.ends_at).slice(0, 5),
        groupName: String(slot.group_name),
        presenterId: slot.presenter_id ? String(slot.presenter_id) : undefined,
        slideStatus: slides ? 'uploaded' : 'awaiting',
        slideFileName: slides?.original_name ? String(slides.original_name) : undefined,
        slideObjectPath: slides?.object_path ? String(slides.object_path) : undefined,
      }
    }),
  }
}
