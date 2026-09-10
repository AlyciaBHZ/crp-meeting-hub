# CRP Meeting Hub

A small, reusable workspace for recurring online CRP grant meetings. Administrators schedule each meeting and choose its presenters; approved group members upload slides, and administrators upload minutes. The hosted application uses Supabase Auth, PostgreSQL, and private Storage.

## Local Development

```bash
npm install
npm run dev
```

Run verification with:

```bash
npm test
npm run build
```

## Current Scope

- Multiple upcoming meetings, each with its own editable title, date, format, and private Zoom link
- Reusable research groups with approved group members
- A different selection and order of presenting groups for every meeting
- Exact start and end time controls for every agenda slot
- Direct administrator New meeting, Edit meeting, and Groups and members actions
- A Singapore meeting start time that shifts the agenda while preserving breaks and group ownership
- Shared username or personal email and password sign-in
- Email-link password setup and reset flow
- Private named PDF slide collections, up to 20 files per Lab per meeting and 50 MB per file
- Private PDF, DOCX, and Markdown meeting-minutes uploads up to 50 MB
- 60-second signed download links
- Automatic archive placement based on the Singapore calendar date
- Archive cards ordered newest first, with the latest meeting expanded initially
- Expand/collapse controls for each meeting, plus a bottom collapse action that returns to its header
- Independent minutes status, upload/replace, and download controls remain visible even when a meeting is collapsed
- Administrator registration of past meetings without obsolete Zoom links
- A single PDF list inside each group's agenda card, including previously uploaded Archive files
- One combined 20-PDF limit per group per meeting, enforced across both storage collections
- PDF upload before and after the meeting, with administrator-managed minutes in the same meeting
- Administrator controls for meetings, groups, and Lab assignments
- Responsive desktop and mobile layouts

Without local Supabase environment variables, the application intentionally runs in local-preview mode and does not claim to upload selected files.

## Free Hosting Architecture

The frontend is deployed from this repository on Vercel. The shared data layer uses Supabase Free Tier:

- Supabase Auth for member and administrator login
- PostgreSQL for meetings, reusable groups, agenda slots, and file metadata
- Private Storage buckets for slides, minutes, and Archive Lab PDFs
- Row-level security so group members can modify only their group's materials
- A private meeting-details table so public visitors never receive Zoom links
- Short-lived signed URLs for downloads

Copy `.env.example` to `.env.local` and use the Supabase project URL plus its publishable key. Never commit CLI tokens, service-role keys, attendee information, meeting files, or unpublished research data to this public repository.

## Member Workflow

The small CRP team uses centrally managed shared member and administrator usernames. These aliases resolve to private Supabase Auth identities in the application; their passwords are configured directly in Supabase and are never committed to the repository. The administrator workspace intentionally does not create additional user accounts.

1. Members sign in with the shared member credentials.
2. In Upcoming or Archive, the shared member opens the scheduled group's agenda card, enters a presenter or document name, chooses a PDF, and uploads it.
3. Each scheduled Lab can hold up to 20 slide PDFs for that meeting. Every PDF is private, limited to 50 MB, and remains individually downloadable.
4. The same group PDF list is used in Archive. Existing Archive PDFs appear alongside named slide PDFs and count toward the same 20-file limit. Existing files stay in their original private storage locations; no file copy or deletion is required.

Visitors can see meeting dates and agendas. Only approved signed-in members can see Zoom links, private resource metadata, or download files. Storage objects use private buckets and short-lived signed URLs.

## Administrator Workflow

Administrators select **New meeting** in Upcoming, then set the title, date, Singapore start time, presentation and Q&A durations, Zoom URL, presenting groups, order, and individual slot times. **Edit meeting** opens that meeting's existing values directly. Changing the overall start shifts all slots and preserves breaks, durations, and group/file ownership. **Groups and members** opens the group assignment controls. A meeting moves to **Archive** automatically after its date; there is no manual archive action or upload-completeness requirement.

For meetings that happened before this workspace was introduced, administrators use **Add past meeting** in Archive to register the original date, participating groups, order, and times. Historical meetings do not require or retain an obsolete Zoom link. Administrators may upload PDFs for any participating group; presenters can upload only for their assigned groups. The database transactionally enforces a single combined 20-PDF limit across old and new uploads. Existing collections above that limit are preserved, but cannot accept new PDFs. Administrators or the original uploader can remove a named slide PDF. Groups with attached PDFs are protected against removal or reassignment to preserve their files. Only administrators upload or replace minutes; approved members can download them.

Administrators can also add or rename research groups, deactivate groups that are no longer in use, and maintain Lab assignments for the existing shared account. Account credentials are managed centrally rather than through the website. `src/data/meeting.ts` remains the local-preview fallback when Supabase environment variables are absent.

## Database Changes

Versioned SQL migrations live in `supabase/migrations`. Local project-link data and administrator bootstrap values live under `supabase/.temp` and are ignored by Git.

Apply `20260910090000_unified_meeting_pdfs.sql` before deploying the unified interface. It permits named PDF uploads after the meeting, counts existing Archive files toward the combined limit, and protects both file collections during schedule edits. PostgreSQL behavior tests use PGlite locally and do not write to the hosted database.

## Repository Privacy

The source code is designed to be public. Real slides and meeting minutes are not. `.gitignore` excludes local PowerPoint files and upload directories as an additional safeguard.
