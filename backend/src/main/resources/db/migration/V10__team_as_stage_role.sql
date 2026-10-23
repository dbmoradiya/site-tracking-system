-- A Stage may require a Team (no login). The Team is stored on the Stage assignment row.
alter table stage_template_required_roles drop constraint if exists stage_template_required_roles_role_code_check;
alter table stage_template_required_roles add constraint stage_template_required_roles_role_code_check
  check (role_code in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER','TEAM'));
alter table site_stage_required_roles drop constraint if exists site_stage_required_roles_role_code_check;
alter table site_stage_required_roles add constraint site_stage_required_roles_role_code_check
  check (role_code in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER','TEAM'));

drop view site_role_assignments;
alter table site_stage_role_assignments alter column employee_id drop not null;
alter table site_stage_role_assignments add column team_id bigint references teams(id);
alter table site_stage_role_assignments add constraint chk_assignment_target
  check ((role_code='TEAM' and team_id is not null and employee_id is null) or (role_code<>'TEAM' and employee_id is not null and team_id is null));
create view site_role_assignments as
select distinct ss.site_id,sra.role_code,sra.employee_id
from site_stage_role_assignments sra join site_stages ss on ss.id=sra.stage_id where sra.employee_id is not null;

alter table site_role_assignment_history add column old_team_id bigint references teams(id);
alter table site_role_assignment_history add column new_team_id bigint references teams(id);
