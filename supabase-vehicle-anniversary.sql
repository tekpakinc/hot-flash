alter table vehicles add column if not exists anniversary_date date;

comment on column vehicles.anniversary_date is 'Optional date the vehicle became part of the owner’s story.';
