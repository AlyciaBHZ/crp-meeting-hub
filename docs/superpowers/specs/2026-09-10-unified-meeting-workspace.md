# Unified meeting workspace

The requested update lets administrators create and edit upcoming meetings directly, choose meeting times and participating groups, and maintain group membership. Each meeting contains one agenda with PDFs attached to each group and one administrator-managed minutes section.

## Behavior

- Upcoming exposes New meeting and Edit meeting actions to administrators; Archive exposes Add past meeting. Groups and members opens reusable group and membership settings.
- Editing starts from the selected meeting's saved title, date, times, Zoom URL and group order. Changing the overall Singapore start time shifts all slots, preserving breaks, durations and slot IDs. Individual times remain editable. Invalid or overlapping schedules and changes crossing midnight are rejected.
- Group PDF cards merge named slide records with legacy Archive PDFs. Existing objects stay in their private buckets and use their original download paths. There is no second archive section, second group listing or contradictory slide status.
- Assigned members and administrators can upload PDFs before or after meetings. Administrators upload or replace minutes; approved members can download them.
- One combined 20-PDF cap applies per meeting/group, including existing legacy PDFs. Existing over-limit collections are retained. Both upload routes enforce the cap transactionally with the same lock.
- Schedule edits cannot detach groups from their uploaded files. Reordering keeps slot IDs with their groups. Group membership updates report success or failure.

## Implementation and validation

MeetingCollection provides direct administrator callbacks. AdminPanel accepts the requested meeting/mode; App opens and focuses it. Agenda and SlideFilesControl render both file sources in one card. A versioned SQL migration opens named uploads to archived meetings, enforces the combined cap and protects legacy file ownership.

Validation covers the production build, React interaction tests for administrator entry points, date/time edits, group uploads and permissions, and executed PostgreSQL tests for the migration's authorization, file validation, combined limit and attachment protection. Browser checks cover desktop and mobile layouts with isolated fixture data.

Release requires the SQL migration before the frontend. Storage object contents are never migrated or deleted by this update.
