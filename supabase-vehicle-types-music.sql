alter table vehicles add column if not exists vehicle_type text default 'automobile';
alter table vehicles add column if not exists music_url text;
alter table vehicles add column if not exists music_title text;

update vehicles set vehicle_type='automobile' where vehicle_type is null;
