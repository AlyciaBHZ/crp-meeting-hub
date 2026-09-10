export interface MeetingTarget {
  meetingId: string
  groupId?: string
}

export function readMeetingTarget(search: string): MeetingTarget | null {
  const params = new URLSearchParams(search)
  const meetingId = params.get('meeting')
  if (!meetingId) return null
  return { meetingId, groupId: params.get('group') || undefined }
}

export function meetingLink(meetingId: string, groupId?: string, base = window.location.href): string {
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  url.searchParams.set('meeting', meetingId)
  if (groupId) url.searchParams.set('group', groupId)
  return url.toString()
}

export function meetingGroupAnchor(meetingId: string, groupId: string): string {
  return 'meeting-' + meetingId + '-group-' + groupId
}

export function passwordSetupLink(base: string): string {
  const target = readMeetingTarget(new URL(base).search)
  const url = target ? new URL(meetingLink(target.meetingId, target.groupId, base)) : new URL(new URL(base).pathname, new URL(base).origin)
  url.searchParams.set('password_setup', '1')
  return url.toString()
}
