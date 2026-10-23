-- SiteTrack initial schema (consolidated baseline, no sample data).
-- Replaces the earlier incremental migrations V1 to V13; the resulting schema is identical to their final state.

create table employees (
  id bigserial not null,
  name character varying(140) not null,
  mobile character varying(24),
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table app_users (
  id bigserial not null,
  employee_id bigint,
  name character varying(140) not null,
  password_hash character varying(100) not null,
  role character varying(24) not null,
  active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  mobile character varying(16)
);

create table teams (
  id bigserial not null,
  name character varying(140) not null,
  contact_name character varying(140) not null,
  mobile character varying(24) not null,
  notes text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table site_types (
  id bigserial not null,
  name character varying(120) not null,
  description text,
  active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table stage_templates (
  id bigserial not null,
  site_type_id bigint not null,
  name character varying(160) not null,
  position integer not null,
  depends_on_id bigint,
  evidence_required boolean not null default true
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
  coordinator_id bigint not null
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
  team_id bigint
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
  completed_at timestamp with time zone
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
  comment text
);

create table stage_reviews (
  id bigserial not null,
  stage_id bigint not null,
  action character varying(24) not null,
  note text,
  action_by bigint not null,
  created_at timestamp with time zone not null default now()
);

create table employee_roles (
  employee_id bigint not null,
  role_code character varying(32) not null
);

create table stage_template_required_roles (
  stage_template_id bigint not null,
  role_code character varying(32) not null
);

create table project_coordinator_history (
  id bigserial not null,
  project_id bigint not null,
  old_employee_id bigint,
  new_employee_id bigint not null,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now()
);

create table site_stage_required_roles (
  stage_id bigint not null,
  role_code character varying(32) not null
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
  new_team_id bigint
);

create table site_team_assignment_history (
  id bigserial not null,
  site_id bigint not null,
  old_team_id bigint,
  new_team_id bigint,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now()
);

create table site_stage_role_assignments (
  stage_id bigint not null,
  role_code character varying(32) not null,
  employee_id bigint,
  team_id bigint
);

create table site_move_history (
  id bigserial not null,
  site_id bigint not null,
  old_project_id bigint,
  new_project_id bigint,
  old_project_name character varying(255) not null,
  new_project_name character varying(255) not null,
  changed_by bigint not null,
  created_at timestamp with time zone not null default now()
);

alter table employees add constraint employees_pkey PRIMARY KEY (id);
alter table app_users add constraint app_users_pkey PRIMARY KEY (id);
alter table app_users add constraint app_users_role_check CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'EMPLOYEE'::character varying])::text[])));
alter table teams add constraint teams_pkey PRIMARY KEY (id);
alter table site_types add constraint site_types_pkey PRIMARY KEY (id);
alter table site_types add constraint site_types_name_key UNIQUE (name);
alter table stage_templates add constraint stage_templates_pkey PRIMARY KEY (id);
alter table stage_templates add constraint stage_templates_site_type_id_position_key UNIQUE (site_type_id, "position");
alter table stage_templates add constraint stage_templates_position_check CHECK (("position" > 0));
alter table projects add constraint projects_pkey PRIMARY KEY (id);
alter table sites add constraint sites_pkey PRIMARY KEY (id);
alter table site_stages add constraint site_stages_pkey PRIMARY KEY (id);
alter table site_stages add constraint site_stages_site_id_position_key UNIQUE (site_id, "position");
alter table site_stages add constraint site_stages_position_check CHECK (("position" > 0));
alter table evidence add constraint evidence_pkey PRIMARY KEY (id);
alter table stage_reviews add constraint stage_reviews_pkey PRIMARY KEY (id);
alter table stage_reviews add constraint stage_reviews_action_check CHECK (((action)::text = ANY ((ARRAY['SUBMITTED'::character varying, 'APPROVED'::character varying, 'CHANGES_REQUESTED'::character varying, 'COMPLETED'::character varying])::text[])));
alter table employee_roles add constraint employee_roles_pkey PRIMARY KEY (employee_id, role_code);
alter table employee_roles add constraint employee_roles_role_code_check CHECK (((role_code)::text = ANY ((ARRAY['COORDINATOR'::character varying, 'SUPERVISOR'::character varying, 'DESIGN_ENGINEER'::character varying, 'PROCUREMENT_MANAGER'::character varying])::text[])));
alter table stage_template_required_roles add constraint stage_template_required_roles_pkey PRIMARY KEY (stage_template_id, role_code);
alter table stage_template_required_roles add constraint stage_template_required_roles_role_code_check CHECK (((role_code)::text = ANY ((ARRAY['COORDINATOR'::character varying, 'SUPERVISOR'::character varying, 'DESIGN_ENGINEER'::character varying, 'PROCUREMENT_MANAGER'::character varying, 'TEAM'::character varying])::text[])));
alter table project_coordinator_history add constraint project_coordinator_history_pkey PRIMARY KEY (id);
alter table site_stage_required_roles add constraint site_stage_required_roles_pkey PRIMARY KEY (stage_id, role_code);
alter table site_stage_required_roles add constraint site_stage_required_roles_role_code_check CHECK (((role_code)::text = ANY ((ARRAY['COORDINATOR'::character varying, 'SUPERVISOR'::character varying, 'DESIGN_ENGINEER'::character varying, 'PROCUREMENT_MANAGER'::character varying, 'TEAM'::character varying])::text[])));
alter table site_role_assignment_history add constraint site_role_assignment_history_pkey PRIMARY KEY (id);
alter table site_team_assignment_history add constraint site_team_assignment_history_pkey PRIMARY KEY (id);
alter table site_stage_role_assignments add constraint site_stage_role_assignments_pkey PRIMARY KEY (stage_id, role_code);
alter table site_stage_role_assignments add constraint chk_assignment_target CHECK (((((role_code)::text = 'TEAM'::text) AND (team_id IS NOT NULL) AND (employee_id IS NULL)) OR (((role_code)::text <> 'TEAM'::text) AND (employee_id IS NOT NULL) AND (team_id IS NULL))));
alter table site_move_history add constraint site_move_history_pkey PRIMARY KEY (id);

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

alter table app_users add constraint app_users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
alter table stage_templates add constraint stage_templates_depends_on_id_fkey FOREIGN KEY (depends_on_id) REFERENCES stage_templates(id) ON DELETE SET NULL;
alter table stage_templates add constraint stage_templates_site_type_id_fkey FOREIGN KEY (site_type_id) REFERENCES site_types(id) ON DELETE CASCADE;
alter table projects add constraint projects_coordinator_id_fkey FOREIGN KEY (coordinator_id) REFERENCES employees(id);
alter table sites add constraint sites_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table sites add constraint sites_site_type_id_fkey FOREIGN KEY (site_type_id) REFERENCES site_types(id);
alter table sites add constraint sites_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table site_stages add constraint site_stages_completed_by_fkey FOREIGN KEY (completed_by) REFERENCES app_users(id);
alter table site_stages add constraint site_stages_depends_on_stage_id_fkey FOREIGN KEY (depends_on_stage_id) REFERENCES site_stages(id) ON DELETE SET NULL;
alter table site_stages add constraint site_stages_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
alter table site_stages add constraint site_stages_template_id_fkey FOREIGN KEY (template_id) REFERENCES stage_templates(id) ON DELETE SET NULL;
alter table evidence add constraint evidence_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES site_stages(id) ON DELETE CASCADE;
alter table evidence add constraint evidence_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES app_users(id);
alter table stage_reviews add constraint stage_reviews_action_by_fkey FOREIGN KEY (action_by) REFERENCES app_users(id);
alter table stage_reviews add constraint stage_reviews_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES site_stages(id) ON DELETE CASCADE;
alter table employee_roles add constraint employee_roles_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
alter table stage_template_required_roles add constraint stage_template_required_roles_stage_template_id_fkey FOREIGN KEY (stage_template_id) REFERENCES stage_templates(id) ON DELETE CASCADE;
alter table project_coordinator_history add constraint project_coordinator_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES app_users(id);
alter table project_coordinator_history add constraint project_coordinator_history_new_employee_id_fkey FOREIGN KEY (new_employee_id) REFERENCES employees(id);
alter table project_coordinator_history add constraint project_coordinator_history_old_employee_id_fkey FOREIGN KEY (old_employee_id) REFERENCES employees(id);
alter table project_coordinator_history add constraint project_coordinator_history_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
alter table site_stage_required_roles add constraint site_stage_required_roles_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES site_stages(id) ON DELETE CASCADE;
alter table site_role_assignment_history add constraint site_role_assignment_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES app_users(id);
alter table site_role_assignment_history add constraint site_role_assignment_history_new_employee_id_fkey FOREIGN KEY (new_employee_id) REFERENCES employees(id);
alter table site_role_assignment_history add constraint site_role_assignment_history_new_team_id_fkey FOREIGN KEY (new_team_id) REFERENCES teams(id);
alter table site_role_assignment_history add constraint site_role_assignment_history_old_employee_id_fkey FOREIGN KEY (old_employee_id) REFERENCES employees(id);
alter table site_role_assignment_history add constraint site_role_assignment_history_old_team_id_fkey FOREIGN KEY (old_team_id) REFERENCES teams(id);
alter table site_role_assignment_history add constraint site_role_assignment_history_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
alter table site_role_assignment_history add constraint site_role_assignment_history_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES site_stages(id) ON DELETE CASCADE;
alter table site_team_assignment_history add constraint site_team_assignment_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES app_users(id);
alter table site_team_assignment_history add constraint site_team_assignment_history_new_team_id_fkey FOREIGN KEY (new_team_id) REFERENCES teams(id);
alter table site_team_assignment_history add constraint site_team_assignment_history_old_team_id_fkey FOREIGN KEY (old_team_id) REFERENCES teams(id);
alter table site_team_assignment_history add constraint site_team_assignment_history_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;
alter table site_stage_role_assignments add constraint site_stage_role_assignments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id);
alter table site_stage_role_assignments add constraint site_stage_role_assignments_stage_id_role_code_fkey FOREIGN KEY (stage_id, role_code) REFERENCES site_stage_required_roles(stage_id, role_code) ON DELETE CASCADE;
alter table site_stage_role_assignments add constraint site_stage_role_assignments_team_id_fkey FOREIGN KEY (team_id) REFERENCES teams(id);
alter table site_move_history add constraint site_move_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES app_users(id);
alter table site_move_history add constraint site_move_history_new_project_id_fkey FOREIGN KEY (new_project_id) REFERENCES projects(id) ON DELETE SET NULL;
alter table site_move_history add constraint site_move_history_old_project_id_fkey FOREIGN KEY (old_project_id) REFERENCES projects(id) ON DELETE SET NULL;
alter table site_move_history add constraint site_move_history_site_id_fkey FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE;

create view site_role_assignments as
SELECT DISTINCT ss.site_id,     sra.role_code,     sra.employee_id    FROM site_stage_role_assignments sra      JOIN site_stages ss ON ss.id = sra.stage_id   WHERE sra.employee_id IS NOT NULL;
