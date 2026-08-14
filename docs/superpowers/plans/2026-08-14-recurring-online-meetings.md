# Recurring Online Meetings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add password authentication, reusable research groups, administrator-built Zoom schedules, and a date-derived meeting archive.

**Architecture:** Keep Supabase as the trust boundary. Add reusable group and membership tables, store private Zoom links separately from public meeting rows, create complete schedules through one validated RPC, and derive Upcoming versus Archive from Singapore calendar dates. Split mapping, lifecycle, builder validation, and authentication into testable frontend services while keeping operational UI components focused.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Supabase Auth/PostgreSQL/Storage/RLS, Vercel.

---

## File Structure

- Create `supabase/migrations/20260814090000_recurring_online_meetings.sql`: groups, memberships, private Zoom details, migration of existing groups, transactional meeting RPC, and revised RLS/storage policies.
- Create `src/services/meetingLifecycle.ts` and test: classify meetings by Singapore date and build ordered agenda payloads.
- Modify `src/data/meeting.ts`: richer meeting, group, and archive view models.
- Modify `src/services/meetingAccess.ts` and test: map multiple database meetings and group-based permissions.
- Modify `src/services/meetingRepository.ts` and test: upcoming/archive/group/member reads and meeting/group/membership mutations.
- Modify `src/components/AuthPanel.tsx` and test: password login, password-link request, and password setup.
- Create `src/components/MeetingCollection.tsx` and test: Upcoming and Archive meeting lists and empty states.
- Replace `src/components/AdminPanel.tsx` and test: meeting builder, group administration, memberships, and approved roles.
- Modify `src/App.tsx`: orchestration, navigation state, auth callbacks, reload behavior, and member-only Zoom links.
- Modify `src/styles.css`: dense responsive controls for meeting lists and administration.
- Modify `README.md`: recurring workflow, password setup, and security model.

### Task 1: Meeting Lifecycle Domain

**Files:**
- Create: `src/services/meetingLifecycle.ts`
- Create: `src/services/meetingLifecycle.test.ts`
- Modify: `src/data/meeting.ts`

- [ ] **Step 1: Write failing lifecycle tests**

```ts
expect(classifyMeetingDate('2026-08-13', '2026-08-14')).toBe('archive')
expect(classifyMeetingDate('2026-08-14', '2026-08-14')).toBe('upcoming')
expect(buildAgendaDraft(groups, '09:00')).toEqual([
  expect.objectContaining({ groupId: 'g1', startsAt: '09:00', endsAt: '09:20', sortOrder: 1 }),
  expect.objectContaining({ groupId: 'g2', startsAt: '09:20', endsAt: '09:40', sortOrder: 2 }),
])
expect(validateMeetingDraft({ date: '', zoomUrl: 'bad', slots: [] })).toMatch(/date/i)
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/services/meetingLifecycle.test.ts`

Expected: FAIL because `meetingLifecycle.ts` does not exist.

- [ ] **Step 3: Implement the lifecycle helpers and models**

```ts
export type MeetingView = 'upcoming' | 'archive'

export function classifyMeetingDate(dateISO: string, todayISO: string): MeetingView {
  return dateISO < todayISO ? 'archive' : 'upcoming'
}

export function addMinutes(time: string, minutes: number) {
  const [hours, mins] = time.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export function validateMeetingDraft(draft: MeetingDraft): string | null {
  if (!draft.date) return 'Meeting date is required.'
  try { if (new URL(draft.zoomUrl).protocol !== 'https:') return 'Enter a secure Zoom URL.' } catch { return 'Enter a valid Zoom URL.' }
  if (!draft.slots.length) return 'Select at least one presenting group.'
  if (draft.slots.some((slot) => slot.endsAt <= slot.startsAt)) return 'Every agenda end time must be after its start time.'
  return null
}
```

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/services/meetingLifecycle.test.ts`

Expected: all lifecycle tests pass.

### Task 2: Supabase Schema And Authorization

**Files:**
- Create: `supabase/migrations/20260814090000_recurring_online_meetings.sql`

- [ ] **Step 1: Add migration contract assertions to the lifecycle test**

```ts
const migration = readFileSync(new URL('../../supabase/migrations/20260814090000_recurring_online_meetings.sql', import.meta.url), 'utf8')
expect(migration).toContain('create table public.groups')
expect(migration).toContain('create table public.group_members')
expect(migration).toContain('create table public.meeting_private_details')
expect(migration).toContain('create or replace function public.create_meeting_with_slots')
expect(migration).not.toMatch(/zoom_url.+public\.meetings/i)
```

- [ ] **Step 2: Run the contract test and confirm RED**

Run: `npm test -- src/services/meetingLifecycle.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Implement the migration**

The migration must:

```sql
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  primary key (group_id, profile_id)
);

create table public.meeting_private_details (
  meeting_id uuid primary key references public.meetings(id) on delete cascade,
  zoom_url text not null check (zoom_url ~ '^https://'),
  created_at timestamptz not null default now()
);

alter table public.agenda_slots add column group_id uuid references public.groups(id) on delete restrict;
```

It must seed the six distinct existing group names, connect existing slots, enable RLS on all new tables, grant public group-name reads, grant member Zoom reads, restrict all mutations to administrators, and replace slide resource/storage policies with group-membership checks. The `create_meeting_with_slots` RPC accepts date, Zoom URL, and JSON slots, validates admin access and times, inserts the meeting/private details/agenda in one transaction, and returns the new meeting ID.

- [ ] **Step 4: Run the contract test and confirm GREEN**

Run: `npm test -- src/services/meetingLifecycle.test.ts`

Expected: migration contract passes.

### Task 3: Repository And Mapping

**Files:**
- Modify: `src/services/meetingRepository.test.ts`
- Modify: `src/services/meetingRepository.ts`
- Modify: `src/services/meetingAccess.test.ts`
- Modify: `src/services/meetingAccess.ts`

- [ ] **Step 1: Write failing repository and mapping tests**

```ts
expect(await repository.getMeetings()).toEqual(expect.objectContaining({ upcoming: expect.any(Array), archive: expect.any(Array) }))
expect(client.rpc).toHaveBeenCalledWith('create_meeting_with_slots', {
  meeting_date_input: '2026-10-14', zoom_url_input: 'https://zoom.us/j/123', slots_input: expect.any(Array),
})
expect(mapCloudMeeting(row, slots, minutes, privateDetails).zoomUrl).toBe('https://zoom.us/j/123')
expect(canManageSlot(member, { groupMemberIds: ['member-1'] })).toBe(true)
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/services/meetingRepository.test.ts src/services/meetingAccess.test.ts`

Expected: FAIL on missing APIs and group permission fields.

- [ ] **Step 3: Implement repository and mapping APIs**

```ts
async createMeeting(draft: MeetingDraft) {
  const result = await client.rpc('create_meeting_with_slots', {
    meeting_date_input: draft.date,
    zoom_url_input: draft.zoomUrl,
    slots_input: draft.slots.map((slot) => ({
      group_id: slot.groupId,
      starts_at: slot.startsAt,
      ends_at: slot.endsAt,
      sort_order: slot.sortOrder,
    })),
  })
  ensureNoError(result.error)
  return requireData(result.data, 'The meeting could not be created.')
}

async createGroup(name: string) {
  const result = await client.from('groups').insert({ name: name.trim() })
  ensureNoError(result.error)
}

async updateGroup(groupId: string, updates: { name?: string; active?: boolean }) {
  const result = await client.from('groups').update(updates).eq('id', groupId)
  ensureNoError(result.error)
}

async setGroupMember(groupId: string, profileId: string, enabled: boolean) {
  const query = enabled
    ? client.from('group_members').upsert({ group_id: groupId, profile_id: profileId })
    : client.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId)
  const result = await query
  ensureNoError(result.error)
}
```

`getMeetings` selects all dated `meetings`, all matching `agenda_slots` with nested `resources`, matching `resources` with kind `minutes`, and member-visible `meeting_private_details`; it joins records by UUID and returns `mapCloudMeeting` results split by `classifyMeetingDate`. `getGroups` selects active `groups` with nested `group_members(profile_id)` ordered by `sort_order,name`. Keep file upload paths stable by slot and meeting UUID. Query resources only for approved signed-in users under RLS.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/services/meetingRepository.test.ts src/services/meetingAccess.test.ts`

Expected: all repository and mapping tests pass.

### Task 4: Password Authentication

**Files:**
- Modify: `src/components/AuthPanel.test.tsx`
- Modify: `src/components/AuthPanel.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing authentication UI tests**

```tsx
await userEvent.type(screen.getByLabelText('Email address'), 'member@example.com')
await userEvent.type(screen.getByLabelText('Password'), 'correct horse battery staple')
await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))
expect(onPasswordSignIn).toHaveBeenCalledWith('member@example.com', 'correct horse battery staple')

await userEvent.click(screen.getByRole('button', { name: 'Set up or reset password' }))
expect(onPasswordLink).toHaveBeenCalledWith('member@example.com')
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npm test -- src/components/AuthPanel.test.tsx`

Expected: FAIL because password controls and callbacks do not exist.

- [ ] **Step 3: Implement password sign-in and setup**

Use `supabase.auth.signInWithPassword({ email, password })`, keep `signInWithOtp` for setup/reset links, and use `supabase.auth.updateUser({ password })` for a signed-in member setting a new password. Show a password setup form when the URL/session originated from the email setup flow or when a signed-in user explicitly chooses **Change password**. Require at least 10 characters in the UI while leaving Supabase's server validation authoritative.

- [ ] **Step 4: Run the focused test and confirm GREEN**

Run: `npm test -- src/components/AuthPanel.test.tsx`

Expected: all auth tests pass.

### Task 5: Upcoming And Archive Views

**Files:**
- Create: `src/components/MeetingCollection.test.tsx`
- Create: `src/components/MeetingCollection.tsx`
- Modify: `src/components/Agenda.tsx`
- Modify: `src/components/Resources.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing view tests**

```tsx
render(<MeetingCollection view="archive" meetings={[pastMeeting]} profile={member} />)
expect(screen.getByRole('heading', { name: 'Past meetings' })).toBeInTheDocument()
expect(screen.getByText('14 Jun 2026')).toBeInTheDocument()
expect(screen.getByRole('link', { name: 'Open Zoom meeting' })).not.toBeInTheDocument()
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/components/MeetingCollection.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement real Upcoming and Archive collections**

Render multiple future meetings chronologically and past meetings newest first. Reuse Agenda and Resources inside each meeting section. Show Zoom links only when a member profile exists and only for upcoming meetings. Preserve signed download and group upload callbacks for both future and historical meetings.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/components/MeetingCollection.test.tsx`

Expected: all collection tests pass.

### Task 6: Administrator Meeting And Group Workspace

**Files:**
- Modify: `src/components/AdminPanel.test.tsx`
- Modify: `src/components/AdminPanel.tsx`
- Modify: `src/styles.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing administrator tests**

```tsx
await userEvent.type(screen.getByLabelText('Meeting date'), '2026-10-14')
await userEvent.type(screen.getByLabelText('Zoom link'), 'https://zoom.us/j/123')
await userEvent.click(screen.getByLabelText("Prof Zhang Yang's group"))
await userEvent.click(screen.getByRole('button', { name: 'Create meeting' }))
expect(onCreateMeeting).toHaveBeenCalledWith(expect.objectContaining({ date: '2026-10-14', slots: [expect.objectContaining({ groupId: 'group-1' })] }))

await userEvent.type(screen.getByLabelText('New group name'), 'Prof New Group')
await userEvent.click(screen.getByRole('button', { name: 'Add group' }))
expect(onCreateGroup).toHaveBeenCalledWith('Prof New Group')
```

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `npm test -- src/components/AdminPanel.test.tsx`

Expected: FAIL because meeting builder and group controls do not exist.

- [ ] **Step 3: Implement the administrator workspace**

Split internal UI into focused functions within the component file: `MeetingBuilder`, `GroupManager`, and `MemberManager`. Selecting a group appends a proposed 20-minute slot; move-up, move-down, and remove icon buttons modify stable draft rows without resizing the layout. Expose time inputs for every selected group. Validate before calling repository callbacks and retain the draft after failures.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `npm test -- src/components/AdminPanel.test.tsx`

Expected: administrator tests pass.

### Task 7: Integration, Documentation, And Live Migration

**Files:**
- Modify: `src/App.tsx`
- Modify: `README.md`
- Modify: `src/styles.css`

- [ ] **Step 1: Run the full test suite to expose integration gaps**

Run: `npm test`

Expected: any remaining failures identify stale single-meeting props or old auth labels.

- [ ] **Step 2: Complete App orchestration and documentation**

Load meetings independently from admin-only groups/profiles. Reload meetings after any upload or meeting creation. Reload groups after group or membership mutations. Implement state-backed Upcoming/Archive tabs with semantic buttons. Update README workflow and security boundaries.

- [ ] **Step 3: Run full local verification**

Run:

```powershell
npm test
npm run build
git diff --check
```

Expected: all tests pass, build exits 0, and diff check is clean.

- [ ] **Step 4: Apply migration and verify live catalogs**

Apply the migration through the authenticated Supabase Management API, record version `20260814090000`, then query tables, functions, RLS policies, private buckets, group count, and anonymous visibility. Confirm anonymous calls cannot select `meeting_private_details`, `group_members`, profiles, resources, or Zoom links.

- [ ] **Step 5: Commit, push, deploy, and inspect production**

Commit the reviewed code, push `main`, deploy with `vercel deploy --prod`, and confirm the deployment state is `READY`. Verify desktop and mobile layouts, password form, Upcoming/Archive navigation, six initial groups, public privacy, and signed-in administrator controls. Do not create test members or send emails to other people.
