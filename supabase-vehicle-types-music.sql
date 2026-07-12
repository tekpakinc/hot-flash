alter table vehicles add column if not exists vehicle_type text default 'automobile';
alter table vehicles add column if not exists music_url text;
alter table vehicles add column if not exists music_title text;
alter table profiles add column if not exists music_autoplay boolean not null default false;

update vehicles set vehicle_type='automobile' where vehicle_type is null;