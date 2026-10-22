drop table assignment_history;
drop index idx_stages_supervisor;

alter table site_stages
  drop column supervisor_id,
  drop column team_id;

alter table sites drop column coordinator_id;

