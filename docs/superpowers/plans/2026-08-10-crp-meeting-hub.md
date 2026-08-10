# CRP Meeting Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish the initial responsive CRP meeting portal with the supplied six-group agenda and honest placeholders for future cloud uploads.

**Architecture:** A Vite React application reads typed meeting data and renders focused summary, agenda, and resource components. Pure file-validation logic and data integrity rules are tested independently; cloud persistence stays behind a future repository boundary.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Lucide React, CSS

---

### Task 1: Project And Meeting Data

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/data/meeting.ts`
- Test: `src/data/meeting.test.ts`

- [x] Write tests asserting six ordered, contiguous 20-minute slots and the supplied group names.
- [x] Run `npm test -- src/data/meeting.test.ts` and confirm failure because `meeting.ts` does not exist.
- [x] Add typed `Meeting` and `AgendaSlot` records plus the supplied agenda.
- [x] Run the data test and confirm it passes.

### Task 2: Upload Validation

**Files:**
- Create: `src/uploadValidation.ts`
- Test: `src/uploadValidation.test.ts`

- [x] Write tests for PDF, PPT, and PPTX acceptance, unsupported file rejection, and files over 50 MB.
- [x] Run the focused test and confirm failure because the validator does not exist.
- [x] Implement `validateSlidesFile(file)` returning a specific error or `null`.
- [x] Run the focused test and confirm it passes.

### Task 3: Meeting Interface

**Files:**
- Create: `src/App.tsx`, `src/main.tsx`, `src/styles.css`
- Create: `src/components/MeetingSummary.tsx`, `src/components/Agenda.tsx`, `src/components/Resources.tsx`
- Test: `src/App.test.tsx`

- [x] Write a component test for the title, format, six groups, six slide actions, and minutes placeholder.
- [x] Run the component test and confirm failure because `App.tsx` does not exist.
- [x] Implement the semantic responsive interface and accessible upload controls.
- [x] Run the component test and confirm it passes.

### Task 4: Documentation And Repository Publication

**Files:**
- Create: `README.md`, `.gitignore`, `.env.example`

- [x] Document local setup, free hosting architecture, privacy boundaries, and future Supabase configuration.
- [x] Run `npm test` and `npm run build` and require zero failures.
- [x] Inspect the production diff and ensure no secrets or uploaded files are tracked.
- [x] Commit the repository on `main`.
- [ ] Run `gh repo create crp-meeting-hub --public --source . --remote origin --push` after GitHub CLI authentication succeeds.
