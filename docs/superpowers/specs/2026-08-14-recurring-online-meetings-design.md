# Recurring Online Meetings Design

## Goal

Turn CRP Meeting Hub into a reusable online-meeting workspace where administrators maintain research groups, create each Zoom meeting with a custom speaking lineup and timetable, and let past meetings appear in an archive automatically.

## Product Model

The application has four distinct concepts:

- A **member** is an approved person who can sign in.
- A **group** is a long-lived research unit with one or more members.
- A **meeting** is one dated online event with its own Zoom link.
- An **agenda slot** selects one group for one meeting and stores that meeting's start time, end time, order, and slide resource.

Groups and group membership persist across meetings. Agenda slots are meeting-specific snapshots, so changing a group name or future speaking order does not rewrite old meeting records.

## Authentication

Approved members can sign in with email and password. A **Set up or reset password** action sends a secure Supabase email link. After opening it, the member sets a password in the application. Existing magic-link sessions continue to work during the transition.

Only allowlisted users receive an application profile. Administrators can add presenters or other administrators. Passwords are handled only by Supabase Auth and are never stored in the application database or GitHub repository.

## Group Administration

Administrators can:

- create and rename groups;
- mark groups inactive without deleting their history;
- assign approved presenter accounts to one or more groups;
- view each group's active members.

The six existing CRP groups become the initial active groups. Historical agenda rows retain their displayed group name even if an administrator later renames a group.

## Meeting Creation

An administrator creates a meeting by entering:

- meeting date;
- Zoom meeting URL;
- the groups speaking at this meeting;
- the speaking order;
- start and end time for every selected group.

When groups are selected, the form proposes consecutive 20-minute slots. The administrator can edit every time and reorder or remove selected groups before saving. A single database operation creates the meeting and all agenda slots so a partial schedule cannot be published.

More than one future meeting may exist. The Upcoming view shows future meetings in chronological order and emphasizes the nearest one.

## Uploads And Permissions

Any active member of a selected group can upload or replace that group's slides for that meeting. Administrators can upload or replace slides for every group. Meeting minutes remain administrator-only uploads.

Private file behavior remains unchanged:

- slides accept PDF, PPT, and PPTX up to 50 MB;
- minutes accept PDF, DOCX, and Markdown up to 50 MB;
- files remain in private Supabase Storage buckets;
- approved members receive short-lived signed download URLs;
- public visitors cannot read resource metadata or Zoom links.

Uploads are never used as a lifecycle gate. Missing slides or minutes do not prevent a meeting from becoming historical, and authorized users can add or replace files after the meeting date.

## Automatic Archive

Archive is a view, not an action. A meeting is upcoming when its date is today or later and archived when its date is before today in the Singapore timezone. No administrator button, completeness check, or status transition is required.

The Archive view lists past meetings newest first. Approved members can open a meeting to see its agenda and download available slides and minutes. Public visitors may see the dated agenda but not Zoom links or private resources.

## User Interface

The primary navigation has two real views:

- **Upcoming**: future meetings, timetable, upload state, and member-only Zoom access.
- **Archive**: past meetings with their original lineup, timetable, and available resources.

Signed-in administrators also see a compact management workspace with three sections:

- create meeting;
- groups and memberships;
- approved members and roles.

Password setup and reset stay in the authentication area. Operational controls use clear forms, checkboxes for group selection, time inputs for agenda times, and icon buttons for reorder/remove actions.

## Data And Security Changes

The database adds `groups` and `group_members`, adds `group_id` to agenda slots, and stores Zoom links in a separate `meeting_private_details` table. Zoom links cannot live on the publicly readable `meetings` rows because PostgreSQL row-level security does not hide individual columns. Existing agenda groups are migrated into reusable groups and linked without deleting current records.

Row-level security enforces:

- public access to meeting date and agenda only;
- member-only access to Zoom links and resource metadata;
- group-member or administrator upload rights for slides;
- administrator-only meeting, group, membership, and minutes management.

A security-definer database function creates a meeting and its slots transactionally after validating administrator access, selected groups, unique order values, and valid time ranges.

## Error Handling

Forms keep entered values after a failed request and show the Supabase error near the relevant command. Duplicate group membership is idempotent. Invalid Zoom URLs, empty group selections, overlapping or invalid times, unsupported files, and oversized uploads are rejected before mutation.

If no future meeting exists, members see a neutral empty state and administrators see the create-meeting form. A failed archive query does not hide the Upcoming view.

## Testing

Automated tests cover:

- password login, setup, and reset callbacks;
- meeting classification by Singapore date;
- mapping multiple meetings and agenda resources;
- group-based upload authorization;
- meeting-builder validation and payload generation;
- repository calls for meeting creation, groups, memberships, and archive reads;
- administrator and member UI states;
- database migration structure and policies through live catalog checks.

Verification includes the full Vitest suite, TypeScript/Vite production build, sensitive-data scan, Supabase catalog and anonymous-access checks, Vercel production deployment, and desktop/mobile browser inspection.
