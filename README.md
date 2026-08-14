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

- Multiple upcoming meetings, each with its own date and private Zoom link
- Reusable research groups with approved group members
- A different selection and order of presenting groups for every meeting
- Exact start and end time controls for every agenda slot
- Shared username or personal email and password sign-in
- Email-link password setup and reset flow
- Private PDF, PPT, and PPTX slide uploads up to 50 MB
- Private PDF, DOCX, and Markdown meeting-minutes uploads up to 50 MB
- 60-second signed download links
- Automatic archive placement based on the Singapore calendar date
- Administrator registration of past meetings without obsolete Zoom links
- Private Archive PDF collections grouped by Lab and meeting
- Multiple PDF uploads with a 20-file limit per Lab per meeting
- Slide and minutes replacement before or after a meeting moves to Archive
- Administrator controls for meetings, groups, memberships, and administrator access
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

The small CRP team may use centrally managed shared usernames. These aliases resolve to private Supabase Auth identities in the application; their passwords are configured directly in Supabase and are never committed to the repository.

For individual accounts:

1. An administrator adds a team member's email under **Members and access**.
2. The member uses **Set up or reset password** and opens the link sent by Supabase.
3. The member chooses a password and subsequently signs in with email and password.
4. The administrator assigns the activated member to one or more research groups.
5. The member can upload or replace slides for those groups whenever they are scheduled.
6. In Archive, the member selects one of their participating Labs and uploads up to 20 PDFs for that Lab and meeting.

Visitors can see meeting dates and agendas. Only approved signed-in members can see Zoom links, private resource metadata, or download files. Storage objects use private buckets and short-lived signed URLs.

## Administrator Workflow

Administrators create a meeting by choosing a date, entering its Zoom URL, selecting the groups presenting in that meeting, ordering them, and setting exact start and end times. Existing upcoming meetings can be edited in the same workspace. A meeting moves to **Archive** automatically after its date; there is no manual archive action or upload-completeness requirement.

For meetings that happened before this workspace was introduced, administrators use **Past meeting** to register the original date, participating Labs, order, and times. Historical meetings do not require or retain an obsolete Zoom link. In Archive, administrators may upload PDFs for any Lab that participated in that meeting; presenters can upload only for their assigned Labs. The database enforces the 20-PDF limit transactionally.

Administrators can also add or rename research groups, deactivate groups that are no longer in use, assign activated members to groups, approve new presenters, and add additional administrators. `src/data/meeting.ts` remains the local-preview fallback when Supabase environment variables are absent.

## Database Changes

Versioned SQL migrations live in `supabase/migrations`. Local project-link data and administrator bootstrap values live under `supabase/.temp` and are ignored by Git.

## Repository Privacy

The source code is designed to be public. Real slides and meeting minutes are not. `.gitignore` excludes local PowerPoint files and upload directories as an additional safeguard.
