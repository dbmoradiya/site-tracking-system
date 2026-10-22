create table employees (
  id bigserial primary key,
  name varchar(140) not null,
  email varchar(180) not null unique,
  mobile varchar(24),
  role varchar(24) not null check (role in ('COORDINATOR','SUPERVISOR')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table app_users (
  id bigserial primary key,
  employee_id bigint references employees(id),
  name varchar(140) not null,
  email varchar(180) not null unique,
  password_hash varchar(100) not null,
  role varchar(24) not null check (role in ('ADMIN','COORDINATOR','SUPERVISOR')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table teams (
  id bigserial primary key,
  name varchar(140) not null,
  contact_name varchar(140) not null,
  mobile varchar(24) not null,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table site_types (
  id bigserial primary key,
  name varchar(120) not null unique,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stage_templates (
  id bigserial primary key,
  site_type_id bigint not null references site_types(id) on delete cascade,
  name varchar(160) not null,
  position integer not null check (position > 0),
  depends_on_id bigint references stage_templates(id) on delete set null,
  evidence_required boolean not null default true,
  unique(site_type_id, position)
);

create table projects (
  id bigserial primary key,
  name varchar(180) not null,
  customer_name varchar(160) not null,
  customer_mobile varchar(24) not null,
  address text,
  target_date date,
  status varchar(24) not null default 'NOT_STARTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sites (
  id bigserial primary key,
  project_id bigint not null references projects(id) on delete cascade,
  site_type_id bigint not null references site_types(id),
  coordinator_id bigint not null references employees(id),
  name varchar(180) not null,
  address text,
  target_date date,
  status varchar(24) not null default 'NOT_STARTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table site_stages (
  id bigserial primary key,
  site_id bigint not null references sites(id) on delete cascade,
  template_id bigint references stage_templates(id) on delete set null,
  name varchar(160) not null,
  position integer not null check (position > 0),
  depends_on_stage_id bigint references site_stages(id) on delete set null,
  evidence_required boolean not null default true,
  supervisor_id bigint references employees(id),
  team_id bigint references teams(id),
  status varchar(28) not null default 'NOT_STARTED',
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(site_id, position)
);

create table evidence (
  id bigserial primary key,
  stage_id bigint not null references site_stages(id) on delete cascade,
  file_name varchar(255) not null,
  content_type varchar(120),
  storage_path varchar(500) not null,
  uploaded_by bigint not null references app_users(id),
  upload_status varchar(20) not null default 'UPLOADED',
  created_at timestamptz not null default now()
);

create table stage_reviews (
  id bigserial primary key,
  stage_id bigint not null references site_stages(id) on delete cascade,
  action varchar(24) not null check (action in ('SUBMITTED','APPROVED','CHANGES_REQUESTED')),
  note text,
  action_by bigint not null references app_users(id),
  created_at timestamptz not null default now()
);

create table assignment_history (
  id bigserial primary key,
  stage_id bigint not null references site_stages(id) on delete cascade,
  old_supervisor_id bigint references employees(id),
  new_supervisor_id bigint references employees(id),
  old_team_id bigint references teams(id),
  new_team_id bigint references teams(id),
  changed_by bigint not null references app_users(id),
  created_at timestamptz not null default now()
);

create index idx_sites_project on sites(project_id);
create index idx_stages_site on site_stages(site_id, position);
create index idx_stages_supervisor on site_stages(supervisor_id, status);
create index idx_evidence_stage on evidence(stage_id);

insert into employees(name,email,mobile,role) values
  ('Kavita Shah','coordinator@sitetrack.local','9876543210','COORDINATOR'),
  ('Imran Khan','imran@sitetrack.local','9876543211','COORDINATOR'),
  ('Rakesh Solanki','supervisor@sitetrack.local','9876543212','SUPERVISOR'),
  ('Mehul Parmar','mehul@sitetrack.local','9876543213','SUPERVISOR');

insert into app_users(employee_id,name,email,password_hash,role) values
  (null,'Aarav Admin','admin@sitetrack.local','$2y$10$uM9ZuAcxZbscrfjjpjdSTOkMQ1IWghnyocqL7VAFvoED4V6ceoAPK','ADMIN'),
  ((select id from employees where email='coordinator@sitetrack.local'),'Kavita Shah','coordinator@sitetrack.local','$2y$10$uM9ZuAcxZbscrfjjpjdSTOkMQ1IWghnyocqL7VAFvoED4V6ceoAPK','COORDINATOR'),
  ((select id from employees where email='supervisor@sitetrack.local'),'Rakesh Solanki','supervisor@sitetrack.local','$2y$10$uM9ZuAcxZbscrfjjpjdSTOkMQ1IWghnyocqL7VAFvoED4V6ceoAPK','SUPERVISOR');

insert into teams(name,contact_name,mobile,notes) values
  ('Shakti Team','Harish Patel','9825011210','Civil execution crew'),
  ('Uday Team','Nilesh Desai','9825011211','Solar installation crew');

insert into site_types(name,description) values
  ('Shed','Industrial shed construction'),
  ('Solar','Rooftop solar installation');

insert into stage_templates(site_type_id,name,position,evidence_required) values
  ((select id from site_types where name='Shed'),'Foundation',1,true),
  ((select id from site_types where name='Shed'),'Structure',2,true),
  ((select id from site_types where name='Shed'),'Roofing',3,true),
  ((select id from site_types where name='Shed'),'Finishing',4,true),
  ((select id from site_types where name='Solar'),'Survey',1,true),
  ((select id from site_types where name='Solar'),'Mounting structure',2,true),
  ((select id from site_types where name='Solar'),'Panel installation',3,true),
  ((select id from site_types where name='Solar'),'Electrical connection',4,true),
  ((select id from site_types where name='Solar'),'Commissioning',5,true);

update stage_templates current_stage
set depends_on_id = previous_stage.id
from stage_templates previous_stage
where current_stage.site_type_id = previous_stage.site_type_id
  and current_stage.position = previous_stage.position + 1;

insert into projects(name,customer_name,customer_mobile,address,target_date,status)
values ('Sunrise Campus','Sunrise Industries','9876501000','Ahmedabad, Gujarat',current_date + 90,'IN_PROGRESS');

insert into sites(project_id,site_type_id,coordinator_id,name,address,target_date,status)
values (
  (select id from projects where name='Sunrise Campus'),
  (select id from site_types where name='Shed'),
  (select id from employees where email='coordinator@sitetrack.local'),
  'Shed A','Ahmedabad, Gujarat',current_date + 75,'IN_PROGRESS'
);

insert into site_stages(site_id,template_id,name,position,evidence_required,supervisor_id,team_id,status)
select s.id, st.id, st.name, st.position, true,
       (select id from employees where email='supervisor@sitetrack.local'),
       (select id from teams where name='Shakti Team'),
       case when st.position = 1 then 'IN_PROGRESS' else 'BLOCKED' end
from sites s
join projects p on p.id=s.project_id and p.name='Sunrise Campus'
join stage_templates st on st.site_type_id=s.site_type_id;

update site_stages current_stage
set depends_on_stage_id = previous_stage.id
from site_stages previous_stage
where current_stage.site_id = previous_stage.site_id
  and current_stage.position = previous_stage.position + 1;
