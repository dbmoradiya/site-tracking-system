alter table site_stages
  add column completed_by bigint references app_users(id),
  add column completed_at timestamptz;

alter table stage_reviews drop constraint stage_reviews_action_check;
alter table stage_reviews add constraint stage_reviews_action_check
  check (action in ('SUBMITTED','APPROVED','CHANGES_REQUESTED','COMPLETED'));

