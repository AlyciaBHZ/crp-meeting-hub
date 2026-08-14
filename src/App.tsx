import type { User } from '@supabase/supabase-js'
import { Archive, CalendarDays, Cloud, CloudOff, FolderKanban } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminPanel, type ProfileRecord } from './components/AdminPanel'
import { AuthPanel } from './components/AuthPanel'
import { MeetingCollection } from './components/MeetingCollection'
import type { AgendaSlot, ArchiveLabFile, HistoricalMeetingDraft, Meeting, MeetingDraft, ResearchGroup, SlideFile } from './data/meeting'
import { upcomingMeeting } from './data/meeting'
import type { MemberProfile } from './services/meetingAccess'
import { isSharedLogin, resolveLoginIdentity } from './services/loginIdentity'
import { getSingaporeTodayISO, type MeetingView } from './services/meetingLifecycle'
import { createMeetingRepository } from './services/meetingRepository'
import { isSupabaseConfigured, supabase } from './services/supabaseClient'

const localGroups: ResearchGroup[] = upcomingMeeting.slots.map((slot, index) => ({
  id: `local-group-${index + 1}`,
  name: slot.groupName,
  active: true,
  memberIds: [],
}))

export default function App() {
  const [meetings, setMeetings] = useState<{ upcoming: Meeting[]; archive: Meeting[] }>({
    upcoming: isSupabaseConfigured ? [] : [upcomingMeeting],
    archive: [],
  })
  const [view, setView] = useState<MeetingView>('upcoming')
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [groups, setGroups] = useState<ResearchGroup[]>(isSupabaseConfigured ? [] : localGroups)
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(
    () => new URLSearchParams(window.location.search).get('password_setup') === '1',
  )
  const repository = useMemo(() => supabase ? createMeetingRepository(supabase) : null, [])

  const loadMeetings = useCallback(async () => {
    if (!repository) return
    try {
      setMeetings(await repository.getMeetings(getSingaporeTodayISO()))
      setCloudError(null)
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Unable to load meetings.')
    }
  }, [repository])

  const loadGroups = useCallback(async () => {
    if (!repository) return
    try {
      setGroups(await repository.getGroups())
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Unable to load groups.')
    }
  }, [repository])

  const hydrateSession = useCallback(async (nextUser: User | null) => {
    if (!repository) return
    setUser(nextUser)
    const nextProfile = nextUser ? await repository.getProfile(nextUser.id) : null
    setProfile(nextProfile)
    await Promise.all([loadMeetings(), loadGroups()])
    if (nextProfile?.role === 'admin') {
      setProfiles(await repository.getProfiles())
    } else {
      setProfiles([])
    }
  }, [loadGroups, loadMeetings, repository])

  useEffect(() => {
    if (!supabase || !repository) return
    void Promise.all([loadMeetings(), loadGroups()])
    void supabase.auth.getUser().then(({ data }) => hydrateSession(data.user))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => void hydrateSession(session?.user ?? null), 0)
    })
    return () => data.subscription.unsubscribe()
  }, [hydrateSession, loadGroups, loadMeetings, repository])

  async function signInWithPassword(identity: string, password: string) {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    const email = resolveLoginIdentity(identity)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function sendPasswordLink(identity: string) {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    if (isSharedLogin(identity)) throw new Error('Shared account passwords are managed by the CRP administrator.')
    const email = resolveLoginIdentity(identity)
    const redirect = new URL(window.location.origin)
    redirect.searchParams.set('password_setup', '1')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString(), shouldCreateUser: true },
    })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    if (password.length < 10) throw new Error('Use at least 10 characters.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setNeedsPasswordSetup(false)
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
  }

  async function uploadSlides(_meeting: Meeting, slot: AgendaSlot, displayName: string, file: File) {
    if (!repository || !user) throw new Error('Sign in before uploading slides.')
    await repository.uploadSlideFile(slot.id, displayName, file)
    await loadMeetings()
  }

  async function download(bucket: 'slides' | 'minutes' | 'archive-lab-files', path?: string) {
    if (!repository || !path) return
    window.location.assign(await repository.getDownloadUrl(bucket, path))
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => setView('upcoming')} aria-label="CRP Meeting Hub home">
          <span className="brand-mark"><FolderKanban aria-hidden="true" size={20} /></span>
          <span>CRP Meeting Hub</span>
        </button>
        <nav aria-label="Meeting views">
          <button className={view === 'upcoming' ? 'active' : ''} type="button" onClick={() => setView('upcoming')}>
            <CalendarDays aria-hidden="true" size={16} /> Upcoming
          </button>
          <button className={view === 'archive' ? 'active' : ''} type="button" onClick={() => setView('archive')}>
            <Archive aria-hidden="true" size={16} /> Archive
          </button>
        </nav>
        <span className="access-label">{user ? 'Member workspace' : 'Internal workspace'}</span>
      </header>

      <main id="top">
        <div className={`configuration-notice ${isSupabaseConfigured ? 'cloud-ready' : ''}`} role="status">
          {isSupabaseConfigured ? <Cloud aria-hidden="true" size={18} /> : <CloudOff aria-hidden="true" size={18} />}
          <div className="cloud-copy">
            <p><strong>{isSupabaseConfigured ? 'Private member workspace.' : 'Local preview.'}</strong></p>
            {cloudError && <p className="cloud-error" role="alert">{cloudError}</p>}
            {isSupabaseConfigured && user && !profile && <p className="cloud-error">This account is not on the CRP member list.</p>}
          </div>
          {isSupabaseConfigured && (
            <AuthPanel
              user={user}
              needsPasswordSetup={needsPasswordSetup}
              onPasswordSignIn={signInWithPassword}
              onPasswordLink={sendPasswordLink}
              onPasswordUpdate={updatePassword}
              onSignOut={async () => { await supabase?.auth.signOut() }}
            />
          )}
        </div>

        <MeetingCollection
          view={view}
          meetings={meetings[view]}
          profile={profile}
          onUploadSlides={isSupabaseConfigured ? uploadSlides : undefined}
          onDownloadSlides={user && profile ? (_meeting, file) => download('slides', file.objectPath) : undefined}
          onRemoveSlides={user && profile && repository ? async (_meeting, file: SlideFile) => {
            await repository.deleteSlideFile(file)
            await loadMeetings()
          } : undefined}
          onUploadMinutes={isAdmin && repository && user ? async (meeting, file) => {
            await repository.uploadMinutes(meeting.id, user.id, file)
            await loadMeetings()
          } : undefined}
          onDownloadMinutes={user && profile ? (meeting) => download('minutes', meeting.minutesObjectPath) : undefined}
          onUploadArchiveFiles={user && profile && repository ? async (meeting, groupId, files) => {
            try {
              for (const file of files) await repository.uploadArchiveLabFile(meeting.id, groupId, file)
            } finally {
              await loadMeetings()
            }
          } : undefined}
          onDownloadArchiveFile={user && profile ? (_meeting, file: ArchiveLabFile) => download('archive-lab-files', file.objectPath) : undefined}
        />

        {isAdmin && repository && (
          <AdminPanel
            profiles={profiles}
            groups={groups}
            meetings={meetings.upcoming}
            onCreateMeeting={async (draft: MeetingDraft) => {
              await repository.createMeeting(draft)
              await loadMeetings()
              setView('upcoming')
            }}
            onUpdateMeeting={async (meetingId, draft) => {
              await repository.updateMeetingSchedule(meetingId, draft)
              await loadMeetings()
            }}
            onRegisterHistoricalMeeting={async (draft: HistoricalMeetingDraft) => {
              await repository.registerHistoricalMeeting(draft)
              await loadMeetings()
              setView('archive')
            }}
            onCreateGroup={async (name) => {
              await repository.createGroup(name)
              await loadGroups()
            }}
            onUpdateGroup={async (groupId, updates) => {
              await repository.updateGroup(groupId, updates)
              await loadGroups()
            }}
            onSetGroupMember={async (groupId, profileId, enabled) => {
              await repository.setGroupMember(groupId, profileId, enabled)
              await Promise.all([loadGroups(), loadMeetings()])
            }}
          />
        )}
      </main>

      <footer>
        <p>CRP Grant Collaboration</p>
        <p>Singapore | Internal research use</p>
      </footer>
    </div>
  )
}
