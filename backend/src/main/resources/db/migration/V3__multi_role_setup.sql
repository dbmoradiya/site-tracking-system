alter table employees drop constraint employees_role_check;
alter table employees add constraint employees_role_check
  check (role in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER'));

create table employee_roles (
  employee_id bigint not null references employees(id) on delete cascade,
  role_code varchar(32) not null check (role_code in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER')),
  primary key (employee_id, role_code)
);

insert into employee_roles(employee_id, role_code)
select id, role from employees;

create table stage_template_required_roles (
  stage_template_id bigint not null references stage_templates(id) on delete cascade,
  role_code varchar(32) not null check (role_code in ('COORDINATOR','SUPERVISOR','DESIGN_ENGINEER','PROCUREMENT_MANAGER')),
  primary key (stage_template_id, role_code)
);

-- Preserve the existing demo workflow until Site-level generic assignments land.
insert into stage_template_required_roles(stage_template_id, role_code)
select id, 'SUPERVISOR' from stage_templates;

create index idx_employee_roles_role on employee_roles(role_code, employee_id);
create index idx_template_required_roles_role on stage_template_required_roles(role_code, stage_template_id);
