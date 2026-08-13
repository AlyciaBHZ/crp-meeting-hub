alter table public.resources
add column resource_scope uuid generated always as (coalesce(agenda_slot_id, meeting_id)) stored;

alter table public.resources
add constraint resources_one_per_scope unique (kind, resource_scope);
