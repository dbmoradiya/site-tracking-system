alter table sites add column team_id bigint references teams(id);

update sites s set team_id=(
  select ss.team_id from site_stages ss where ss.site_id=s.id and ss.team_id is not null order by ss.id limit 1
);

create table site_stage_required_roles (
  stage_id bigint not null references site_stages(id) on delete cascade,
  role_code varchar(32) not null check (role_code in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER')),
  primary key(stage_id,role_code)
);

insert into site_stage_required_roles(stage_id,role_code)
select id,'SUPERVISOR' from site_stages;

create table site_role_assignments (
  site_id bigint not null references sites(id) on delete cascade,
  role_code varchar(32) not null check (role_code in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER')),
  employee_id bigint not null references employees(id),
  primary key(site_id,role_code)
);

insert into site_role_assignments(site_id,role_code,employee_id)
select site_id,'SUPERVISOR',min(supervisor_id) from site_stages where supervisor_id is not null group by site_id;

create table site_role_assignment_history (
  id bigserial primary key,
  site_id bigint not null references sites(id) on delete cascade,
  role_code varchar(32) not null,
  old_employee_id bigint references employees(id),
  new_employee_id bigint references employees(id),
  changed_by bigint not null references app_users(id),
  created_at timestamptz not null default now()
);

create table site_team_assignment_history (
  id bigserial primary key,
  site_id bigint not null references sites(id) on delete cascade,
  old_team_id bigint references teams(id),
  new_team_id bigint references teams(id),
  changed_by bigint not null references app_users(id),
  created_at timestamptz not null default now()
);

create index idx_site_role_assignments_employee on site_role_assignments(employee_id,site_id);
create index idx_site_role_history_site on site_role_assignment_history(site_id,created_at desc);
create index idx_site_team_history_site on site_team_assignment_history(site_id,created_at desc);
