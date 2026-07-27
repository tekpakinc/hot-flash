alter table vehicles
  add column if not exists ui_theme text not null default 'race';

alter table vehicles
  drop constraint if exists vehicles_ui_theme_check;

alter table vehicles
  add constraint vehicles_ui_theme_check
  check (ui_theme in ('race', 'muscle', 'jdm', 'retro', 'luxury'));

comment on column vehicles.ui_theme is
  'Owner-selected visual theme for this individual vehicle profile.';
