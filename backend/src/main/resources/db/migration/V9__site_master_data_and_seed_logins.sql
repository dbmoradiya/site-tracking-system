-- Legacy single-role column; roles live in employee_roles since V3.
alter table employees drop column role;

-- app_users.role only distinguishes Admin; operational roles come from employee_roles.
alter table app_users drop constraint app_users_role_check;
update app_users set role='EMPLOYEE' where role<>'ADMIN';
alter table app_users add constraint app_users_role_check check (role in ('ADMIN','EMPLOYEE'));

insert into employees(name,email,mobile) values
  ('Anita Desai','design@sitetrack.local','9876543214'),
  ('Vikram Rao','procurement@sitetrack.local','9876543215');

insert into employee_roles(employee_id,role_code) values
  ((select id from employees where email='design@sitetrack.local'),'DESIGN_ENGINEER'),
  ((select id from employees where email='procurement@sitetrack.local'),'PROCUREMENT_MANAGER');

insert into app_users(employee_id,name,email,password_hash,role) values
  ((select id from employees where email='design@sitetrack.local'),'Anita Desai','design@sitetrack.local',
   (select password_hash from app_users where email='supervisor@sitetrack.local'),'EMPLOYEE'),
  ((select id from employees where email='procurement@sitetrack.local'),'Vikram Rao','procurement@sitetrack.local',
   (select password_hash from app_users where email='supervisor@sitetrack.local'),'EMPLOYEE');
