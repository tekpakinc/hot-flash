alter table profiles add column if not exists event_radius_miles integer not null default 50;
alter table profiles add column if not exists event_categories text[] not null default array['meet','show','cruise','track','drag','drift','charity']::text[];

alter table events alter column creator_id drop not null;
alter table events add column if not exists source_type text not null default 'community';
alter table events add column if not exists source_name text;
alter table events add column if not exists external_id text;
alter table events add column if not exists source_url text;
alter table events add column if not exists imported_at timestamptz;
alter table events add column if not exists last_verified_at timestamptz;
alter table events add column if not exists latitude double precision;
alter table events add column if not exists longitude double precision;

create unique index if not exists events_external_source_unique on events(source_name, external_id) where external_id is not null;
create index if not exists events_location_start_idx on events(location, starts_at);
