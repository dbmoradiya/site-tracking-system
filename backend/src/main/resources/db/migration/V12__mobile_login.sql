-- Login is by mobile number (no email). Email columns are removed.
alter table app_users add column mobile varchar(16);
-- Existing demo accounts keep working with obviously fake numbers (dev only; the prod profile removes them).
update employees set mobile=null where mobile is not null and mobile !~ '^\+[0-9]{8,15}$';
update app_users u set mobile = case u.email
  when 'coordinator@sitetrack.local' then '+919000000001'
  when 'supervisor@sitetrack.local' then '+919000000002'
  when 'design@sitetrack.local' then '+919000000003'
  when 'procurement@sitetrack.local' then '+919000000004'
  else null end;
update employees e set mobile=u.mobile from app_users u where u.employee_id=e.id and u.mobile is not null and e.mobile is null;
alter table app_users drop column email;
alter table employees drop column email;
create unique index app_users_mobile_key on app_users(mobile) where mobile is not null;
create unique index employees_mobile_key on employees(mobile) where mobile is not null;
