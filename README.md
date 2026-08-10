# CRP Meeting Hub

A lightweight workspace for CRP grant meeting agendas, presentation slides, and post-meeting minutes. The initial screen contains the supplied six-group agenda and runs entirely as a local preview.

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
- Local file selection and validation for PDF, PPT, and PPTX slides up to 50 MB
- Administrator-only meeting-minutes placeholder
- Responsive desktop and mobile layouts

Selecting a file in this version does **not** upload it to a shared service. The interface says this explicitly. Shared uploads will be enabled only after private cloud storage and access controls are configured.

## Free Hosting Architecture

The frontend can be deployed from this repository on Vercel or Cloudflare Pages for free. The planned shared data layer is Supabase Free Tier:

- Supabase Auth for presenter and administrator login
- PostgreSQL for meetings, agenda slots, and file metadata
- Private Storage buckets for slides and minutes
- Row-level security so presenters can modify only their own slot
- Short-lived signed URLs for downloads

Copy `.env.example` to `.env.local` only after creating the Supabase project. Never commit credentials, attendee information, meeting files, or unpublished research data to this public repository.

## Editing The Agenda

Until the administrator interface is connected, edit `src/data/meeting.ts`. Meeting data is separate from page components so it can later be replaced by database records without redesigning the interface.

## Repository Privacy

The source code is designed to be public. Real slides and meeting minutes are not. `.gitignore` excludes local PowerPoint files and upload directories as an additional safeguard.

