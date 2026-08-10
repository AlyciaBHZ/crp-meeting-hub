# CRP Meeting Hub Design

## Purpose

Create a lightweight meeting portal for a CRP grant collaboration of about ten people meeting once every two months. Presenters upload slides before each meeting, everyone can see the agenda, and an administrator publishes meeting minutes afterward.

## First Release Scope

- Show the upcoming CRP meeting as the first screen.
- State the meeting format: 15 minutes of presentation and 5 minutes of Q&A per group.
- Show the six supplied presentation slots from 9:00 AM to 11:00 AM.
- Give every group a clear slides upload action and upload-status area.
- Give the administrator a meeting-minutes upload area.
- Keep meeting content in typed data rather than embedding it in page markup.
- Prepare the repository for later Supabase authentication, database, and private file storage.
- Provide responsive desktop and mobile layouts.

The first repository version uses local sample data. It does not pretend that files selected in a browser are shared online. Real shared uploads require Supabase configuration and will be added through the prepared data boundary.

## Users And Permissions

- Visitor: views the agenda and any resources marked as available.
- Presenter: uploads or replaces slides for their own presentation slot after authentication is added.
- Administrator: creates meetings, edits the agenda, and uploads minutes.

Authentication and write permissions are a deployment concern. The public source repository must never contain real uploaded files, credentials, email lists, or unpublished research material.

## Information Architecture

The page has a compact product header, an upcoming-meeting summary band, a chronological agenda, and a resources panel. The agenda is the primary working surface. Each row contains time, group name, presentation format, upload state, and upload action. The resources panel separates presentation files from post-meeting minutes.

## Data Model

`Meeting` contains an identifier, title, optional date and venue, timezone, status, presentation/Q&A durations, and ordered agenda slots. `AgendaSlot` contains start/end times, group name, speaker information when known, and optional slide metadata. Missing date, venue, speaker, or file information is represented explicitly rather than invented.

## Architecture

React and TypeScript render the site. Meeting data lives behind a focused module so a Supabase repository can replace sample data without changing presentation components. File validation is a pure utility and accepts PDF, PPT, and PPTX files up to 50 MB. Vite builds the static frontend; Vitest and Testing Library verify data integrity and user-visible behavior.

The eventual hosted data flow is: browser -> Supabase Auth -> row-level security -> PostgreSQL metadata and private Storage objects. Downloads will use short-lived signed URLs. Vercel or Cloudflare Pages will host the frontend from the public GitHub repository.

## Error Handling

- Missing date or venue is displayed as "To be confirmed".
- Invalid upload formats receive a specific message.
- Oversized files receive a size-limit message.
- Cloud configuration failures must not claim that a file was uploaded.
- An unavailable resource remains visibly marked as awaiting upload.

## Testing

- Data tests verify all six groups, chronological contiguous slots, and 20-minute durations.
- Component tests verify the meeting format, agenda, upload actions, and minutes state.
- Utility tests verify accepted file formats, rejected formats, and the 50 MB limit.
- A production build verifies TypeScript and bundling.

## Deployment And Cost

The source code is suitable for a public GitHub repository. The frontend can use a free Vercel or Cloudflare Pages tier. Supabase's free tier is sufficient for the expected group size and meeting frequency. A custom domain is optional and is the only predictable initial cost.

