# Next session handoff — implement SiteTrack v0.5 changes

Updated: 22 October 2026, Asia/Kolkata.

## Immediate objective

Implement the confirmed v0.5 requirements end-to-end in the existing Dockerized Spring Boot/PostgreSQL/React PWA application.

Start by reading this file completely, then read `docs/requirements-v0.4-working-draft.md` completely. The requirements file is the product source of truth. This handoff explains the implementation sequence and current code constraints; it does not override the requirements.

Communicate with the user in simple Gujarati. All product UI, validation messages and stored role labels must remain English-only. Do not restore old designs, removed screens, materials, GPS, offline sync, iOS or a separate native mobile application.

The user wants the changes implemented, not another draw.io/PDF exercise.

## Repository

- Workspace: `/Users/dixit/Coding/site-tracking-system`
- Git branch: `develop`
- Remote: `https://github.com/dbmoradiya/site-tracking-system.git`
- Latest requirements commit at handoff: `b9cee0a`
- The user previously authorized normal commits and pushes to `develop` for this work.
- Inspect `git status` before editing and preserve unrelated user changes.

Current stack:

- PostgreSQL 17 in Docker
- Java 21 / Spring Boot 4.1.1 / JDBC / Flyway backend
- React 19 / TypeScript / Vite frontend
- Nginx production frontend on port 8080
- Backend on port 8081
- One responsive installable PWA for desktop Web and Android Chrome

Run with:

```sh
docker compose up -d --build
```

## Data reset authorization and protected backup

Backward-compatible database migration is not required. The user explicitly allowed current Projects, Sites, evidence, workflow history and uploaded evidence files to be deleted while implementing the redesign.

However, the current client-created setup records must be preserved:

- Employees
- Teams
- Site Types
- Site Type Stage definitions and dependencies

A verified backup exists at:

`data/backups/2026-10-22-client-setup/`

It contains:

- 4 Employees
- 2 Teams
- 2 Site Types
- 21 Stage Templates and dependencies
- Full PostgreSQL dump/SQL snapshots
- Data-only dump/SQL snapshots
- Portable CSV files
- Checksums and restore notes in its `README.md`

The full archive was restored into a temporary database and the counts were verified. The directory is intentionally under ignored `data/` because it contains client contact information. Never add this directory to Git, never delete it during cleanup and do not expose its contents in chat unless necessary.

It is safe to reset the Docker PostgreSQL and upload volumes after confirming the backup directory still exists and its files are readable. A volume reset must not remove the host-side `data/backups/` directory.

When the new schema is ready, restore the client setup records from CSV. Do not guess fields that do not exist in the old data. In particular:

- Existing employees have one old role that can be used as their initial new role; ask before adding any additional roles.
- Existing Stage Templates do not contain the new Required Roles. Before final import, present the Site Type/Stage list to the user and ask which roles each Stage requires. Empty Required Roles means a no-role Stage, so it must not be used as a silent default.
- Existing Teams have no new Site assignment because old Projects/Sites may be discarded. Do not invent assignments.

Implementation and testing can proceed with explicit demo seed mappings, but the final client-data import must wait for those missing client decisions.

## Current code model that must be replaced

The current implementation is a working vertical slice, but its data model is hardcoded around:

- one `employees.role`
- one `app_users.role` and one JWT authority
- `sites.coordinator_id`
- `site_stages.supervisor_id`
- `site_stages.team_id`
- supervisor-specific access SQL
- evidence work duplicated on Project Detail
- only 25 notifications returned, with only 8 shown on Dashboard

Key current files:

- `backend/src/main/resources/db/migration/V1__initial_schema.sql`
- `backend/src/main/resources/db/migration/V2__evidence_comments.sql`
- `backend/src/main/java/com/sitetrack/security/*`
- `backend/src/main/java/com/sitetrack/service/WorkflowService.java`
- `backend/src/main/java/com/sitetrack/api/{Auth,Dashboard,Notification,Project,Setup,Stage}Controller.java`
- `frontend/src/lib/{api,auth}.tsx`
- `frontend/src/pages/{Dashboard,Projects,ProjectDetail,SiteDetail,NewProject,NewSite,Setup}Page.tsx`
- `frontend/src/components/{AppShell,EvidenceAction}.tsx`
- `frontend/src/styles.css`

Because the database may be reset, replace the initial schema cleanly rather than adding legacy/backfill compatibility branches. Keep Flyway valid for a fresh database. It is acceptable to consolidate the evidence comment field into the new initial schema and remove the obsolete second migration if the database is reset before verification.

## Target domain model

Use a generic role model, not more hardcoded supervisor columns.

### Employees and authentication

- Business role codes: `COORDINATOR`, `SUPERVISOR`, `DESIGN_ENGINEER`, `PROCUREMENT_MANAGER`.
- One employee can have multiple roles through `employee_roles(employee_id, role_code)`.
- Admin remains a system-level account role.
- Linked employee users derive their authorities from `employee_roles`.
- JWT/user payload must contain `roles: []`, not one `role`.
- Spring Security must create one authority per role.
- Multi-role access is the union of the user's authorities and actual Site assignments.
- Do not invent a new account/password provisioning workflow; account policy remains unresolved. Keep the current demo-login mechanism working and seed enough linked users to test each permission path.

### Projects

- Add required `projects.coordinator_id`.
- Project Coordinator is project-level.
- Admin can change it.
- Store every change in `project_coordinator_history` with old/new employee, actor and timestamp.
- Admin can delete a Project after an explicit confirmation.
- Project deletion cascades through Sites, Stages, evidence database records and histories, and also cleans physical evidence files.

### Sites, teams and assignments

- Remove Site Coordinator as the primary manager; management is through the Project Coordinator.
- A Site belongs to exactly one Project.
- Operational roles are assigned at Site level in `site_role_assignments(site_id, role_code, employee_id)`.
- Store every role reassignment in generic Site assignment history.
- A single employee may fill multiple roles on one Site.
- Add an optional Site-level Team assignment. Do not keep Team as a fixed per-Stage role.
- Store Team assignment changes in history.

### Stage templates and Site stages

- A Stage Template may require zero, one or multiple roles through a join table.
- When a Site is created, copy the chosen templates, dependencies and required roles into Site-specific Stage records/join rows.
- Admin can customize Stage name, order, dependency and required roles before creating the Site.
- All Stages require evidence, including no-role Stages.

Recommended relational shape:

- `employee_roles`
- `stage_template_required_roles`
- `site_stage_required_roles`
- `site_role_assignments`
- `site_role_assignment_history`
- `site_team_assignment_history`
- `project_coordinator_history`

Names may vary, but keep the relationships generic and queryable.

## Required workflow behavior

### Assigned-role Stage

- Any employee assigned on the Site to one of that Stage's required roles can view the Stage, upload evidence with an optional text comment and submit it for approval.
- Admin retains full access.
- Project Coordinator can review the Project's Sites.
- Submission requires:
  - dependency complete;
  - at least one successfully uploaded evidence file;
  - an assigned employee for every required role.
- Admin or Project Coordinator can approve or request changes.
- Requesting changes requires a reason.
- Assignment changes must not erase evidence, comments, reviews or progress.

### No-role Stage

- No employee assignment is required.
- Admin or Project Coordinator uploads the required evidence/comment.
- Admin or Project Coordinator uses `Mark Complete` directly; there is no employee submission/approval round-trip.
- Record who completed it and when.
- Completion unlocks dependent Stages.

### Status calculation

- Initial Project/Site: `NOT_STARTED`.
- Evidence/work starts: Site and Project become `IN_PROGRESS`.
- Role-based approved Stages and no-role completed Stages both count as terminal completion.
- All Stages terminal → Site `COMPLETED` automatically.
- All Sites completed → Project `COMPLETED` automatically.
- Final-stage approval/completion must not require another Site completion action.

Keep status calculation centralized in `WorkflowService`, not duplicated across controllers.

## Backend implementation work

1. Rebuild the clean schema and seed data around the target model.
2. Refactor `AppPrincipal`, token issue/parse, authentication authorities and frontend user type to roles arrays.
3. Replace every role switch and every `supervisor_id` access query with capability/assignment-based checks.
4. Update Setup APIs:
   - Employee requests/responses use `roles: []`.
   - Site Type Stage requests/responses use `requiredRoles: []`.
   - Assigned Projects use generic Site role/Team/Coordinator relationships.
5. Update Project APIs:
   - Create Project with Coordinator.
   - Change Coordinator and return history.
   - Delete Project as Admin.
   - Return role-aware people information and action counts.
6. Update Site creation/default APIs:
   - copy/customize Stage required roles;
   - accept Site-level role assignments;
   - accept optional Team.
7. Update Stage APIs:
   - generic role access;
   - assigned-role evidence/submit/review;
   - no-role evidence/direct completion;
   - generic assignment and review history.
8. Update Notifications API:
   - role-aware pending actions;
   - total count;
   - pagination or an equivalent unbounded full-page flow;
   - no hardcoded `limit 25` for the full page.
9. Keep evidence path validation, upload size validation and authorization on evidence download.

Use services for workflow/permission/deletion logic where controllers would otherwise become larger. Avoid embedding the same SQL authorization rules in multiple controllers.

## Frontend implementation work

### Overview and Projects

- Make all four Overview metric cards accessible links:
  - `/projects`
  - `/projects?status=IN_PROGRESS`
  - `/projects?status=NOT_STARTED`
  - `/projects?status=COMPLETED`
- `ProjectsPage` must read/write filter state through URL search parameters so refresh and browser Back preserve it.
- Keep the existing advanced filters and make assignee filtering work with dynamic roles rather than only a hardcoded Supervisor column.

### Notifications

- Add `NotificationsPage.tsx` and `/notifications` route.
- Add Notifications to responsive navigation without exceeding five mobile bottom-nav destinations.
- Dashboard shows latest 8 plus total and a `View all notifications` link.
- Full page shows all pending actions with search/useful filters.
- Notification links go to the relevant Site Detail Stage, not only the Project.

### Setup

- Employee create/edit uses an accessible multi-select or checkbox group for roles.
- Employee cards/read-only modal show all role badges.
- Site Type Stage editor supports Required Roles multi-select, including an intentional empty selection.
- Site Type read-only modal displays required roles per Stage.
- Preserve the existing card-grid → read-only modal → Edit button interaction.

### Project and Site creation/detail

- New Project requires a Project Coordinator.
- Project Detail shows Coordinator, change history and Admin actions.
- Add an Admin-only Delete Project action with a real confirmation dialog; do not use a destructive one-click action.
- Remove `Show Stages`, inline Stage expansion, evidence upload and submission from Project Detail.
- Do not prefetch every Site's full detail from Project Detail.
- Project Site cards expose only `Open Site Details` and progress.
- New Site derives distinct required roles from its Stages and shows eligible employee dropdowns per role plus optional Team.
- Site Detail becomes the only execution screen and contains assignments, Stage timeline, evidence upload/comment, submission, review, no-role completion, evidence/history and assignment history.
- Support direct notification links to a Stage using a URL fragment or query parameter and scroll/focus the target accessibly.

### Compact UI

Apply a consistent compact-density pass across the whole app:

- reduce desktop heading sizes, page/card padding, grid gaps and oversized metric/card heights;
- keep hierarchy and readable contrast;
- keep mobile touch targets at least 44–48px;
- preserve focus indicators, safe-area offsets, keyboard access and reduced-motion behavior;
- verify at 375px, tablet width, desktop width and phone landscape;
- do not shrink text/touch controls indiscriminately on mobile.

Use the installed `ui-ux-pro-max` skill for this UI implementation and follow its pre-delivery checks.

## Tests and verification

The repository currently lacks meaningful automated coverage. Add proportionate tests for this refactor.

Backend cases to cover:

- multi-role login/authorities;
- Project access as Admin, Coordinator and Site-assigned operational roles;
- denial for unassigned employees;
- evidence upload by each required assigned role;
- submission blocked when a required role is unassigned;
- no-role Stage evidence and direct completion;
- dependency unlock;
- changes-requested/resubmission;
- final Stage → Site complete;
- all Sites → Project complete;
- Coordinator change/history;
- Site role and Team change/history;
- Project deletion and evidence-file cleanup;
- role-aware notifications.

Frontend/build verification:

- production TypeScript/Vite build;
- Overview metric deep links and URL filters;
- multi-role employee UI;
- Site Type required-role editor;
- dynamic New Site assignments;
- Site Detail execution workflow;
- notification full page and Stage deep links;
- delete confirmation;
- compact responsive layouts.

Runtime verification:

- reset/start PostgreSQL cleanly;
- run Flyway from a fresh volume;
- build backend and frontend in Docker;
- exercise representative API journeys for every role;
- confirm ports 8080/8081 and ngrok-origin CORS still work;
- confirm manifest/service worker/PWA changes from `fa1464a` are not regressed.

## Suggested execution order

1. Re-read requirements and inspect Git/runtime state.
2. Confirm the protected backup exists; do not modify it.
3. Create the clean target schema and reset the disposable DB/upload volumes.
4. Implement multi-role authentication and centralized authorization.
5. Implement Setup and Stage-template Required Roles.
6. Implement Project Coordinator/history/delete.
7. Implement Site creation and Site-level role/Team assignments.
8. Implement assigned-role and no-role Stage workflows.
9. Implement Overview URL filters and Notifications page.
10. Consolidate execution into Site Detail and simplify Project Detail.
11. Apply the compact UI pass.
12. Add/run tests and complete Docker/API/responsive verification.
13. Ask the user for missing client Stage Required Roles/additional employee roles, then import the protected setup data.
14. Update requirements/handoff if decisions changed, commit coherent increments and push `develop`.

## Explicit non-goals and unresolved items

Do not implement without a new user decision:

- reopening approved/completed Stages;
- cross-Site dependencies;
- account invitation/password-management workflows;
- materials/inventory;
- GPS/Maps/photo location;
- offline queue/sync;
- native Android/iOS code;
- Team login;
- any feature recovered from old Git history merely because it once existed.

If a required client import field is missing, stop only that import step, present the exact missing mappings in simple Gujarati and continue any implementation/testing work that does not depend on the answer.
