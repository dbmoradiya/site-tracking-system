# UI research and stage assignment — revision 4

22 October 2026. Design proposal for roughly 20 employees and 50 active sites. This is desk research and prototype validation, not an employee usability study or a production benchmark.

## Research and resulting choices

| Primary reference | Observed principle or product behavior | Application to Fieldwork |
| --- | --- | --- |
| [Linear: assigning issues](https://linear.app/docs/assigning-issues) | Single responsible person; assignment from a list; personal work view and assignment history | One stage owner, compact Person column, searchable picker, preserved history. The coordinator remains a separate relationship. |
| [Asana: one assignee](https://asana.com/resources/why-one-assignee) | A single accountable owner gives responsibility a clear destination | Do not add a multi-person responsibility field by default. Other participants can become a later collaboration feature if required. |
| [Onsite public product UI](https://onsiteteams.com/) | Public examples organize site progress, materials and approvals into operational workspaces | Retain a consistent manager sidebar, site tabs and compact registers. Do not copy the ERP's full feature density into the employee app. Public marketing examples do not establish its actual usability or performance. |
| [NN/g: progressive disclosure](https://www.nngroup.com/articles/progressive-disclosure/) | Prioritize frequent actions; clearly label secondary features | Keep one next job, photo, voice and material request visible. Put stage history and material ledgers in labelled secondary views, without hiding blocked assigned work. |
| [Android accessibility](https://developer.android.com/design/ui/mobile/guides/foundations/accessibility) | Scalable text, labelled controls, sufficient contrast and touch area | 18sp main copy and 64dp primary actions are our field-use choices. Other mobile targets are at least 48dp; preserve semantics and large-text reflow in implementation. |
| [Apple accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Familiar, adaptable interaction and multiple ways to perceive information | Text with icons, explicit state words, VoiceOver labels, Dynamic Type and safe-area checks; never depend on color or gestures alone. |
| [Flutter performance](https://docs.flutter.dev/perf/best-practices) | Limit rebuild scopes, avoid costly layers, use lazy lists and avoid repeated intrinsic layout | Flat surfaces, small widgets, lazy owned-task lists, bounded decoded thumbnails; avoid decorative blur and continuous animation. |
| [Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals) | LCP, INP and CLS describe loading, responsiveness and stability | Adopt standard web thresholds as proposed release targets; measure the actual React app on representative devices. |

These are design inferences from primary sources, not claims that copying a popular application guarantees quality. The references inform responsibilities, hierarchy and interaction; our employee literacy, language and offline constraints determine the final design.

## Ownership model

Proposed default: one coordinator per site and one responsible employee per stage. Different stages can belong to different people. Unassigned stages remain visible to the manager. The earlier one-person-per-site rule becomes a coordinator relationship. This model and coordinator-only consumption/return initiation remain pending the optional clarification.

Example: Ravi coordinates Suryoday Solar and owns mounting and panel installation. Neha owns wiring. Admin sees all five stages in rows with Person, evidence/dependency and status. Ravi cannot start or submit Neha's wiring; Neha cannot mutate Ravi's panels. Admin can still perform its explicitly authorized field actions.

A template defines stages but no people. An explicit creation action copies a coordinator into selected stage assignments. Later coordinator changes never cascade silently. Bulk stage assignment previews selected stage names and affects only that explicit selection. Eligibility, active status, completed-stage safeguards and expected versions are validated in one transaction.

An accepted completion attempt survives reassignment, attributed to its original author. It can be reviewed, but not rewritten by the new owner. New changes require a new numbered attempt. Offline operations carry the original assignment ID/version; revoke/reassign/reassign-back does not make an old operation current. Quarantined work preserves the original author, content and photo-add location for controlled recovery.

## Manager design

Use a white canvas, restrained purple accent, consistent spacing, short headers, readable rows and fine separators. Stage rows contain a numbered marker, stage name, compact named person control, evidence/prerequisite summary and a written status. Person controls use initials plus names, not avatars alone. Unassigned is a visible named state. Avoid cards for stages and avoid charts where a count or row answers the question.

A81 shows the in-context owner picker; A82 a started-work handover; A83 explicit bulk assignment; A84 unassigned work; A85 stale-selection recovery. A13 edits the coordinator independently. Keyboard implementation must support focus, search, arrow navigation, Escape and returning focus to the originating Person cell. The static prototype illustrates the picker and decision states; it does not implement editable form controls.

## Employee design

Home: My work → site → one large action. The site shows the next eligible owned job; My jobs here changes the selected job. Never show another employee's actionable stage. Waiting jobs remain visible with an explanation; a coordinator without owned stages sees materials rather than a fabricated work task.

Use familiar words, labelled photo/microphone icons, no required typing, no mandatory caption, and a consistent Back destination. English/Hindi/Gujarati daily flows retain existing localization. Additional Neha worker-role boards are English role examples, not a claim of complete translated coverage. Materials have one site balance: workers can request more; coordinator records use/returns; admin confirms receipt. GPS remains mandatory at photo addition, and automatic sync preserves it.

## Resource and performance plan

| Area | Proposed target/constraint | How implementation must prove it |
| --- | --- | --- |
| Cached mobile work | Warm cached screen usable within 300ms | Profile/release build on a named low-end Android; airplane mode; 200 owned stages, cold and warm local reads measured separately |
| Scrolling and interaction | p95 build and raster frames each <16ms at 60Hz during a fixed scroll scenario | Flutter DevTools trace on physical device; report sample duration, missed-frame ratio, thermal state and device model |
| Web | LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at p75 | Lab regression on representative hardware/network, then real-user metrics; initial gallery numbers cannot stand in for React measurements |
| Lists | Lazy Flutter rows; paginated manager lists; bounded image decode sizes | Inspect builds/allocations with 200 tasks and 50 sites; no full-resolution list-photo decoding |
| Media | Thumbnails first; decode/upload compression off the UI thread where practical; playback on demand | Profile scrolling, photo addition and recording together; check for freezes and memory growth |
| Effects | No backdrop blur, parallax, animated gradients, continuous shimmer or autoplay media in core UI | Inspect source and profile actual drawing; respect reduced motion |
| Network and battery | Cached-first work; delta sync with backoff; no permanent GPS subscription | Inspect network traces and location lifecycle; offline work must not spin or poll repeatedly |
| Memory/startup | Set hard limits after device baseline | Measure cold start, resident memory, repeated media cycles and battery before selecting numerical release ceilings |

The review demo is also made lighter: it loads a small mobile-only route index instead of the complete native-design manifest. The delivery check measures its bytes and requires it below 24KB. This is a static-preview optimization, not proof of production Flutter performance.

## Independent checks and field validation

Automated design checks cover role-specific actions, ownership column/picker links, independent coordinator/stage changes, no employee assignment controls, recovery states, actual glyph bounds, native Penpot import and current-source traceability. Server authorization and transaction rules require backend integration tests after implementation.

Before release, observe 5–8 representative employees using their own language and a low-end device: find their job, start it, add a located photo offline, send a voice note, request material and respond to requested changes. Proposed success target: at least 80% complete core tasks unassisted, no wrong-stage submission, and no mistaken belief that Saved on phone means Approved. Record failures and revise before calling the design validated with employees.
