# Start here — draw.io review session

Updated: 22 October 2026, Asia/Kolkata.

## Immediate task

The user explicitly asked to create neat, organized **screen-by-screen sketches in draw.io**, so they can understand the product and review it with a client. They then asked to move that work to a fresh session. Continue with the new requirements only; do not restore the old designs.

Read `docs/requirements-v0.4-working-draft.md` first. It is the current, concise Gujarati requirements baseline. This handoff explains context and next work; it does not add product requirements.

Communicate with the user in simple Gujarati, keep updates short, and avoid long explanations. They have little time to read. Work autonomously on the already authorized sketches. Ask only material unresolved product questions; show proposals as proposals.

## Repository and reset

- Workspace: `/Users/dixit/Coding/site-tracking-system`.
- Git: `https://github.com/dbmoradiya/site-tracking-system.git`, branch `develop`.
- User previously authorized commits and pushes to `develop`; inspect status before changing files.
- `fa351c4` deliberately removed ALL previous screens, Penpot designs, PDFs, old system design, tests, generators, dependencies and local runtime configuration. The user wanted a fresh start from the reduced requirements.
- `f6da388` limited mobile to Android.
- Old work remains in Git history only for recovery. It is **not** the active baseline. Do not revive its large screen catalogue, Docker/Penpot setup or removed features.
- No production backend, web application or Android application exists in the current tree.

## Confirmed product model

1. **Roles:** Admin, Project Coordinator, Supervisor. These are independent account roles. Execution Team is a contact record, not an app user.
2. **Platforms:** Admin and Coordinator both use web + Android; Supervisor uses Android only. No iOS.
3. **Project required:** every Site belongs to exactly one Project, even if that Project has only one Site. A Project can group multiple different Site types, such as Shed and Solar. No standalone Site.
4. **Creation/configuration:** Admin alone creates and edits Projects/Sites, their details and Project links; only Admin moves a Site between Projects. Admin defines Site types and default stages, creates Coordinator/Supervisor employees, and creates/edits Team contact records.
5. **Coordinator per Site:** one Coordinator for each Site, not one for an entire Project. Linked Sites may have different Coordinators.
6. **Assignment per stage:** each stage gets its own Supervisor and Team. Admin or that Site's Coordinator can assign/change either or both, including while work is in progress.
7. **No reporting mapping:** no permanent Supervisor → Coordinator mapping or owned list of Supervisors. Any Coordinator can assign any Supervisor on their own Sites. A Supervisor can work on stages belonging to multiple Coordinators' Sites. Do not introduce a reporting-Coordinator field or a reporting-transfer workflow.
8. **Visible assignment history:** show previous/new Supervisor and Team, who changed them, and when; retain every change. Preserve earlier photos, author attribution, progress and approval history; reassignment does not reset the work.
9. **Photos and approval:** Supervisor adds photos and submits stage completion. Admin or responsible Site Coordinator approves or requests changes. Supervisor cannot approve.
10. **Coordinator covering absence:** Coordinator can obtain photos from a Team and upload as themselves. They may then separately approve their own submission. Upload, submission and approval remain separate actions; uploading does not automatically complete a stage. Do not impersonate the absent Supervisor or silently reassign the stage.
11. **Access:** Admin can upload/review across all Sites. Coordinator can assign, upload and review only on their own Sites. Another Coordinator's linked Site exposes basic progress only, not private photos, evidence or mutation/approval controls. Supervisor sees assigned work and necessary Site/Team context.
12. **Teams:** name and contact person details only; no account/login. Admin alone adds/edits Team details. Coordinator/Supervisor can view contacts connected to their authorized work. Assignment rights do not imply Team contact-edit rights.
13. **Online photo uploads:** internet is mandatory for uploading. No offline work queue, automatic synchronization or seven-day offline unlock. Interrupted/failed uploads must not appear successful or count as completion evidence; allow explicit retry when connected.
14. **Removed:** entire materials/inventory/requests/dispatch/consumption/returns module; all GPS/location permissions and photo-location requirements; offline/sync; iOS; Team logins.

## Main journey to illustrate

Admin configures types/stages and creates people/Teams → Admin creates Project → Admin creates Sites inside it and identifies each Site's Coordinator → Admin/Coordinator assigns Supervisor + Team per stage → Supervisor sees work, adds photos online and requests completion → Admin/Site Coordinator reviews and approves or requests changes.

Also illustrate: direct Coordinator photo upload + explicit self-approval; Supervisor/Team handover with visible history; linked Sites with different Coordinators and limited cross-Site access; online upload failure/retry.

## Scope not yet settled

Do not label these as confirmed:

- Blocking/pausing work and reopening completed work.
- Dependencies such as Shed must finish before Solar starts. Project grouping itself **is confirmed**.
- Whether final stage approval automatically completes a Site, and precise Site/Project status derivation. This was in the removed design; confirm or clearly label a proposal in the new review.
- Final language scope. Earlier sessions mentioned English admin and English/Hindi/Gujarati mobile, but the reduced requirements explicitly leave languages to settle. Gujarati review annotations are appropriate; do not claim complete product localization.
- Other old features such as audio notes, daily reminders, advanced dashboards, bulk actions, old eligibility restrictions and account/password policies must not be silently restored.
- Historical stack choice was Spring Boot + SQLite + React + Flutter. This is background, not authorization to implement the application now.

## Deliverable direction already discussed

- Editable multi-page `.drawio` file with actual native shapes/text, not screenshots embedded as one image.
- Organized role/platform sections, an overall flow diagram and a simple permissions summary.
- Neat screen sketches: meaningful name/ID, purpose, fields, main actions, next-screen references, and short Gujarati review annotations. Show role differences accurately.
- Practical reusable layouts; simple employee flow and readable controls. The user cares about a polished, uncluttered appearance, even for sketches.
- One convenient client review PDF with sketches and concise notes. A short guided review plus a full appendix is a possible approach, not a fixed page-count requirement.
- Keep unconfirmed decisions clearly marked. These are wireframes, not final visual UI or an implemented app.
- Independently validate permissions, source consistency, page links, editable shape import, Gujarati font rendering and text bounds; visually inspect representative web/Android/history/review/error pages.
- No old Penpot infrastructure or Docker is needed. Do not create a production app or a new large dependency setup for diagram work.

## Actual preparation completed before handoff

**No draw.io sketches, diagrams or PDFs have been created yet.** Only initial research and font preparation were done:

- `review/assets/NotoSansGujarati.ttf`: Google Fonts Noto Sans Gujarati variable font.
- `review/assets/OFL-NotoSansGujarati.txt`: accompanying license.
- Empty `review/tools` and `review/screens` directories may exist locally; Git does not retain empty directories.
- Playwright 1.64.1 was installed in `/tmp/site-tracking-drawio-tools` only, outside the repository. It may disappear; do not rely on it being permanent.
- Available local headless executable at the time of handoff: `/Users/dixit/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell`. Check before use. Earlier installed Google Chrome did not consistently start its automation pipe; cached headless shell worked.
- Old Python preview server on port 4173 was stopped. Local `site-tracking-design` Docker/Penpot containers were stopped/removed during reset. Do not start them for this task.

A lightweight suggested implementation is a small reproducible generator for native draw.io XML and review exports, with tooling limited to `review/`. The implementation method and page count are not decided; prioritize the requested artifact over overengineering.

## Official references checked

- Native `.drawio` format is uncompressed XML: https://www.drawio.com/docs/manual/editor/save-file-formats/
- Diagram types, including wireframes: https://www.drawio.com/docs/diagram-types/
- Multi-page PDF export: https://www.drawio.com/docs/manual/export/export-to-pdf/
- Embedding/import/export protocol: https://www.drawio.com/docs/reference/embed-mode/

Embed API can load XML with `{action:'load', xml:'<mxfile>...</mxfile>'}`. After initialization, it supports export messages such as `{action:'export', format:'svg', pageId:'...'}` and JSON exports for model inspection. Verify the live official docs if using this route. This can help prove import into the actual draw.io editor rather than only validating generated XML. Use sample records only; no real employee/client data has been supplied.

## Suggested first steps

1. Read this file and the Gujarati baseline; check Git state and any applicable instructions.
2. Build a compact screen inventory against only confirmed requirements, with pending decisions noted.
3. Create the editable draw.io sketches and an easy client review PDF.
4. Test and visually inspect, then commit/push the completed review artifacts to `develop` and give the user direct file links with a short Gujarati explanation.
