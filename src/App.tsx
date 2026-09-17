import type { User } from '@supabase/supabase-js'
import { Archive, CalendarDays, Cloud, CloudOff, FolderKanban } from 'lucide-react'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { createDiscussionRepository } from './services/discussionRepository'
import { passwordSetupLink, readMeetingTarget } from './services/meetingLinks'
import type { PdfResource } from './data/discussion'

const PdfPreview = lazy(() => import('./components/PdfPreview'))

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
  const [target, setTarget] = useState(() => readMeetingTarget(window.location.search))
  const [preview, setPreview] = useState<PdfResource | null>(null)
  const sessionGeneration = useRef(0)
  const sessionUserId = useRef<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [groups, setGroups] = useState<ResearchGroup[]>(isSupabaseConfigured ? [] : localGroups)
  const [profiles, setProfiles] = useState<ProfileRecord[]>([])
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [adminRequest, setAdminRequest] = useState<{ meetingId?: string; mode: 'upcoming' | 'past'; groups?: boolean; key: number } | null>(null)
  const adminRef = useRef<HTMLDivElement>(null)
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(
    () => new URLSearchParams(window.location.search).get('password_setup') === '1',
  )
  const repository = useMemo(() => supabase ? createMeetingRepository(supabase) : null, [])
  const discussionRepository = useMemo(() => supabase ? createDiscussionRepository(supabase) : undefined, [])
  const loadPdf = useCallback((resource: PdfResource) => repository!.getPdfBlob(resource.bucket, resource.path), [repository])

  function navigate(nextView: MeetingView) {
    const url = new URL(window.location.href)
    url.searchParams.delete('meeting')
    url.searchParams.delete('group')
    window.history.pushState({}, '', url)
    setTarget(null)
    setView(nextView)
  }

  useEffect(() => {
    const onPopState = () => setTarget(readMeetingTarget(window.location.search))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    if (!target) return
    if (meetings.archive.some((meeting) => meeting.id === target.meetingId)) setView('archive')
    else if (meetings.upcoming.some((meeting) => meeting.id === target.meetingId)) setView('upcoming')
  }, [target, meetings])

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
    const generation = ++sessionGeneration.current
    const nextId = nextUser?.id ?? null
    if (sessionUserId.current !== nextId) {
      setPreview(null)
      setProfile(null)
      setProfiles([])
      sessionUserId.current = nextId
    }
    setUser(nextUser)
    const nextProfile = nextUser ? await repository.getProfile(nextUser.id) : null
    if (generation !== sessionGeneration.current) return
    setProfile(nextProfile)
    await Promise.all([loadMeetings(), loadGroups()])
    if (generation !== sessionGeneration.current) return
    if (nextProfile?.role === 'admin') {
      const nextProfiles = await repository.getProfiles()
      if (generation === sessionGeneration.current) setProfiles(nextProfiles)
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
    const redirect = passwordSetupLink(window.location.href)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect, shouldCreateUser: true },
    })
    if (error) throw error
  }

  async function updatePassword(password: string) {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    if (password.length < 10) throw new Error('Use at least 10 characters.')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    setNeedsPasswordSetup(false)
    const url = new URL(window.location.href)
    url.searchParams.delete('password_setup')
    window.history.replaceState({}, '', url)
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

  function openAdmin(options: { meetingId?: string; mode: 'upcoming' | 'past'; groups?: boolean }) {
    setAdminRequest({ ...options, key: Date.now() })
  }

  useEffect(() => {
    if (!adminRequest || !isAdmin) return
    const target = adminRequest.groups ? document.getElementById('groups-heading') : adminRef.current
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    target?.focus({ preventScroll: true })
  }, [adminRequest, isAdmin])

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" type="button" onClick={() => navigate('upcoming')} aria-label="CRP Meeting Hub home">
          <span className="brand-mark"><FolderKanban aria-hidden="true" size={20} /></span>
          <span>CRP Meeting Hub</span>
        </button>
        <nav aria-label="Meeting views">
          <button className={view === 'upcoming' ? 'active' : ''} type="button" onClick={() => navigate('upcoming')}>
            <CalendarDays aria-hidden="true" size={16} /> Upcoming
          </button>
          <button className={view === 'archive' ? 'active' : ''} type="button" onClick={() => navigate('archive')}>
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

        {target && meetings.upcoming.length + meetings.archive.length > 0 && ![...meetings.upcoming, ...meetings.archive].some((meeting) => meeting.id === target.meetingId) && <p role="status">This meeting link is unavailable. Browse the meetings below.</p>}
        <MeetingCollection
          view={view}
          meetings={meetings[view]}
          profile={profile}
          target={target}
          discussionRepository={discussionRepository}
          onPreview={user && profile && repository ? setPreview : undefined}
          onCreateMeeting={() => openAdmin({ mode: view === 'archive' ? 'past' : 'upcoming' })}
          onEditMeeting={(meeting) => openAdmin({ meetingId: meeting.id, mode: 'upcoming' })}
          onManageGroups={() => openAdmin({ mode: 'upcoming', groups: true })}
          onUploadSlides={isSupabaseConfigured ? uploadSlides : undefined}
          onDownloadSlides={user && profile ? (_meeting, file) => download('slides', file.objectPath) : undefined}
          onRemoveSlides={user && profile && repository ? async (_meeting, file: SlideFile) => {
            await repository.deleteSlideFile(file)
            await loadMeetings()
          } : undefined}
          onUploadMinutes={isAdmin && repository && user ? async (meeting, file) => {
            try { await repository.uploadMinutes(meeting.id, user.id, file) }
            finally { await loadMeetings() }
          } : undefined}
          onDownloadMinutes={user && profile ? (meeting) => download('minutes', meeting.minutesObjectPath) : undefined}
          onDownloadArchiveFile={user && profile ? (_meeting, file: ArchiveLabFile) => download('archive-lab-files', file.objectPath) : undefined}
          onRemoveArchiveFile={isAdmin && repository ? async (_meeting, file) => {
            await repository.deleteArchiveLabFile(file)
            await loadMeetings()
          } : undefined}
          onRemoveMinutes={isAdmin && repository ? async (meeting) => {
            try { await repository.deleteMinutes(meeting) }
            finally { await loadMeetings() }
          } : undefined}
        />

        {isAdmin && repository && adminRequest && (
          <div ref={adminRef} tabIndex={-1} className="admin-anchor">
          <AdminPanel
            key={adminRequest.key}
            initialMeetingId={adminRequest.meetingId}
            initialMode={adminRequest.mode}
            onClose={() => setAdminRequest(null)}
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
          </div>
        )}
      </main>

      {preview && user && profile && repository && <Suspense fallback={<p role="status">Opening PDF preview… <button type="button" onClick={() => setPreview(null)}>Cancel</button></p>}><PdfPreview key={preview.bucket + preview.path + preview.page} resource={preview} load={loadPdf} onClose={() => setPreview(null)} onDownload={() => download(preview.bucket, preview.path)} /></Suspense>}

      <footer>
        <p>CRP Grant Collaboration</p>
        <p>Singapore | Internal research use</p>
      </footer>
    </div>
  )
}
