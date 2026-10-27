\set ON_ERROR_STOP on

-- Required psql variables:
--   admin_mobile   Indian mobile number: exactly 10 digits starting with 6-9
--   admin_password 10 to 72 characters
-- Optional:
--   admin_name     Defaults to Administrator

\if :{?admin_name}
\else
\set admin_name 'Administrator'
\endif

select :'admin_mobile' ~ '^[6-9][0-9]{9}$' as valid_mobile,
       length(:'admin_password') between 10 and 72 as valid_password
\gset

\if :valid_mobile
\else
\echo 'Error: admin_mobile must contain exactly 10 digits and start with 6-9.'
\quit 1
\endif

\if :valid_password
\else
\echo 'Error: admin_password must be 10 to 72 characters.'
\quit 1
\endif

create extension if not exists pgcrypto;

with input as (
    select :'admin_name'::varchar(140) as name,
           ('+91' || :'admin_mobile')::varchar(16) as mobile,
           crypt(:'admin_password', gen_salt('bf', 12))::varchar(100) as password_hash
), updated as (
    update app_users
       set name = input.name,
           mobile = input.mobile,
           password_hash = input.password_hash,
           active = true
      from input
     where app_users.id = (
         select min(id) from app_users where role = 'ADMIN'
     )
    returning app_users.id
)
insert into app_users (employee_id, name, mobile, password_hash, role, active)
select null, input.name, input.mobile, input.password_hash, 'ADMIN', true
  from input
 where not exists (select 1 from updated);

select id, name, mobile, role, active
  from app_users
 where role = 'ADMIN'
 order by id;
