import type { SupabaseClient } from '@supabase/supabase-js'
import type { MeetingDraft, ResearchGroup } from '../data/meeting'
import { mapCloudMeeting } from './meetingAccess'
import { classifyMeetingDate } from './meetingLifecycle'

function ensureNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message)
  return data
}

export function createMeetingRepository(client: SupabaseClient) {
  return {
    async getMeetings(todayISO: string) {
      const [meetingsResult, slotsResult, minutesResult, detailsResult, membershipsResult] = await Promise.all([
        client.from('meetings').select('*').not('meeting_date', 'is', null).order('meeting_date'),
        client.from('agenda_slots').select('*, resources(*)').order('sort_order'),
        client.from('resources').select('*').eq('kind', 'minutes').order('uploaded_at'),
        client.from('meeting_private_details').select('*').order('meeting_id'),
        client.from('group_members').select('*').order('created_at'),
      ])
      ensureNoError(meetingsResult.error)
      ensureNoError(slotsResult.error)
      ensureNoError(minutesResult.error)
      ensureNoError(detailsResult.error)
      ensureNoError(membershipsResult.error)

      const memberIdsByGroup = (membershipsResult.data ?? []).reduce<Record<string, string[]>>((lookup, membership) => {
        const groupId = String(membership.group_id)
        lookup[groupId] = [...(lookup[groupId] ?? []), String(membership.profile_id)]
        return lookup
      }, {})

      const mapped = (meetingsResult.data ?? []).map((meeting) => mapCloudMeeting(
        meeting,
        (slotsResult.data ?? []).filter((slot) => slot.meeting_id === meeting.id),
        (minutesResult.data ?? []).find((minutes) => minutes.meeting_id === meeting.id),
        (detailsResult.data ?? []).find((details) => details.meeting_id === meeting.id),
        memberIdsByGroup,
      ))

      return {
        upcoming: mapped.filter((meeting) => meeting.dateISO && classifyMeetingDate(meeting.dateISO, todayISO) === 'upcoming'),
        archive: mapped
          .filter((meeting) => meeting.dateISO && classifyMeetingDate(meeting.dateISO, todayISO) === 'archive')
          .reverse(),
      }
    },

    async getGroups(): Promise<ResearchGroup[]> {
      const result = await client.from('groups').select('*, group_members(profile_id)').order('sort_order')
      ensureNoError(result.error)
      return (result.data ?? []).map((group) => ({
        id: String(group.id),
        name: String(group.name),
        active: Boolean(group.active),
        memberIds: ((group.group_members ?? []) as Array<{ profile_id: string }>).map((member) => String(member.profile_id)),
      }))
    },

    async createMeeting(draft: MeetingDraft) {
      const result = await client.rpc('create_meeting_with_slots', {
        meeting_date_input: draft.date,
        zoom_url_input: draft.zoomUrl,
        slots_input: draft.slots.map((slot) => ({
          group_id: slot.groupId,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          sort_order: slot.sortOrder,
        })),
      })
      ensureNoError(result.error)
      return requireData(result.data, 'The meeting could not be created.')
    },

    async updateMeetingSchedule(meetingId: string, draft: MeetingDraft) {
      const result = await client.rpc('update_meeting_with_slots', {
        meeting_id_input: meetingId,
        meeting_date_input: draft.date,
        zoom_url_input: draft.zoomUrl,
        slots_input: draft.slots.map((slot) => ({
          slot_id: slot.id ?? null,
          group_id: slot.groupId,
          starts_at: slot.startsAt,
          ends_at: slot.endsAt,
          sort_order: slot.sortOrder,
        })),
      })
      ensureNoError(result.error)
      return requireData(result.data, 'The meeting could not be updated.')
    },

    async createGroup(name: string) {
      const result = await client.from('groups').insert({ name: name.trim() })
      ensureNoError(result.error)
    },

    async updateGroup(groupId: string, updates: { name?: string; active?: boolean }) {
      const result = await client.from('groups').update(updates).eq('id', groupId)
      ensureNoError(result.error)
    },

    async setGroupMember(groupId: string, profileId: string, enabled: boolean) {
      const result = enabled
        ? await client.from('group_members').upsert({ group_id: groupId, profile_id: profileId })
        : await client.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId)
      ensureNoError(result.error)
    },

    async getProfile(userId: string) {
      const result = await client.from('profiles').select('*').eq('id', userId).single()
      if (result.error?.code === 'PGRST116') return null
      ensureNoError(result.error)
      return result.data
    },

    async getProfiles() {
      const result = await client.from('profiles').select('*').order('email')
      ensureNoError(result.error)
      return result.data ?? []
    },

    async addMember(email: string, role: 'presenter' | 'admin') {
      const result = await client.from('member_allowlist').insert({ email: email.trim().toLowerCase(), role })
      ensureNoError(result.error)
    },

    async uploadSlides(slotId: string, userId: string, file: File) {
      const path = `${slotId}/slides`
      const uploadResult = await client.storage.from('slides').upload(path, file, { upsert: true })
      ensureNoError(uploadResult.error)

      const meetingIdResult = await client.from('agenda_slots').select('meeting_id').eq('id', slotId).single()
      ensureNoError(meetingIdResult.error)
      const slot = requireData(meetingIdResult.data, 'The agenda slot was not found.')
      const metadataResult = await client.from('resources').upsert(
        {
          meeting_id: slot.meeting_id,
          agenda_slot_id: slotId,
          kind: 'slides',
          bucket_id: 'slides',
          object_path: path,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId,
        },
        { onConflict: 'kind,agenda_slot_id' },
      )
      ensureNoError(metadataResult.error)
      return requireData(uploadResult.data, 'The slide upload returned no path.').path
    },

    async getDownloadUrl(bucket: 'slides' | 'minutes', path: string) {
      const result = await client.storage.from(bucket).createSignedUrl(path, 60)
      ensureNoError(result.error)
      return requireData(result.data, 'The download link could not be created.').signedUrl
    },

    async uploadMinutes(meetingId: string, userId: string, file: File) {
      const path = `${meetingId}/minutes`
      const uploadResult = await client.storage.from('minutes').upload(path, file, { upsert: true })
      ensureNoError(uploadResult.error)
      const metadataResult = await client.from('resources').upsert(
        {
          meeting_id: meetingId,
          agenda_slot_id: null,
          kind: 'minutes',
          bucket_id: 'minutes',
          object_path: path,
          original_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          uploaded_by: userId,
        },
        { onConflict: 'kind,resource_scope' },
      )
      ensureNoError(metadataResult.error)
      return requireData(uploadResult.data, 'The minutes upload returned no path.').path
    },
  }
}
