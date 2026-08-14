# Named Slide PDF Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authorized Lab upload, list, download, and remove up to 20 named PDF slide files for each meeting.

**Architecture:** A new private `slide_files` table owns one metadata row per PDF and uses reservation RPCs to enforce access and the 20-file limit transactionally. The React agenda maps those records into each slot and exposes a name-plus-PDF upload form; Storage remains private and downloads continue through 60-second signed URLs.

**Tech Stack:** React 19, TypeScript, Supabase PostgreSQL/RLS/Storage, Vitest, Testing Library, Vite, Vercel.

---

### Task 1: Slide File View Model And Mapping

**Files:**
- Modify: `src/data/meeting.ts`
- Modify: `src/services/meetingAccess.ts`
- Test: `src/services/meetingAccess.test.ts`

- [ ] **Step 1: Write the failing mapping test**

Add a `slide_files` fixture containing `id`, `agenda_slot_id`, `display_name`, `original_name`, `object_path`, `size_bytes`, `uploaded_by`, and `uploaded_at`; assert that `mapCloudMeeting` returns it as `slot.slideFiles[0]` with camel-cased fields and derives `slideStatus: 'uploaded'`.

- [ ] **Step 2: Run the mapping test and verify RED**

Run: `npm test -- src/services/meetingAccess.test.ts`

Expected: FAIL because `AgendaSlot` has no `slideFiles` collection and `mapCloudMeeting` does not accept slide-file rows.

- [ ] **Step 3: Add the minimal types and mapping**

Define:

```ts
export interface SlideFile {
  id: string
  agendaSlotId: string
  displayName: string
  originalName: string
  objectPath: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
}
```

Add `slideFiles: SlideFile[]` to `AgendaSlot`. Extend `mapCloudMeeting` with a final `slideFiles` argument, filter by `agenda_slot_id`, map database names to the interface, and derive `slideStatus` from collection length. Remove the old single Slides resource fallback while retaining the resources query for minutes.

- [ ] **Step 4: Run the mapping test and verify GREEN**

Run: `npm test -- src/services/meetingAccess.test.ts`

Expected: all tests pass.

### Task 2: Name, PDF, Size, And Capacity Validation

**Files:**
- Modify: `src/uploadValidation.ts`
- Test: `src/uploadValidation.test.ts`

- [ ] **Step 1: Write failing validation tests**

Replace the old PPT/PPTX expectations with tests for:

```ts
validateSlidePdf('Yang Li - immune adaptation', pdf, 19) === null
validateSlidePdf('   ', pdf, 0) === 'Enter a presenter or document name.'
validateSlidePdf('Name', pptx, 0) === 'Please choose a PDF file.'
validateSlidePdf('Name', pdf, 20) === 'Each Lab can upload up to 20 slide PDFs for this meeting.'
```

Keep the 50 MB boundary test.

- [ ] **Step 2: Run validation tests and verify RED**

Run: `npm test -- src/uploadValidation.test.ts`

Expected: FAIL because `validateSlidePdf` does not exist and old validation accepts PowerPoint files.

- [ ] **Step 3: Implement `validateSlidePdf`**

Validate in this order: nonblank trimmed display name up to 160 characters, one `.pdf` file, positive size no larger than 50 MB, and `existingCount < 20`. Export `MAX_SLIDE_FILES_PER_LAB = 20` and use the exact messages asserted above.

- [ ] **Step 4: Run validation tests and verify GREEN**

Run: `npm test -- src/uploadValidation.test.ts`

Expected: all tests pass.

### Task 3: Transactional Slide File Database Contract

**Files:**
- Create: `supabase/migrations/20260814190000_named_slide_files.sql`
- Create: `src/services/slideFilesMigration.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Assert that the migration contains `public.slide_files`, `reserve_slide_file`, `cancel_slide_file`, a limit comparison against 20, `pg_advisory_xact_lock`, `application/pdf`, `can_manage_agenda_slot`, authenticated grants, and private Storage policies scoped to matching reservations.

- [ ] **Step 2: Run the migration test and verify RED**

Run: `npm test -- src/services/slideFilesMigration.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Implement the migration**

Create `slide_files` with required display/original names, 50 MB size check, uploader, timestamps, and unique private object paths. Add authenticated member select and uploader/admin delete policies. Restrict the existing `slides` bucket to `application/pdf`. Replace old insert/update Storage policies with reservation-based select, insert, and delete policies.

Implement `reserve_slide_file(agenda_slot_id_input, display_name_input, original_name_input, size_bytes_input)` as a security-definer function that validates membership, the active/upcoming agenda slot, `can_manage_agenda_slot`, names, PDF extension, size, and capacity under an advisory lock, then returns the inserted row as JSONB using `<slot>/<uuid>.pdf`.

Implement `cancel_slide_file(file_id_input)` as a security-definer function limited to the uploader/admin and only able to remove metadata when no Storage object exists. Revoke public execution and grant only authenticated execution.

- [ ] **Step 4: Run migration contract test and verify GREEN**

Run: `npm test -- src/services/slideFilesMigration.test.ts`

Expected: all tests pass.

### Task 4: Repository Reservation, Upload, Rollback, And Download

**Files:**
- Modify: `src/services/meetingRepository.ts`
- Modify: `src/services/meetingRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Assert `getMeetings` selects `slide_files` and passes rows to `mapCloudMeeting`. Assert `uploadSlideFile(slotId, displayName, file)` calls `reserve_slide_file`, uploads to the returned object path with `contentType: 'application/pdf'` and no upsert, and returns the path. Add a failed Storage upload test asserting `cancel_slide_file` is called with the reservation ID. Assert `deleteSlideFile(file)` removes the private object and then deletes its metadata row.

- [ ] **Step 2: Run repository tests and verify RED**

Run: `npm test -- src/services/meetingRepository.test.ts`

Expected: FAIL because the repository still writes one replaceable `resources` row.

- [ ] **Step 3: Implement repository collection methods**

Load `slide_files` ordered by upload time. Replace `uploadSlides` with `uploadSlideFile`; reserve first, upload second, cancel reservation on Storage error, and never accept a caller-supplied uploader ID. Implement `deleteSlideFile` by removing the Storage object and then deleting the caller-authorized metadata row. Extend the download bucket union with the existing `slides` bucket path used by each `SlideFile`.

- [ ] **Step 4: Run repository tests and verify GREEN**

Run: `npm test -- src/services/meetingRepository.test.ts`

Expected: all tests pass.

### Task 5: Named PDF Collection Agenda UI

**Files:**
- Create: `src/components/SlideFilesControl.test.tsx`
- Create: `src/components/SlideFilesControl.tsx`
- Modify: `src/components/Agenda.tsx`
- Modify: `src/components/MeetingCollection.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing component tests**

Render one slot with zero files and assert required controls `Presenter / document name`, `Choose PDF`, and `Upload PDF`, plus `0 / 20 PDFs`. Select a PDF, enter a name, submit, and assert the callback receives `(slot, trimmedName, file)`. Add tests that reject PPTX, show listed display/original names, disable upload at 20 files, hide upload controls when unauthorized while retaining signed-in download actions, and show `Remove PDF` only to the uploader or an administrator.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npm test -- src/components/SlideFilesControl.test.tsx src/components/MeetingCollection.test.tsx`

Expected: FAIL because the collection component does not exist and Agenda still has Replace Slides.

- [ ] **Step 3: Implement the collection control and wire callbacks**

Create a form that stores display name, selected PDF, pending state, and one status message. Validate before calling `onUpload`; clear successful inputs and retain the name on failure. Render all slide files with display name, original filename, formatted size, icon download buttons, and authorized remove buttons. Show count and disable at 20.

Update callback signatures through `Agenda`, `MeetingCollection`, and `App`. Only provide upload callbacks in Upcoming view. Call `repository.uploadSlideFile`, reload meetings after successful upload or removal, and use the existing signed download URL flow for each PDF.

- [ ] **Step 4: Run component tests and verify GREEN**

Run: `npm test -- src/components/SlideFilesControl.test.tsx src/components/MeetingCollection.test.tsx src/App.test.tsx`

Expected: all tests pass.

### Task 6: Documentation, Production Migration, Deployment, And QA

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update documentation**

State that Slides are named PDF collections, limited to 20 per Lab per meeting, 50 MB each, uploaded before the meeting, private, and downloadable through signed URLs. Remove claims that Slides accept PPT/PPTX or replace a single file.

- [ ] **Step 2: Run full local verification**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected: all tests pass, build exits 0, and diff check reports no errors.

- [ ] **Step 3: Dry-run and apply the production migration**

Use the ignored Management API helper first with `-Mode DryRun`, then apply version `20260814190000` named `named_slide_files`. Query the catalog to verify table, functions, policies, bucket MIME restriction, and migration record.

- [ ] **Step 4: Commit, push, and deploy**

Commit only tracked source, tests, docs, and migration. Scan tracked files for passwords, management tokens, service-role keys, JWTs, and production Zoom URLs. Push `main`, then run `npx --yes vercel@latest deploy . --prod -y`.

- [ ] **Step 5: Verify production as a shared member**

Confirm all upcoming Lab rows expose the named PDF controls, PPTX is rejected locally, and 20-file capacity is displayed. Upload a generated one-page PDF named `Upload verification`, verify it appears and produces a signed download, then use the visible authorized remove action and confirm it disappears. Check anonymous privacy, 390px layout overflow, and browser console errors.
