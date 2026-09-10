# Meeting interaction improvements

The user approved improving interaction and publishing directly to the existing site. This release adds private PDF previews, meeting/group permalinks, and signed group discussions. Existing scheduling, uploads, archive folding, and minutes remain the meeting foundation.

PDFs load through authenticated Supabase storage and render locally with PDF.js. A modal offers fit width, zoom, page navigation, original download, and Escape/close with focus restoration. Only PDF minutes receive preview; other supported minutes formats remain downloadable. The viewer loads on demand.

Permalinks contain only meeting and optional group IDs. Opening a link locates the meeting in Upcoming or Archive, expands it, and focuses the selected group. Login retains the target. No storage credentials or signed download URL are copied.

Approved members can ask and reply across groups, entering their own name and affiliation because accounts may be shared. Optional references bind to a PDF belonging to that meeting group and a page number. The original filename is retained if a file is removed. Assigned group members and admins can mark questions Open, Discuss at meeting, Answered, or Follow-up needed. Discussion loads when expanded and refreshes manually or on window focus. Names are self-entered signatures, not verified individual identities.

The database exposes read-only RLS tables and validated write RPCs. Existing discussions prevent their agenda slot being reassigned to another group or meeting. Existing research materials must be preserved during migration. Notifications, personal identities, action-item tracking and full-text search are outside this release.

Implementation and validation: integrate preview and link actions into existing cards, implement Q&A tables/repository/UI, run component and real SQL permission tests, exercise desktop/mobile with synthetic private fixtures, build, migrate transactionally, then publish through the existing GitHub/Vercel pipeline.
