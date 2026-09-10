import { describe, expect, it } from 'vitest'
import { meetingLink, passwordSetupLink, readMeetingTarget } from './meetingLinks'

describe('meeting permalinks', () => {
  it('retains the selected meeting and group through email login without copying auth secrets', () => {
    expect(passwordSetupLink('https://example.test/?meeting=past&group=lab&code=private#access_token=secret')).toBe('https://example.test/?meeting=past&group=lab&password_setup=1')
  })
  it('shares only stable IDs, removing auth tokens, password flags and previous targets', () => {
    const link = meetingLink('new meeting', 'group&1', 'https://example.test/?meeting=old&password_setup=1&code=private#access_token=secret')
    expect(link).toBe('https://example.test/?meeting=new+meeting&group=group%261')
    expect(readMeetingTarget(new URL(link).search)).toEqual({ meetingId: 'new meeting', groupId: 'group&1' })
  })
  it('allows meeting-only links and ignores an orphan group parameter', () => {
    expect(readMeetingTarget('?group=alone')).toBeNull()
    expect(readMeetingTarget('?meeting=one')).toEqual({ meetingId: 'one', groupId: undefined })
  })
})
