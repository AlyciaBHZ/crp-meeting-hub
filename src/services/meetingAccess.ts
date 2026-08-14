import type { Meeting } from '../data/meeting'

export interface MemberProfile {
  id: string
  role: 'presenter' | 'admin'
  email?: string
}

export function canManageSlot(profile: MemberProfile | null, slot: { groupMemberIds?: string[] }) {
  if (!profile) return false
  return profile.role === 'admin' || Boolean(slot.groupMemberIds?.includes(profile.id))
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
  privateDetails?: Record<string, unknown> | null,
  groupMemberIds: Record<string, string[]> = {},
  archiveFiles: Array<Record<string, unknown>> = [],
  slideFiles: Array<Record<string, unknown>> = [],
): Meeting {
  const groupNames = Object.fromEntries(slots.map((slot) => [String(slot.group_id), String(slot.group_name)]))
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
    zoomUrl: privateDetails?.zoom_url ? String(privateDetails.zoom_url) : undefined,
    archiveFiles: archiveFiles.map((file) => ({
      id: String(file.id),
      meetingId: String(file.meeting_id),
      groupId: String(file.group_id),
      groupName: groupNames[String(file.group_id)] ?? 'Unknown Lab',
      originalName: String(file.original_name),
      objectPath: String(file.object_path),
      sizeBytes: Number(file.size_bytes),
      uploadedAt: String(file.uploaded_at),
    })),
    slots: slots.map((slot) => {
      const slotSlideFiles = slideFiles
        .filter((file) => String(file.agenda_slot_id) === String(slot.id))
        .map((file) => ({
          id: String(file.id),
          agendaSlotId: String(file.agenda_slot_id),
          displayName: String(file.display_name),
          originalName: String(file.original_name),
          objectPath: String(file.object_path),
          sizeBytes: Number(file.size_bytes),
          uploadedBy: String(file.uploaded_by),
          uploadedAt: String(file.uploaded_at),
        }))
      return {
        id: String(slot.id),
        startsAt: String(slot.starts_at).slice(0, 5),
        endsAt: String(slot.ends_at).slice(0, 5),
        groupName: String(slot.group_name),
        presenterId: slot.presenter_id ? String(slot.presenter_id) : undefined,
        groupId: slot.group_id ? String(slot.group_id) : undefined,
        groupMemberIds: slot.group_id ? (groupMemberIds[String(slot.group_id)] ?? []) : [],
        slideStatus: slotSlideFiles.length ? 'uploaded' : 'awaiting',
        slideFiles: slotSlideFiles,
      }
    }),
  }
}
