import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => {
  const member = { id: 'member', role: 'presenter' }
  return {
    member,
    callback: undefined as undefined | ((event: string, session: { user: { id: string } } | null) => void),
    getProfile: vi.fn().mockResolvedValue(member),
    getMeetings: vi.fn().mockResolvedValue({ upcoming: [{ id: 'meeting', title: 'Test meeting', dateISO: '2027-01-01', timezone: 'Asia/Singapore', presentationMinutes: 15, qaMinutes: 5, slots: [{ id: 'slot', groupId: 'group', groupName: 'Research group', groupMemberIds: ['member'], startsAt: '09:00', endsAt: '09:20', slideFiles: [], slideStatus: 'awaiting' }] }], archive: [] }),
  }
})
vi.mock('./services/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: { auth: {
  getUser: () => Promise.resolve({ data: { user: { id: 'member' } } }),
  onAuthStateChange: (callback: typeof fixture.callback) => { fixture.callback = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } },
} } }))
vi.mock('./services/meetingRepository', () => ({ createMeetingRepository: () => ({ getProfile: fixture.getProfile, getMeetings: fixture.getMeetings, getGroups: () => Promise.resolve([]) }) }))
vi.mock('./services/discussionRepository', () => ({ createDiscussionRepository: () => ({ list: () => Promise.resolve([]) }) }))
import App from './App'

beforeEach(() => { fixture.getProfile.mockReset().mockResolvedValue(fixture.member) })

describe('member session refresh', () => {
  it('preserves a question draft during a same-account session refresh', async () => {
    render(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Questions & discussion' }))
    await userEvent.type(screen.getByLabelText('Your question'), 'Draft to keep')
    let finishRefresh!: (value: typeof fixture.member) => void
    fixture.getProfile.mockImplementationOnce(() => new Promise(resolve => { finishRefresh = resolve }))
    await act(async () => { fixture.callback?.('TOKEN_REFRESHED', { user: { id: 'member' } }); await new Promise(resolve => setTimeout(resolve, 20)) })
    expect(screen.getByLabelText('Your question')).toBeVisible()
    expect(screen.getByLabelText('Your question')).toHaveValue('Draft to keep')
    await act(async () => finishRefresh(fixture.member))
  })

  it('ignores an outdated profile response after signing out', async () => {
    let resolveProfile!: (value: typeof fixture.member) => void
    fixture.getProfile.mockImplementationOnce(() => new Promise(resolve => { resolveProfile = resolve }))
    render(<App />)
    await waitFor(() => expect(fixture.getProfile).toHaveBeenCalled())
    await act(async () => { fixture.callback?.('SIGNED_OUT', null); await new Promise(resolve => setTimeout(resolve, 20)) })
    await act(async () => resolveProfile(fixture.member))
    expect(screen.queryByRole('button', { name: /Questions & discussion/ })).not.toBeInTheDocument()
  })
})
