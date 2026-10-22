# Start here — SiteTrack application development

Updated: 22 October 2026, Asia/Kolkata.

## Immediate task

The user approved moving beyond the draw.io review into actual application development. The repository now contains a Dockerized PostgreSQL database, Spring Boot API and responsive installable React PWA. Continue with the current requirements only; do not restore old designs or removed features.

Read `docs/requirements-v0.4-working-draft.md` first. It is the current, concise Gujarati requirements baseline. This handoff explains context and next work; it does not add product requirements.

Communicate with the user in simple Gujarati, keep updates short, and avoid long explanations. The product interface itself must remain English-only. Ask only material unresolved product questions; show proposals as proposals.

## Repository and reset

- Workspace: `/Users/dixit/Coding/site-tracking-system`.
- Git: `https://github.com/dbmoradiya/site-tracking-system.git`, branch `develop`.
- User previously authorized commits and pushes to `develop`; inspect status before changing files.
- `fa351c4` deliberately removed ALL previous screens, Penpot designs, PDFs, old system design, tests, generators, dependencies and local runtime configuration. The user wanted a fresh start from the reduced requirements.
- `f6da388` limited mobile to Android.
- Old work remains in Git history only for recovery. It is **not** the active baseline. Do not revive its large screen catalogue, Docker/Penpot setup or removed features.
- The active implementation uses one React PWA for web and Android, a Spring Boot API, and PostgreSQL through Docker Compose.

## Confirmed product model

1. **Roles:** Admin, Project Coordinator, Supervisor. These are independent account roles. Execution Team is a contact record, not an app user.
2. **Platforms:** Admin and Coordinator both use web + Android; Supervisor uses Android only. No iOS.
3. **Interface language:** web and Android interfaces are always English only. No Gujarati, Hindi or other product localization is supported. Continue communicating with the user in Gujarati.
3a. **Delivery platform:** use one responsive installable React PWA for web and Android. Do not create a separate native Android codebase at this stage.
3b. **Location:** Google Maps/location picker is removed for now. Keep ordinary text address fields; do not add GPS permissions.
4. **Project required:** every Site belongs to exactly one Project, even if that Project has only one Site. A Project can group multiple different Site types, such as Shed and Solar. No standalone Site.
5. **Creation/configuration:** Admin alone creates and edits Projects/Sites, their details and Project links; only Admin moves a Site between Projects. Admin defines Site types and default stages, creates Coordinator/Supervisor employees, and creates/edits Team contact records.
6. **Coordinator per Site:** one Coordinator for each Site, not one for an entire Project. Linked Sites may have different Coordinators.
7. **Assignment per stage:** each stage gets its own Supervisor and Team. Admin or that Site's Coordinator can assign/change either or both, including while work is in progress.
8. **No reporting mapping:** no permanent Supervisor → Coordinator mapping or owned list of Supervisors. Any Coordinator can assign any Supervisor on their own Sites. A Supervisor can work on stages belonging to multiple Coordinators' Sites. Do not introduce a reporting-Coordinator field or a reporting-transfer workflow.
9. **Visible assignment history:** show previous/new Supervisor and Team, who changed them, and when; retain every change. Preserve earlier photos, author attribution, progress and approval history; reassignment does not reset the work.
10. **Photos and approval:** Supervisor adds photos and submits stage completion. Admin or responsible Site Coordinator approves or requests changes. Supervisor cannot approve.
11. **Coordinator covering absence:** Coordinator can obtain photos from a Team and upload as themselves. They may then separately approve their own submission. Upload, submission and approval remain separate actions; uploading does not automatically complete a stage. Do not impersonate the absent Supervisor or silently reassign the stage.
12. **Access:** Admin can upload/review across all Sites. Coordinator can assign, upload and review only on their own Sites. Another Coordinator's linked Site exposes basic progress only, not private photos, evidence or mutation/approval controls. Supervisor sees assigned work and necessary Site/Team context.
13. **Teams:** name and contact person details only; no account/login. Admin alone adds/edits Team details. Coordinator/Supervisor can view contacts connected to their authorized work. Assignment rights do not imply Team contact-edit rights.
14. **Online photo uploads:** internet is mandatory for uploading. No offline work queue, automatic synchronization or seven-day offline unlock. Interrupted/failed uploads must not appear successful or count as completion evidence; allow explicit retry when connected.
15. **Removed:** entire materials/inventory/requests/dispatch/consumption/returns module; all GPS/location permissions and photo-location requirements; offline/sync; iOS; Team logins.
16. **Stage templates:** each Site Type owns its default Stages and dependencies. Admin alone maintains templates. Creating a Site loads those defaults, and Admin may customize that Site's Stage names, order and dependencies.
17. **Evidence:** every Stage requires at least one successfully uploaded evidence file before completion can be submitted.
18. **Status rules:** approving every Stage automatically completes the Site. A Project completes when every Site is complete. Otherwise use `IN_PROGRESS` once work has started and `NOT_STARTED` before work starts.
19. **Project customer:** customer name and customer mobile number are required when an Admin creates a Project.
20. **No separate work screen:** evidence upload, comment and completion submission live in expandable Site/Stage sections on Project detail. Site detail is for review, assignment and audit history.
21. **Project filters:** location/address, completion date range, Supervisor, Coordinator, status and role-aware action-required filters.
22. **Notifications:** every role sees pending actions on the Dashboard. Admin/Coordinator see review and assignment work; Supervisor sees evidence work and requested changes.
23. **Setup presentation:** Site Types, Employees and Teams use card grids. A card opens read-only details in a modal; editing an existing record begins only from the modal's Edit button.
24. **Assignment visibility:** Employee and Team detail modals show assigned Projects.

## Main implemented journey

Admin configures types/stages and creates people/Teams → Admin creates Project → Admin creates Sites inside it and identifies each Site's Coordinator → Admin/Coordinator assigns Supervisor + Team per stage → Supervisor sees work, adds photos online and requests completion → Admin/Site Coordinator reviews and approves or requests changes.

The current vertical slice implements this journey through role-aware pages and APIs. Coordinator photo upload + explicit approval is available inside the Project → Site → Stage flow. Assignment/review audit data is retained by the API.

## Scope not yet settled

Do not label these as confirmed:

- Blocking/pausing work and reopening completed work.
- Cross-Site dependencies such as Shed finishing before Solar starts are still not defined. Dependencies inside each Site's Stage list are confirmed.
- Other old features such as audio notes, daily reminders, advanced dashboards, bulk actions, old eligibility restrictions and account/password policies must not be silently restored.
- Advanced dashboards, bulk actions and account/password policies remain undefined.

## Current implementation

- `compose.yaml`: PostgreSQL 17, Spring Boot API on port 8081, React/Nginx PWA on port 8080.
- `backend/`: Java 21 / Spring Boot 4.1.1, Flyway schema, token authentication, role/access checks, project/site/stage/setup APIs, evidence uploads and automatic statuses.
- `frontend/`: React 19 / TypeScript / Vite, responsive desktop sidebar and mobile bottom navigation, installable manifest/service worker, Admin setup and creation flows, Project filters, Dashboard notifications, and evidence work within Site stages.
- `design-system/site-tracking-system/MASTER.md`: active visual system generated with the UI/UX Pro Max skill.
- Run with `docker compose up --build`; use the demo accounts in `README.md`.

## Verification completed

- Frontend production TypeScript/Vite build passes.
- Backend Maven package build passes in Docker.
- Flyway migration applies successfully to PostgreSQL.
- Login, dashboard/setup/project reads, evidence upload, submit, approval, automatic Site completion and automatic Project completion were exercised through the API.
- Direct unauthorized Project access returns 403; invalid dependencies return 400; resubmitting/re-uploading to an approved Stage returns 409.
- Docker services are left running and healthy after delivery.

## Suggested next steps

1. Read this file and the Gujarati baseline; check Git state and any applicable instructions.
2. Preserve the current vertical slice and do not reintroduce removed features.
3. Prioritize visible evidence/history views and Admin editing for existing Project/Site records if the user wants the next implementation increment.
4. Keep unresolved pause/reopen and cross-Site dependency rules out until the user decides them.
