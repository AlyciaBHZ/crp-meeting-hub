# Named Slide PDF Collections

## Goal

Replace the single replaceable Slides file on each agenda slot with a private collection of up to 20 named PDF files for that Lab in that meeting.

## User Experience

Each agenda row contains a compact Slides section. An authorized member enters a required `Presenter / document name`, selects one PDF, and uploads it. The section shows the current count (`0 / 20 PDFs`) and lists every uploaded item with its display name, original filename, file size, and a download action.

The shared member account can upload for every participating Lab because it is assigned to all six Labs. Administrators can upload for every Lab. Public visitors see upload status and counts but never receive private file paths or download links. Signed-in members may download the files.

New uploads accept PDF only, with a maximum size of 50 MB per file. Upload is disabled when the Lab reaches 20 files for that meeting. The database enforces the same rules transactionally, so concurrent uploads cannot exceed the limit.

## Data Model

Add `slide_files`, keyed by file ID and linked to an `agenda_slot`. Each row stores the required display name, original filename, private Storage object path, size, uploader, and timestamp. A unique object path uses `<agenda-slot-id>/<file-id>.pdf`.

The existing `slides` Storage bucket remains private and is restricted to PDF uploads. The old single-file `resources(kind = 'slides')` path is retired from application reads and writes. Production currently contains zero legacy Slides resources, so no data migration is required.

## Security And Transactions

An authenticated member reserves metadata through `reserve_slide_file`. The function verifies membership, validates the display name, PDF extension, size, agenda-slot access, and the 20-file limit under an advisory transaction lock. Storage accepts an object only when a matching reservation belongs to the current user.

If Storage upload fails, the client calls `cancel_slide_file` to release its reservation. Reservation cancellation is scoped to the uploader or an administrator. Downloads use the existing 60-second signed URL flow.

## Application Changes

`MeetingRepository` loads `slide_files` separately, maps them into each agenda slot, reserves before upload, and cancels failed reservations. `Agenda` replaces its hidden single-file input and Replace button with the named PDF collection control. Upload validation checks the required display name, PDF extension, 50 MB limit, and remaining per-slot capacity.

## Failure Handling

Validation errors appear beside the relevant Lab before any network request. Reservation errors, Storage errors, and the 20-file limit return actionable messages. The input and file chooser reset only after success; a failed upload retains the entered display name so the user can retry.

## Verification

Automated tests cover PDF-only validation, required display names, 20-file capacity, repository reservation/upload/cancellation, cloud mapping, component behavior, and migration contracts. Production verification uses the shared member account to upload a small generated PDF with a name, confirm it appears and downloads, then removes the diagnostic record and object so the meeting remains clean.
