# FIELDWORK — Design verification report

Source: system design v0.2 · SHA-256 `6092666676dd5e9817e2e829b0010a0ad80361d7d6fe25103e0a343875a54e62`.

## What was checked

- 152 screen/state designs, 168 total native boards, 9 journeys, 6 reusable native components and shared colors/typographies/tokens.
- All 152 SVG screens rendered in Chromium; 3755 text nodes measured; 0 overflow/out-of-board findings and 0 page errors.
- 19 automated design-contract tests passed, covering native editable shapes, real prototype destinations, source-version consistency, evidence/location rules, credential controls, stock lifecycle, closeout, localized labels, 44px mobile targets, and 4.5:1 semantic text contrast.
- Browser clicks exercised composer → location → photo → composer, and final approval → completed site. Gallery local-note persistence and a 390px review viewport were checked.
- Native Penpot verification: **passed**. See [machine-readable verification](penpot-verification.json) when available.
- Representative rendered screens were visually inspected, including dashboard, employee creation, English mobile home, and Gujarati home.

## Scope of the result

This is a design and click-through prototype delivery. Form values, GPS readings, media, audio, permissions and stock are illustrated states. The SVG review gallery is not the implemented React application, the Penpot employee boards are not a compiled Flutter app, and no Spring Boot/SQLite business backend has been built. Design coverage is not proof of runtime authorization, cryptography, inventory concurrency, real device GPS, recording, backup recovery or offline durability. These are explicitly deferred integration/device checks, not reported as passing here.

English canonical screens and 14 Hindi/Gujarati examples are included. Complete localization, device screen-reader behavior, native platform permission dialogs and linguistic review must be validated during implementation. Proposed accuracy/media/cache settings remain proposals from the source document.

## Acceptance traceability

| Source # | Acceptance criterion | Design evidence | Runtime follow-up |
| --- | --- | --- | --- |
| 1 | Admin provisioning creates exactly one loginable admin; a second invocation does not replace it; no plaintext credential is persisted. | [A01](index.html#A01) | Admin creation, unique-admin constraint and password persistence require backend integration tests. |
| 2 | Creating/editing an employee records language and multiple eligible types. An employee eligible for Solar and Shed can hold one site of each type and sees the selected English/Hindi/Gujarati interface. Removing an actively assigned type requires resolving its assignments. | [A38](index.html#A38), [A39](index.html#A39), [M45](index.html#M45), [M46](index.html#M46) | Implement and test the documented behavior; design contract checked. |
| 3 | Site creation copies stage templates. Editing the template later leaves existing sites unchanged. | [A05](index.html#A05), [A06](index.html#A06), [A35](index.html#A35) | Implement and test the documented behavior; design contract checked. |
| 4 | A published site with no employee is New; assigning an eligible employee makes it Assigned. Admin and the current assignee can read full details and evidence; other employees cannot. | [A13](index.html#A13), [M33](index.html#M33), [M37](index.html#M37) | Server authorization must be exercised with authenticated roles. |
| 5 | Independent stages run in parallel; unmet explicit dependencies prevent starting/submitting the dependent work. | [A06](index.html#A06), [A31](index.html#A31), [M23](index.html#M23) | Implement and test the documented behavior; design contract checked. |
| 6 | An evidence-required stage cannot be submitted with only a failed/unfinished upload, an unlocated photo, text, or audio. An evidence-optional stage can be submitted without a photo; any photo attached still requires location. | [A16](index.html#A16), [M17](index.html#M17), [M18](index.html#M18) | Implement and test the documented behavior; design contract checked. |
| 7 | Rejection preserves the attempt and reason. Resubmission creates another attempt. Final valid approval completes the site exactly once. | [A22](index.html#A22), [A23](index.html#A23), [M19](index.html#M19), [M20](index.html#M20), [A65](index.html#A65), [A75](index.html#A75) | Atomic completion and duplicate approvals require backend transactions. |
| 8 | A blocked overdue site displays both conditions. Passing midnight changes overdue results without a workflow update. | [A04](index.html#A04), [M22](index.html#M22) | Implement and test the documented behavior; design contract checked. |
| 9 | Linked Shed/Solar sites have independent balances and assignments. A Shed dependency holds Solar until satisfied. Employees see only permitted linked-site context. | [A30](index.html#A30), [A31](index.html#A31), [M33](index.html#M33) | Implement and test the documented behavior; design contract checked. |
| 10 | Two simultaneous approvals cannot reserve the same stock twice. Partial dispatch consumes only dispatched reservations. Ledger and balances reconcile. | [A25](index.html#A25), [A26](index.html#A26) | Concurrent reservation correctness requires SQLite integration tests. |
| 11 | Multiple open material requests remain independent. Partial approval explicitly accounts for every residual quantity. | [M25](index.html#M25), [M27](index.html#M27), [A25](index.html#A25), [A57](index.html#A57) | Implement and test the documented behavior; design contract checked. |
| 12 | Consumption reduces site stock; pending returns cannot also be consumed. Only actual admin-confirmed return receipt increases warehouse stock. | [M29](index.html#M29), [M31](index.html#M31), [M32](index.html#M32), [A27](index.html#A27) | Implement and test the documented behavior; design contract checked. |
| 13 | Flutter offline text/photo/audio work survives restart, remains marked unsynced, and creates one server event after repeated retries. An upload failure never produces an invalid approval submission. | [M35](index.html#M35), [M16](index.html#M16), [M47](index.html#M47) | Durability across real Flutter process termination requires device tests. |
| 14 | Reassignment, deactivation, a new block, or a stock conflict while offline causes a visible server conflict and preserves recoverable input. | [M36](index.html#M36), [M37](index.html#M37), [M49](index.html#M49) | Implement and test the documented behavior; design contract checked. |
| 15 | Dashboard site counts exclude drafts/projects from active denominators; employee updates and admin edits affect daily metrics differently as specified. | [A02](index.html#A02), [A11](index.html#A11), [A48](index.html#A48) | Implement and test the documented behavior; design contract checked. |
| 16 | Reopening approved work preserves the audit trail, recalculates progress, and flags downstream dependency effects. | [A15](index.html#A15), [A31](index.html#A31) | Implement and test the documented behavior; design contract checked. |
| 17 | Hindi/Gujarati interfaces handle long labels, validation, empty states, and offline errors without clipping; business-entered text is preserved. | [M45](index.html#M45), [M46](index.html#M46), [M60](index.html#M60), [M61](index.html#M61), [M62](index.html#M62), [M63](index.html#M63), [M64](index.html#M64), [M65](index.html#M65), [M66](index.html#M66), [M67](index.html#M67), [M68](index.html#M68), [M69](index.html#M69), [M70](index.html#M70), [M71](index.html#M71) | Native fonts and accessibility require Android/iOS device checks. |
| 18 | Final stage approval automatically completes the site. Completed sites can reconcile material returns without reopening work; work mutations require reopening. | [A52](index.html#A52), [M43](index.html#M43), [M44](index.html#M44), [A65](index.html#A65) | Implement and test the documented behavior; design contract checked. |
| 19 | On photo addition, permission denial, disabled location services, or failure to obtain a fix prevents acceptance as evidence and leaves a recoverable draft. Every accepted site photo has valid position, accuracy, author, and observation time. | [M11](index.html#M11), [M12](index.html#M12), [M13](index.html#M13), [M14](index.html#M14) | Actual OS GPS and permission behavior requires device/browser tests. |
| 20 | A photo added offline at location A and synchronized later from location B retains location A. Automatic sync requires no fresh location and records server receipt separately. Gallery images are labeled with addition location, not claimed original shooting location. | [M47](index.html#M47), [M35](index.html#M35) | Implement and test the documented behavior; design contract checked. |
| 21 | Text-only, photo-only, audio-only, and combined progress updates work in Flutter and React. Empty updates are rejected. Required photo evidence cannot be replaced by audio. Audio playback and failed-upload retry work without duplicating updates. | [A17](index.html#A17), [A20](index.html#A20), [M10](index.html#M10), [M15](index.html#M15), [M18](index.html#M18) | Implement and test the documented behavior; design contract checked. |
| 22 | Admin can start work and add progress/media on assigned or unassigned published sites without becoming the assignee. Admin submissions enter Pending review; a separate explicit admin approval is required. Admin direct Block remains available. | [A07](index.html#A07), [A16](index.html#A16), [A17](index.html#A17), [A22](index.html#A22), [A24](index.html#A24), [A79](index.html#A79), [A80](index.html#A80) | Implement and test the documented behavior; design contract checked. |
| 23 | Employee first login has no password-change step. Employee password-change/reset attempts are rejected server-side; admin reset invalidates server sessions, preserves recoverable unsynced work, and requires the new password at next online authentication. | [A40](index.html#A40), [A58](index.html#A58), [M01](index.html#M01), [M03](index.html#M03), [M49](index.html#M49) | Credential hashing, reset enforcement and token revocation require backend tests. |
| 24 | Offline unlock is available within 7 days of successful online authentication and requires online login after expiry. Cache eviction never deletes unsynced media; reaching the pending-media limit gives a recoverable storage message. | [M38](index.html#M38), [M48](index.html#M48) | Real offline unlock and protected local storage require device tests. |
| 25 | Reminders run only after the configured cutoff on configured working days, are deduplicated, and keep daily notes optional. Admin field updates remain distinguishable from employee reports. | [A48](index.html#A48), [M40](index.html#M40) | Implement and test the documented behavior; design contract checked. |
| 26 | With SQLite, simultaneous reservations, stage approvals, and offline-sync retries preserve invariants. Foreign keys apply on every connection; an interrupted stock write leaves no partial ledger/balance/outbox posting, and a consistent backup restores with its media references. | [A25](index.html#A25), [A26](index.html#A26), [A27](index.html#A27), [A47](index.html#A47) | Concurrency, rollback and backup recovery require the implemented SQLite backend. |
| 27 | A Python-generated admin password hash authenticates through Spring Security; schema mismatch or a wrong SQLite file path fails provisioning safely. | [A01](index.html#A01) | Python-to-Spring Security hash interoperability requires the implemented authentication stack. |

## Corrections made during review

- Enlarged mobile filter and menu hit areas to at least 44px.
- Removed authenticated navigation from login, expired-unlock and reset-session screens; separated login language selection from signed-in profile language selection.
- Replaced English bottom navigation labels on Hindi/Gujarati examples.
- Corrected native Google font identifiers, supported font variant IDs, and Penpot corner-radius attributes after inspecting a real import.
- Removed review-only scenario buttons from product screens.
- Added explicit final-stage approval, no-photo completion, blocking/unblocking, dependency-cycle and publication-validation states.
- Distinguished site workflow from overdue, approved progress from pending review, and employee reports from admin activity.
- Reconciled the sample panel reservation/dispatch story: 12 reserved, 8 dispatched, 4 remain; residual request demand stays explicit.
- Added all daily dashboard categories and localized permission/error/validation examples.

## Reproduce

From the repository root:

```sh
npm ci
npm run design:build
npm run design:test
npm run design:review
# In a second terminal (requires installed Google Chrome):
node design/tools/browser-qa.mjs
node design/tools/report.mjs
```

The official Penpot builder generates the native file. Archive-level tests independently read its JSON shapes/links rather than merely trusting the generator. Browser checks measure actual rendered glyph bounds. Native-import evidence is recorded separately.
