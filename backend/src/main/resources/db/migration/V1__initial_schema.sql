-- SiteTrack initial schema (consolidated baseline, no sample data).
-- The final schema is expressed directly in the CREATE TABLE definitions:
-- no ALTER statements and no historical migration steps. Replaces the earlier
-- incremental migrations V1 to V13; the resulting schema is identical to their
-- final state.

create table employees (
  id bigserial not null,
  name character varying(140) not null,
  mobile character varying(24),
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint employees_pkey primary key (id)
);

create table app_users (
  id bigserial not null,
  employee_id bigint,
  name character varying(140) not null,
  password_hash character varying(100) not null,
  role character varying(24) not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  mobile character varying(16),
  constraint app_users_pkey primary key (id),
  constraint app_users_role_check check (((role)::text = any ((array['ADMIN'::character varying, 'EMPLOYEE'::character varying])::text[]))),
  constraint app_users_employee_id_fkey foreign key (employee_id) references employees(id)
);

create table teams (
  id bigserial not null,
  name character varying(140) not null,
  contact_name character varying(140) not null,
  mobile character varying(24) not null,
  notes text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint teams_pkey primary key (id)
);

create table site_types (
  id bigserial not null,
  name character varying(120) not null,
  description text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  constraint site_types_pkey primary key (id),
  constraint site_types_name_key unique (name)
);

create table stage_templates (
  id bigserial not null,
  site_type_id bigint not null,
  name character varying(160) not null,
  position integer not null,
  depends_on_id bigint,
  evidence_required boolean not null default true,
  constraint stage_templates_pkey primary key (id),
  constraint stage_templates_site_type_id_position_key unique (site_type_id, "position"),
  constraint stage_templates_position_check check (("position" > 0)),
  constraint stage_templates_site_type_id_fkey foreign key (site_type_id) references site_types(id) on delete cascade,
  constraint stage_templates_depends_on_id_fkey foreign key (depends_on_id) references stage_templates(id) on delete set null
);

create table projects (
  id bigserial not null,
  name character varying(180) not null,
  customer_name character varying(160) not null,
  customer_mobile character varying(24) not null,
  address text,
  target_date date,
  status character varying(24) not null default 'NOT_STARTED'::character varying,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  coordinator_id bigint not null,
  constraint projects_pkey primary key (id),
  constraint projects_coordinator_id_fkey foreign key (coordinator_id) references employees(id)
);

create table sites (
  id bigserial not null,
  project_id bigint not null,
  site_type_id bigint not null,
  name character varying(180) not null,
  address text,
  target_date date,
  status character varying(24) not null default 'NOT_STARTED'::character varying,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  team_id bigint,
  constraint sites_pkey primary key (id),
  constraint sites_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  constraint sites_site_type_id_fkey foreign key (site_type_id) references site_types(id),
  constraint sites_team_id_fkey foreign key (team_id) references teams(id)
);

create table site_stages (
  id bigserial not null,
  site_id bigint not null,
  template_id bigint,
  name character varying(160) not null,
  position integer not null,
  depends_on_stage_id bigint,
  evidence_required boolean not null default true,
  status character varying(28) not null default 'NOT_STARTED'::character varying,
  approved_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  completed_by bigint,
  completed_at timestamp with time zone,
  constraint site_stages_pkey primary key (id),
  constraint site_stages_site_id_position_key unique (site_id, "position"),
  constraint site_stages_position_check check (("position" > 0)),
  constraint site_stages_site_id_fkey foreign key (site_id) references sites(id) on delete cascade,
  constraint site_stages_template_id_fkey foreign key (template_id) references stage_templates(id) on delete set null,
  constraint site_stages_depends_on_stage_id_fkey foreign key (depends_on_stage_id) references site_stages(id) on delete set null,
  constraint site_stages_completed_by_fkey foreign key (completed_by) references app_users(id)
);

create table evidence (
  id bigserial not null,
  stage_id bigint not null,
  file_name character varying(255) not null,
  content_type character varying(120),
  storage_path character varying(500) not null,
  uploaded_by bigint not null,
  upload_status character varying(20) not null default 'UPLOADED'::character varying,
  created_at timestamp with time zone not null default now(),
  comment text,
  constraint evidence_pkey primary key (id),
  constraint evidence_stage_id_fkey foreign key (stage_id) references site_stages(id) on delete cascade,
  constraint evidence_uploaded_by_fkey foreign key (uploaded_by) references app_users(id)
);

create table stage_reviews (
  id bigserial not null,
  stage_id bigint not null,
  action character varying(24) not null,
  note text,
  action_by bigint not null,
  created_at timestamp with time zone not null default now(),
  constraint stage_reviews_pkey primary key (id),
  constraint stage_reviews_action_check check (((action)::text = any ((array['SUBMITTED'::character varying, 'APPROVED'::character varying, 'CHANGES_REQUESTED'::character varying, 'COMPLETED'::character varying])::text[]))),
  constraint stage_reviews_stage_id_fkey foreign key (stage_id) references site_stages(id) on delete cascade,
  constraint stage_reviews_action_by_fkey foreign key (action_by) references app_users(id)
);

create table employee_roles (
  employee_id bigint not null,
  role_code character varying(32) not null,
  constraint employee_roles_pkey primary key (employee_id, role_code),
  constraint employee_roles_role_code_check check (((role_code)::text = any ((array['COORDINATOR'::character varying, 'SUPERVISOR'::character varying, 'DESIGN_ENGINEER'::character varying, 'PROCUREMENT_MANAGER'::character varying])::text[]))),
  constraint employee_roles_employee_id_fkey foreign key (employee_id) references employees(id) on delete cascade
);

create table stage_template_required_roles (
  stage_template_id bigint not null,
  role_code character varying(32) not null,
  constraint stage_template_required_roles_pkey primary key (stage_template_id, role_code),
  constraint stage_template_required_roles_role_code_check check (((role_code)::text = any ((array['COORDINATOR'::character varying, 'SUPERVISOR'::character varying, 'DESIGN_ENGINEER'::character varying, 'PROCUREMENT_MANAGER'::character varying, 'TEAM'::character varying])::text[]))),
  constraint stage_template_required_roles_stage_template_id_fkey foreign key (stage_template_id) references stage_templates(id) on delete cascade
);

create table project_coordinator_history (
  id bigserial not null,
  project_id bigint not null,
  old_employee_id bigint,
  new_employee_id bigint not null,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now(),
  constraint project_coordinator_history_pkey primary key (id),
  constraint project_coordinator_history_project_id_fkey foreign key (project_id) references projects(id) on delete cascade,
  constraint project_coordinator_history_old_employee_id_fkey foreign key (old_employee_id) references employees(id),
  constraint project_coordinator_history_new_employee_id_fkey foreign key (new_employee_id) references employees(id),
  constraint project_coordinator_history_changed_by_fkey foreign key (changed_by) references app_users(id)
);

create table site_stage_required_roles (
  stage_id bigint not null,
  role_code character varying(32) not null,
  constraint site_stage_required_roles_pkey primary key (stage_id, role_code),
  constraint site_stage_required_roles_role_code_check check (((role_code)::text = any ((array['COORDINATOR'::character varying, 'SUPERVISOR'::character varying, 'DESIGN_ENGINEER'::character varying, 'PROCUREMENT_MANAGER'::character varying, 'TEAM'::character varying])::text[]))),
  constraint site_stage_required_roles_stage_id_fkey foreign key (stage_id) references site_stages(id) on delete cascade
);

create table site_role_assignment_history (
  id bigserial not null,
  site_id bigint not null,
  role_code character varying(32) not null,
  old_employee_id bigint,
  new_employee_id bigint,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now(),
  stage_id bigint,
  old_team_id bigint,
  new_team_id bigint,
  constraint site_role_assignment_history_pkey primary key (id),
  constraint site_role_assignment_history_site_id_fkey foreign key (site_id) references sites(id) on delete cascade,
  constraint site_role_assignment_history_stage_id_fkey foreign key (stage_id) references site_stages(id) on delete cascade,
  constraint site_role_assignment_history_old_employee_id_fkey foreign key (old_employee_id) references employees(id),
  constraint site_role_assignment_history_new_employee_id_fkey foreign key (new_employee_id) references employees(id),
  constraint site_role_assignment_history_old_team_id_fkey foreign key (old_team_id) references teams(id),
  constraint site_role_assignment_history_new_team_id_fkey foreign key (new_team_id) references teams(id),
  constraint site_role_assignment_history_changed_by_fkey foreign key (changed_by) references app_users(id)
);

create table site_team_assignment_history (
  id bigserial not null,
  site_id bigint not null,
  old_team_id bigint,
  new_team_id bigint,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now(),
  constraint site_team_assignment_history_pkey primary key (id),
  constraint site_team_assignment_history_site_id_fkey foreign key (site_id) references sites(id) on delete cascade,
  constraint site_team_assignment_history_old_team_id_fkey foreign key (old_team_id) references teams(id),
  constraint site_team_assignment_history_new_team_id_fkey foreign key (new_team_id) references teams(id),
  constraint site_team_assignment_history_changed_by_fkey foreign key (changed_by) references app_users(id)
);

create table site_stage_role_assignments (
  stage_id bigint not null,
  role_code character varying(32) not null,
  employee_id bigint,
  team_id bigint,
  constraint site_stage_role_assignments_pkey primary key (stage_id, role_code),
  constraint chk_assignment_target check (((((role_code)::text = 'TEAM'::text) and (team_id is not null) and (employee_id is null)) or (((role_code)::text <> 'TEAM'::text) and (employee_id is not null) and (team_id is null)))),
  constraint site_stage_role_assignments_stage_id_role_code_fkey foreign key (stage_id, role_code) references site_stage_required_roles(stage_id, role_code) on delete cascade,
  constraint site_stage_role_assignments_employee_id_fkey foreign key (employee_id) references employees(id),
  constraint site_stage_role_assignments_team_id_fkey foreign key (team_id) references teams(id)
);

create table site_move_history (
  id bigserial not null,
  site_id bigint not null,
  old_project_id bigint,
  new_project_id bigint,
  old_project_name character varying(255) not null,
  new_project_name character varying(255) not null,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now(),
  constraint site_move_history_pkey primary key (id),
  constraint site_move_history_site_id_fkey foreign key (site_id) references sites(id) on delete cascade,
  constraint site_move_history_old_project_id_fkey foreign key (old_project_id) references projects(id) on delete set null,
  constraint site_move_history_new_project_id_fkey foreign key (new_project_id) references projects(id) on delete set null,
  constraint site_move_history_changed_by_fkey foreign key (changed_by) references app_users(id)
);

CREATE UNIQUE INDEX employees_mobile_key ON employees USING btree (mobile) WHERE (mobile IS NOT NULL);
CREATE UNIQUE INDEX app_users_mobile_key ON app_users USING btree (mobile) WHERE (mobile IS NOT NULL);
CREATE INDEX idx_projects_coordinator ON projects USING btree (coordinator_id);
CREATE INDEX idx_sites_project ON sites USING btree (project_id);
CREATE INDEX idx_stages_site ON site_stages USING btree (site_id, "position");
CREATE INDEX idx_evidence_stage ON evidence USING btree (stage_id);
CREATE INDEX idx_employee_roles_role ON employee_roles USING btree (role_code, employee_id);
CREATE INDEX idx_template_required_roles_role ON stage_template_required_roles USING btree (role_code, stage_template_id);
CREATE INDEX idx_project_coordinator_history ON project_coordinator_history USING btree (project_id, created_at DESC);
CREATE INDEX idx_site_role_history_site ON site_role_assignment_history USING btree (site_id, created_at DESC);
CREATE INDEX idx_site_team_history_site ON site_team_assignment_history USING btree (site_id, created_at DESC);
CREATE INDEX idx_stage_role_assignments_employee ON site_stage_role_assignments USING btree (employee_id, stage_id);
CREATE INDEX idx_site_move_history_site ON site_move_history USING btree (site_id, created_at DESC);

create view site_role_assignments as
SELECT DISTINCT ss.site_id, sra.role_code, sra.employee_id FROM site_stage_role_assignments sra JOIN site_stages ss ON ss.id = sra.stage_id WHERE sra.employee_id IS NOT NULL;
