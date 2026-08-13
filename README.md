# CRP Meeting Hub

A lightweight workspace for CRP grant meeting agendas, private presentation slides, member access, and post-meeting minutes. The hosted application uses Supabase Auth, PostgreSQL, and private Storage.

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

- Upcoming meeting summary with date and venue placeholders
- Six presentation slots from 9:00 AM to 11:00 AM
- 15-minute presentation and 5-minute Q&A format
- Passwordless email sign-in for approved members
- Private PDF, PPT, and PPTX slide uploads up to 50 MB
- Private PDF, DOCX, and Markdown meeting-minutes uploads up to 50 MB
- 60-second signed download links
- Administrator member allowlist, presenter assignment, date, and venue controls
- Responsive desktop and mobile layouts

Without local Supabase environment variables, the application intentionally runs in local-preview mode and does not claim to upload selected files.

## Free Hosting Architecture

The frontend is deployed from this repository on Vercel. The shared data layer uses Supabase Free Tier:

- Supabase Auth for presenter and administrator login
- PostgreSQL for meetings, agenda slots, and file metadata
- Private Storage buckets for slides and minutes
- Row-level security so presenters can modify only their own slot
- Short-lived signed URLs for downloads

Copy `.env.example` to `.env.local` and use the Supabase project URL plus its publishable key. Never commit CLI tokens, service-role keys, attendee information, meeting files, or unpublished research data to this public repository.

## Member Workflow

1. An administrator signs in with an approved email.
2. The administrator adds each team member email in **Members and assignments**.
3. The member requests a secure sign-in link from the website and opens the email link.
4. After that first sign-in, the administrator assigns the member to their presentation group.
5. The presenter can upload or replace slides only for that assigned group.

Visitors can see the schedule. Only approved signed-in members can see private resource metadata or download files. Storage objects use private buckets and short-lived signed URLs.

## Editing The Agenda

The administrator edits the meeting date, venue, membership, and presenter assignments in the hosted application. `src/data/meeting.ts` remains the local-preview fallback.

## Database Changes

Versioned SQL migrations live in `supabase/migrations`. Local project-link data and administrator bootstrap values live under `supabase/.temp` and are ignored by Git.

## Repository Privacy

The source code is designed to be public. Real slides and meeting minutes are not. `.gitignore` excludes local PowerPoint files and upload directories as an additional safeguard.
