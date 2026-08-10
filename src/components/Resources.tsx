import { FileText, LockKeyhole, Upload } from 'lucide-react'

export function Resources() {
  return (
    <section className="resources-section" aria-labelledby="resources-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">After the meeting</p>
          <h2 id="resources-heading">Meeting records</h2>
        </div>
      </div>

      <div className="minutes-row">
        <div className="resource-icon"><FileText aria-hidden="true" size={22} /></div>
        <div className="resource-copy">
          <h3>Meeting minutes</h3>
          <p>Available after the meeting</p>
        </div>
        <span className="admin-note"><LockKeyhole aria-hidden="true" size={15} /> Admin only</span>
        <button className="secondary-button" type="button" disabled title="Connect Supabase to enable administrator uploads">
          <Upload aria-hidden="true" size={17} /> Upload minutes
        </button>
      </div>
    </section>
  )
}

