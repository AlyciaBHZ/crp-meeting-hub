import { CloudOff, FolderKanban } from 'lucide-react'
import { Agenda } from './components/Agenda'
import { MeetingSummary } from './components/MeetingSummary'
import { Resources } from './components/Resources'
import { upcomingMeeting } from './data/meeting'

export default function App() {
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
        <span className="access-label">Internal workspace</span>
      </header>

      <main id="top">
        <MeetingSummary meeting={upcomingMeeting} />
        <div className="configuration-notice" role="status">
          <CloudOff aria-hidden="true" size={18} />
          <p><strong>Local preview.</strong> Selected files stay on this device until private cloud storage is connected.</p>
        </div>
        <div id="agenda"><Agenda meeting={upcomingMeeting} /></div>
        <div id="records"><Resources /></div>
      </main>

      <footer>
        <p>CRP Grant Collaboration</p>
        <p>Singapore · Internal research use</p>
      </footer>
    </div>
  )
}

