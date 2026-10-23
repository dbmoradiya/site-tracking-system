create table site_stage_role_assignments (
  stage_id bigint not null,
  role_code varchar(32) not null,
  employee_id bigint not null references employees(id),
  primary key(stage_id,role_code),
  foreign key(stage_id,role_code) references site_stage_required_roles(stage_id,role_code) on delete cascade
);

insert into site_stage_role_assignments(stage_id,role_code,employee_id)
select rr.stage_id,rr.role_code,sra.employee_id
from site_stage_required_roles rr
join site_stages ss on ss.id=rr.stage_id
join site_role_assignments sra on sra.site_id=ss.site_id and sra.role_code=rr.role_code;

drop table site_role_assignments;

-- Read-only helper for "is this employee assigned anywhere on the Site" checks.
create view site_role_assignments as
select distinct ss.site_id,sra.role_code,sra.employee_id
from site_stage_role_assignments sra join site_stages ss on ss.id=sra.stage_id;

alter table site_role_assignment_history add column stage_id bigint references site_stages(id) on delete cascade;
create index idx_stage_role_assignments_employee on site_stage_role_assignments(employee_id,stage_id);
