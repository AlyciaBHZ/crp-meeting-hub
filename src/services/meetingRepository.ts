import type { SupabaseClient } from '@supabase/supabase-js'

function ensureNoError(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

function requireData<T>(data: T | null, message: string): T {
  if (data === null) throw new Error(message)
  return data
}

export function createMeetingRepository(client: SupabaseClient) {
  return {
    async getUpcomingMeeting() {
      const meetingResult = await client
        .from('meetings')
        .select('*')
        .eq('status', 'upcoming')
        .single()
      ensureNoError(meetingResult.error)
      const meeting = requireData(meetingResult.data, 'The upcoming meeting was not found.')

      const slotsResult = await client
        .from('agenda_slots')
        .select('*, resources(*)')
        .eq('meeting_id', meeting.id)
        .order('sort_order')
      ensureNoError(slotsResult.error)
      const minutesResult = await client
        .from('resources')
        .select('*')
        .eq('meeting_id', meeting.id)
        .eq('kind', 'minutes')
      ensureNoError(minutesResult.error)
      return { meeting, slots: slotsResult.data ?? [], minutes: minutesResult.data?.[0] ?? null }
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

    async assignPresenter(slotId: string, presenterId: string | null) {
      const result = await client.from('agenda_slots').update({ presenter_id: presenterId }).eq('id', slotId)
      ensureNoError(result.error)
    },

    async updateMeeting(meetingId: string, updates: { meeting_date: string | null; venue: string | null }) {
      const result = await client.from('meetings').update(updates).eq('id', meetingId)
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
