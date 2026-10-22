alter table projects add column coordinator_id bigint references employees(id);

update projects p
set coordinator_id = coalesce(
  (select s.coordinator_id from sites s where s.project_id=p.id order by s.id limit 1),
  (select er.employee_id from employee_roles er join employees e on e.id=er.employee_id
   where er.role_code='COORDINATOR' and e.active=true order by er.employee_id limit 1)
);

alter table projects alter column coordinator_id set not null;

create table project_coordinator_history (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  old_employee_id bigint references employees(id),
  new_employee_id bigint not null references employees(id),
  changed_by bigint not null references app_users(id),
  created_at timestamptz not null default now()
);

insert into project_coordinator_history(project_id,old_employee_id,new_employee_id,changed_by,created_at)
select p.id,null,p.coordinator_id,(select id from app_users where role='ADMIN' order by id limit 1),p.created_at
from projects p;

create index idx_projects_coordinator on projects(coordinator_id);
create index idx_project_coordinator_history on project_coordinator_history(project_id,created_at desc);
