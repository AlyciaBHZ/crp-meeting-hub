import type { User } from '@supabase/supabase-js'
import { Cloud, CloudOff, FolderKanban } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Agenda } from './components/Agenda'
import { AdminPanel } from './components/AdminPanel'
import { AuthPanel } from './components/AuthPanel'
import { MeetingSummary } from './components/MeetingSummary'
import { Resources } from './components/Resources'
import type { AgendaSlot, Meeting } from './data/meeting'
import { upcomingMeeting } from './data/meeting'
import { canManageSlot, mapCloudMeeting, type MemberProfile } from './services/meetingAccess'
import { createMeetingRepository } from './services/meetingRepository'
import { isSupabaseConfigured, supabase } from './services/supabaseClient'

export default function App() {
  const [meeting, setMeeting] = useState<Meeting>(upcomingMeeting)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [cloudError, setCloudError] = useState<string | null>(null)
  const [profiles, setProfiles] = useState<Array<{ id: string; email: string; display_name?: string | null; role: 'presenter' | 'admin' }>>([])
  const repository = useMemo(() => supabase ? createMeetingRepository(supabase) : null, [])

  const loadMeeting = useCallback(async () => {
    if (!repository) return
    try {
      const result = await repository.getUpcomingMeeting()
      setMeeting(mapCloudMeeting(result.meeting, result.slots, result.minutes))
      setCloudError(null)
    } catch (error) {
      setCloudError(error instanceof Error ? error.message : 'Unable to load the meeting workspace.')
    }
  }, [repository])

  useEffect(() => {
    if (!supabase || !repository) return
    void loadMeeting()
    void supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user)
      setProfile(data.user ? await repository.getProfile(data.user.id) : null)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      void (session?.user
        ? repository.getProfile(session.user.id).then((nextProfile) => {
            setProfile(nextProfile)
            return loadMeeting()
          })
        : Promise.resolve(setProfile(null)))
    })
    return () => data.subscription.unsubscribe()
  }, [loadMeeting, repository])

  async function sendMagicLink(email: string) {
    if (!supabase) throw new Error('Cloud sign-in is not configured.')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
  }

  async function uploadSlides(slot: AgendaSlot, file: File) {
    if (!repository || !user) throw new Error('Sign in before uploading slides.')
    await repository.uploadSlides(slot.id, user.id, file)
    await loadMeeting()
  }

  async function download(bucket: 'slides' | 'minutes', path?: string) {
    if (!repository || !path) return
    const url = await repository.getDownloadUrl(bucket, path)
    window.location.assign(url)
  }

  const isAdmin = profile?.role === 'admin'

  useEffect(() => {
    if (isAdmin && repository) void repository.getProfiles().then(setProfiles)
  }, [isAdmin, repository])

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="CRP Meeting Hub home">
          <span className="brand-mark"><FolderKanban aria-hidden="true" size={20} /></span>
          <span>CRP Meeting Hub</span>
        </a>
        <nav aria-label="Primary navigation">
          <a className="active" href="#agenda">Upcoming</a>
          <a href="#records">Records</a>
        </nav>
        <span className="access-label">{user ? 'Member workspace' : 'Internal workspace'}</span>
      </header>

      <main id="top">
        <MeetingSummary meeting={meeting} />
        <div className={`configuration-notice ${isSupabaseConfigured ? 'cloud-ready' : ''}`} role="status">
          {isSupabaseConfigured ? <Cloud aria-hidden="true" size={18} /> : <CloudOff aria-hidden="true" size={18} />}
          <div className="cloud-copy">
            <p>
              <strong>{isSupabaseConfigured ? 'Private cloud workspace.' : 'Local preview.'}</strong>{' '}
              {isSupabaseConfigured ? 'Sign in with an approved member email to upload and download files.' : 'Selected files stay on this device until private cloud storage is connected.'}
            </p>
            {cloudError && <p className="cloud-error" role="alert">{cloudError}</p>}
            {isSupabaseConfigured && user && !profile && <p className="cloud-error">This account is signed in but is not yet on the CRP member list.</p>}
          </div>
          {isSupabaseConfigured && (
            <AuthPanel
              user={user}
              onMagicLink={sendMagicLink}
              onSignOut={async () => { await supabase?.auth.signOut() }}
            />
          )}
        </div>
        <div id="agenda">
          <Agenda
            meeting={meeting}
            cloudMode={isSupabaseConfigured}
            canUpload={(slot) => !isSupabaseConfigured || canManageSlot(profile, slot)}
            onUpload={isSupabaseConfigured ? uploadSlides : undefined}
            onDownload={user && profile ? (slot) => download('slides', slot.slideObjectPath) : undefined}
          />
        </div>
        <div id="records">
          <Resources
            meeting={meeting}
            isAdmin={isAdmin}
            onUpload={isAdmin && repository && user ? async (file) => {
              await repository.uploadMinutes(meeting.id, user.id, file)
              await loadMeeting()
            } : undefined}
            onDownload={user && profile && meeting.minutesObjectPath ? () => download('minutes', meeting.minutesObjectPath) : undefined}
          />
        </div>
        {isAdmin && repository && (
          <AdminPanel
            meeting={meeting}
            profiles={profiles}
            slots={meeting.slots}
            onAddMember={async (email, role) => {
              await repository.addMember(email, role)
              setProfiles(await repository.getProfiles())
            }}
            onAssign={async (slotId, presenterId) => {
              await repository.assignPresenter(slotId, presenterId)
              await loadMeeting()
            }}
            onUpdateMeeting={async (date, venue) => {
              await repository.updateMeeting(meeting.id, { meeting_date: date || null, venue: venue || null })
              await loadMeeting()
            }}
          />
        )}
      </main>

      <footer>
        <p>CRP Grant Collaboration</p>
        <p>Singapore · Internal research use</p>
      </footer>
    </div>
  )
}
