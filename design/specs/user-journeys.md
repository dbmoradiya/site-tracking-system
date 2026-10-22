# FIELDWORK — User journeys and screen inventory

Based on system design v0.2. Source SHA-256: `6092666676dd5e9817e2e829b0010a0ad80361d7d6fe25103e0a343875a54e62`.

80 manager screens/states and 72 employee screens/states, including 14 Hindi/Gujarati review examples. Nine journey boards and seven foundation/component boards are included in the native Penpot file. Canonical screen content is English; localized examples cover home, login, composing updates, permission errors, empty states, conflicts and evidence validation. Full native-app translation and linguistic review remain implementation/release work.

## Mobile navigation revision

Primary structure: **My Sites → Site workspace**. The workspace contains **Work / Materials / Updates** tabs. Stages are checklist rows with direct Start / Submit / Pending controls. The global Sites / Requests / Sync / Profile navigation remains on the employee home and other app areas.

- Start an open stage: M04 → M06 → M58 (two taps).
- Add an update: M04 → M06 → M10 sheet (two taps). Photo location and attachment review remain explicit action steps.
- Request eligible-stage completion: M04 → M06 → M56 sheet (two taps; no-photo wiring stage). An open stage must first be started before completion.
- Record stock use: M06 → Materials M24 → M29 sheet.
- Request more material: M06 → Materials M24 → M26 sheet.
- View updates: M06 → Updates M34; return directly with Work.

Screen IDs include states and sheets, not a hierarchy of separate product pages. Prototype boards illustrate outcomes; mutation persistence is implementation work.

## Review method

Open the browser gallery at http://127.0.0.1:4173. Choose a journey or a screen. Click illustrated product actions, or use Previous/Next to inspect individual states. Native Penpot contains four organized pages and five prototype starting flows. The PDF is a static screen-by-screen review copy.

## J01 — Set up the operation

Admin signs in, configures site types and their default stages, adds employees with multiple eligible types and language, and receives stock. No signup or employee self-service password change is offered.

[Journey map](J01.svg) · Acceptance scenarios: 1, 2, 3, 27

1. [A01 — Welcome back](index.html#A01)
2. [A32 — Site types](index.html#A32)
3. [A34 — Add site type](index.html#A34)
4. [A35 — Edit Solar stages](index.html#A35)
5. [A36 — Employees](index.html#A36)
6. [A38 — Add employee](index.html#A38)
7. [A42 — Materials inventory](index.html#A42)
8. [A44 — Add material](index.html#A44)
9. [A45 — Add warehouse stock](index.html#A45)

## J02 — Create linked shed and solar work

Admin groups shed and solar sites under one project, customizes stage snapshots, assigns one eligible employee to each site, and defines an acyclic prerequisite. Draft preparation does not move stock.

[Journey map](J02.svg) · Acceptance scenarios: 3, 4, 5, 9

1. [A28 — Projects](index.html#A28)
2. [A29 — Add project](index.html#A29)
3. [A30 — Suryoday factory expansion](index.html#A30)
4. [A05 — Add a site](index.html#A05)
5. [A06 — Make the stages fit the work](index.html#A06)
6. [A13 — Assign the right person](index.html#A13)
7. [A31 — Link sites and prerequisites](index.html#A31)
8. [A07 — Suryoday solar](index.html#A07)

## J03 — Employee progresses with located evidence

Employee signs in without a password-change step, starts eligible work, adds text/photos/audio, grants photo-add location, and submits a stage for approval. A saved local update is distinct from a server-accepted update.

[Journey map](J03.svg) · Acceptance scenarios: 5, 6, 19, 21, 23

1. [M04 — My sites](index.html#M04)
2. [M06 — Suryoday solar](index.html#M06)
3. [M58 — Panel installation · in progress](index.html#M58)
4. [M10 — Add update](index.html#M10)
5. [M11 — Add location to your photo](index.html#M11)
6. [M14 — Photo ready to attach](index.html#M14)
7. [M10 — Add update](index.html#M10)
8. [M06 — Suryoday solar](index.html#M06)
9. [M17 — Request stage completion](index.html#M17)
10. [M19 — Awaiting manager approval](index.html#M19)

## J04 — Review, reject, correct and complete

Admin reviews immutable attempts, photo location and audio context, requests changes with a reason, then explicitly approves. The final stage approval completes the site without waiting for material reconciliation.

[Journey map](J04.svg) · Acceptance scenarios: 6, 7, 16, 18

1. [A21 — Decisions waiting for you](index.html#A21)
2. [A22 — Review stage completion](index.html#A22)
3. [A19 — Photo evidence & location](index.html#A19)
4. [A23 — Request changes](index.html#A23)
5. [M20 — Changes requested](index.html#M20)
6. [M59 — Resubmit Mounting structure](index.html#M59)
7. [A22 — Review stage completion](index.html#A22)
8. [A75 — Mounting structure approved](index.html#A75)
9. [A65 — Approve the final stage](index.html#A65)
10. [A52 — Work completed. Materials still visible.](index.html#A52)
11. [M43 — Site completed](index.html#M43)

## J05 — Reserve, partially dispatch, consume and return

Employee may create another material request while one is open. Admin explicitly accounts for residual quantities, reserves stock, dispatches a partial batch, and later confirms actual return receipts. Consumption is employee-recorded without approval.

[Journey map](J05.svg) · Acceptance scenarios: 10, 11, 12, 18, 26

1. [M24 — Site materials](index.html#M24)
2. [M26 — Request materials](index.html#M26)
3. [M27 — Another request is already open](index.html#M27)
4. [A25 — Decide material quantities](index.html#A25)
5. [A26 — Record a dispatch](index.html#A26)
6. [M28 — Request MR-041](index.html#M28)
7. [M29 — Record consumption](index.html#M29)
8. [M30 — Consumption recorded](index.html#M30)
9. [M31 — Request a material return](index.html#M31)
10. [M32 — Return awaiting receipt](index.html#M32)
11. [A27 — Confirm returned stock received](index.html#A27)
12. [A43 — Solar panel](index.html#A43)

## J06 — Record offline, then recover a conflict

Cached work is available offline within seven days. A photo saves its location when added; later transport preserves it. Media failures keep drafts. Stock conflicts and reassignment quarantine input instead of overwriting state or deleting work.

[Journey map](J06.svg) · Acceptance scenarios: 13, 14, 19, 20, 24

1. [M42 — My sites · offline](index.html#M42)
2. [M10 — Add update](index.html#M10)
3. [M11 — Add location to your photo](index.html#M11)
4. [M47 — Photo saved offline](index.html#M47)
5. [M15 — Record a voice update](index.html#M15)
6. [M35 — Updates & sync](index.html#M35)
7. [M36 — This update needs attention](index.html#M36)
8. [M37 — This site was reassigned](index.html#M37)
9. [M38 — Reconnect to unlock your work](index.html#M38)

## J07 — Admin records field work without changing assignee

Admin records real field activity without becoming the assignee. Admin-created completion requests still require an explicit approval action. Admin updates do not falsely satisfy employee reporting metrics.

[Journey map](J07.svg) · Acceptance scenarios: 15, 22

1. [A07 — Suryoday solar](index.html#A07)
2. [A17 — Add a progress update](index.html#A17)
3. [A18 — Add location to site evidence](index.html#A18)
4. [A19 — Photo evidence & location](index.html#A19)
5. [A20 — Voice update](index.html#A20)
6. [A16 — Request stage completion](index.html#A16)
7. [A22 — Review stage completion](index.html#A22)
8. [A79 — Submit a block request](index.html#A79)
9. [A80 — Review admin-created block request](index.html#A80)
10. [A64 — Wiring & earthing · blocked](index.html#A64)
11. [A74 — Resolve a stage block](index.html#A74)

## J08 — Language, reminders and credential management

Admin sets English/Hindi/Gujarati preference and shares an admin-set password. Reminders are optional and respect configured days/cutoff. Reset invalidates server sessions; employees contact admin rather than changing a password themselves.

[Journey map](J08.svg) · Acceptance scenarios: 2, 17, 23, 25

1. [A38 — Add employee](index.html#A38)
2. [M02 — Choose your language](index.html#M02)
3. [M45 — मेरी साइटें](index.html#M45)
4. [M46 — મારી સાઇટ્સ](index.html#M46)
5. [A48 — Reporting & reminders](index.html#A48)
6. [M40 — Notifications](index.html#M40)
7. [A40 — Reset employee password](index.html#A40)
8. [A58 — Password reset complete](index.html#A58)
9. [M49 — Your manager reset your password](index.html#M49)
10. [M03 — Contact your manager](index.html#M03)

## J09 — Blocked, overdue and dependency recovery

Blocked and overdue appear together. A stage block leaves independent stages available. Unblocking preserves work, while reopening a completed predecessor holds unfinished downstream work for review.

[Journey map](J09.svg) · Acceptance scenarios: 8, 9, 16

1. [A02 — A clear view of today](index.html#A02)
2. [A04 — Find the work that needs you](index.html#A04)
3. [M22 — This site is blocked](index.html#M22)
4. [M21 — Request a block](index.html#M21)
5. [A24 — Review block request](index.html#A24)
6. [A14 — Block site](index.html#A14)
7. [A31 — Link sites and prerequisites](index.html#A31)
8. [M23 — Waiting for other work](index.html#M23)
9. [A15 — Reopen completed work](index.html#A15)

## Screen inventory

Each entry is an editable native board and an SVG. IDs are stable review references. Long mobile content is shown as a full scrollable screen design; app implementation must keep navigation usable within the native viewport.

| ID | Screen / state | Role | Area |
| --- | --- | --- | --- |
| [A01](index.html#A01) | Welcome back | admin | Access |
| [A02](index.html#A02) | A clear view of today | admin | Dashboard |
| [A03](index.html#A03) | Sites | admin | Sites |
| [A04](index.html#A04) | Find the work that needs you | admin | Sites |
| [A05](index.html#A05) | Add a site | admin | Sites |
| [A06](index.html#A06) | Make the stages fit the work | admin | Sites |
| [A07](index.html#A07) | Suryoday solar | admin | Sites |
| [A08](index.html#A08) | Stages & evidence | admin | Sites |
| [A09](index.html#A09) | Materials at this site | admin | Sites |
| [A10](index.html#A10) | Linked work, independent progress | admin | Sites |
| [A11](index.html#A11) | Activity you can trace | admin | Sites |
| [A12](index.html#A12) | Edit site details | admin | Sites |
| [A13](index.html#A13) | Assign the right person | admin | Sites |
| [A14](index.html#A14) | Block site | admin | Sites |
| [A15](index.html#A15) | Reopen completed work | admin | Sites |
| [A16](index.html#A16) | Request stage completion | admin | Sites |
| [A17](index.html#A17) | Add a progress update | admin | Sites |
| [A18](index.html#A18) | Add location to site evidence | admin | Sites |
| [A19](index.html#A19) | Photo evidence & location | admin | Sites |
| [A20](index.html#A20) | Voice update | admin | Sites |
| [A21](index.html#A21) | Decisions waiting for you | admin | Approvals |
| [A22](index.html#A22) | Review stage completion | admin | Approvals |
| [A23](index.html#A23) | Request changes | admin | Approvals |
| [A24](index.html#A24) | Review block request | admin | Approvals |
| [A25](index.html#A25) | Decide material quantities | admin | Approvals |
| [A26](index.html#A26) | Record a dispatch | admin | Materials |
| [A27](index.html#A27) | Confirm returned stock received | admin | Approvals |
| [A28](index.html#A28) | Projects | admin | Projects |
| [A29](index.html#A29) | Add project | admin | Projects |
| [A30](index.html#A30) | Suryoday factory expansion | admin | Projects |
| [A31](index.html#A31) | Link sites and prerequisites | admin | Projects |
| [A32](index.html#A32) | Site types | admin | Site Types |
| [A33](index.html#A33) | Solar · site type | admin | Site Types |
| [A34](index.html#A34) | Add site type | admin | Site Types |
| [A35](index.html#A35) | Edit Solar stages | admin | Site Types |
| [A36](index.html#A36) | Employees | admin | Employees |
| [A37](index.html#A37) | Ravi Patel | admin | Employees |
| [A38](index.html#A38) | Add employee | admin | Employees |
| [A39](index.html#A39) | Edit employee | admin | Employees |
| [A40](index.html#A40) | Reset employee password | admin | Employees |
| [A41](index.html#A41) | Deactivate employee | admin | Employees |
| [A42](index.html#A42) | Materials inventory | admin | Materials |
| [A43](index.html#A43) | Solar panel | admin | Materials |
| [A44](index.html#A44) | Add material | admin | Materials |
| [A45](index.html#A45) | Add warehouse stock | admin | Materials |
| [A46](index.html#A46) | Correct a consumption entry | admin | Materials |
| [A47](index.html#A47) | Stock adjustment | admin | Materials |
| [A48](index.html#A48) | Reporting & reminders | admin | Settings |
| [A49](index.html#A49) | Media & offline limits | admin | Settings |
| [A50](index.html#A50) | Notifications | admin | Dashboard |
| [A51](index.html#A51) | Sign out of manager workspace | admin | Access |
| [A52](index.html#A52) | Work completed. Materials still visible. | admin | Sites |
| [A53](index.html#A53) | We could not complete that action | admin | System states |
| [A54](index.html#A54) | No sites match these filters | admin | System states |
| [A55](index.html#A55) | Loading your workspace | admin | System states |
| [A56](index.html#A56) | Archive Solar template | admin | Site Types |
| [A57](index.html#A57) | Cancel undelivered quantities | admin | Materials |
| [A58](index.html#A58) | Password reset complete | admin | Employees |
| [A59](index.html#A59) | Resolve a block | admin | Sites |
| [A60](index.html#A60) | Edit material details | admin | Materials |
| [A61](index.html#A61) | Resolve the dependency cycle | admin | Projects |
| [A62](index.html#A62) | Check the site details | admin | Sites |
| [A63](index.html#A63) | Anand rooftop | admin | Sites |
| [A64](index.html#A64) | Wiring & earthing · blocked | admin | Sites |
| [A65](index.html#A65) | Approve the final stage | admin | Approvals |
| [A66](index.html#A66) | Bharuch workshop | admin | Sites |
| [A67](index.html#A67) | Canal road solar | admin | Sites |
| [A68](index.html#A68) | Vatva extension · draft | admin | Sites |
| [A69](index.html#A69) | Decline remaining material demand | admin | Approvals |
| [A70](index.html#A70) | Decline block request | admin | Approvals |
| [A71](index.html#A71) | Sites needing an employee update | admin | Sites |
| [A72](index.html#A72) | Suryoday shed | admin | Sites |
| [A73](index.html#A73) | Anand rooftop · work resumed | admin | Sites |
| [A74](index.html#A74) | Resolve a stage block | admin | Sites |
| [A75](index.html#A75) | Mounting structure approved | admin | Sites |
| [A76](index.html#A76) | Suryoday solar · published | admin | Sites |
| [A77](index.html#A77) | Suryoday solar · blocked | admin | Sites |
| [A78](index.html#A78) | Resolve whole-site block | admin | Sites |
| [A79](index.html#A79) | Submit a block request | admin | Sites |
| [A80](index.html#A80) | Review admin-created block request | admin | Approvals |
| [M01](index.html#M01) | Good work starts here | mobile | Access |
| [M02](index.html#M02) | Choose your language | mobile | Access |
| [M03](index.html#M03) | Contact your manager | mobile | Access |
| [M04](index.html#M04) | My sites | mobile | My Sites |
| [M05](index.html#M05) | Filter my sites | mobile | My Sites |
| [M06](index.html#M06) | Suryoday solar | mobile | My Sites |
| [M07](index.html#M07) | Stages | mobile | My Sites |
| [M08](index.html#M08) | Panel installation | mobile | My Sites |
| [M09](index.html#M09) | Start this stage? | mobile | My Sites |
| [M10](index.html#M10) | Add update | mobile | Updates |
| [M11](index.html#M11) | Add location to your photo | mobile | Photo evidence |
| [M12](index.html#M12) | Location permission needed | mobile | Photo evidence |
| [M13](index.html#M13) | Waiting for a location fix | mobile | Photo evidence |
| [M14](index.html#M14) | Photo ready to attach | mobile | Photo evidence |
| [M15](index.html#M15) | Record a voice update | mobile | Updates |
| [M16](index.html#M16) | Audio upload interrupted | mobile | Updates |
| [M17](index.html#M17) | Request stage completion | mobile | My Sites |
| [M18](index.html#M18) | Add a photo before submitting | mobile | Photo evidence |
| [M19](index.html#M19) | Awaiting manager approval | mobile | My Sites |
| [M20](index.html#M20) | Changes requested | mobile | My Sites |
| [M21](index.html#M21) | Request a block | mobile | My Sites |
| [M22](index.html#M22) | This site is blocked | mobile | My Sites |
| [M23](index.html#M23) | Waiting for other work | mobile | My Sites |
| [M24](index.html#M24) | Site materials | mobile | Materials |
| [M25](index.html#M25) | My material requests | mobile | Materials |
| [M26](index.html#M26) | Request materials | mobile | Materials |
| [M27](index.html#M27) | Another request is already open | mobile | Materials |
| [M28](index.html#M28) | Request MR-041 | mobile | Materials |
| [M29](index.html#M29) | Record consumption | mobile | Materials |
| [M30](index.html#M30) | Consumption recorded | mobile | Materials |
| [M31](index.html#M31) | Request a material return | mobile | Materials |
| [M32](index.html#M32) | Return awaiting receipt | mobile | Materials |
| [M33](index.html#M33) | Linked project context | mobile | My Sites |
| [M34](index.html#M34) | Site activity | mobile | Updates |
| [M35](index.html#M35) | Updates & sync | mobile | Sync |
| [M36](index.html#M36) | This update needs attention | mobile | Sync |
| [M37](index.html#M37) | This site was reassigned | mobile | Sync |
| [M38](index.html#M38) | Reconnect to unlock your work | mobile | Access |
| [M39](index.html#M39) | My profile | mobile | Profile |
| [M40](index.html#M40) | Notifications | mobile | Updates |
| [M41](index.html#M41) | You have unsynced work | mobile | Profile |
| [M42](index.html#M42) | My sites · offline | mobile | My Sites |
| [M43](index.html#M43) | Site completed | mobile | My Sites |
| [M44](index.html#M44) | Return surplus after completion | mobile | Materials |
| [M45](index.html#M45) | मेरी साइटें | mobile | Languages |
| [M46](index.html#M46) | મારી સાઇટ્સ | mobile | Languages |
| [M47](index.html#M47) | Photo saved offline | mobile | Sync |
| [M48](index.html#M48) | Device storage | mobile | Sync |
| [M49](index.html#M49) | Your manager reset your password | mobile | Access |
| [M50](index.html#M50) | Microphone permission needed | mobile | Updates |
| [M51](index.html#M51) | Evidence details | mobile | Photo evidence |
| [M52](index.html#M52) | No sites assigned yet | mobile | System states |
| [M53](index.html#M53) | Could not load the latest data | mobile | System states |
| [M54](index.html#M54) | Loading your sites | mobile | System states |
| [M55](index.html#M55) | This stage is blocked | mobile | My Sites |
| [M56](index.html#M56) | Request completion · no photo required | mobile | My Sites |
| [M57](index.html#M57) | Wiring & earthing | mobile | My Sites |
| [M58](index.html#M58) | Panel installation · in progress | mobile | My Sites |
| [M59](index.html#M59) | Resubmit Mounting structure | mobile | My Sites |
| [M60](index.html#M60) | स्थान की अनुमति आवश्यक है | mobile | Languages |
| [M61](index.html#M61) | સ્થાનની પરવાનગી જરૂરી છે | mobile | Languages |
| [M62](index.html#M62) | હજી કોઈ સાઇટ સોંપાઈ નથી | mobile | Languages |
| [M63](index.html#M63) | अभी कोई साइट नहीं सौंपी गई | mobile | Languages |
| [M64](index.html#M64) | इस अपडेट पर ध्यान दें | mobile | Languages |
| [M65](index.html#M65) | આ અપડેટ તપાસવાની જરૂર છે | mobile | Languages |
| [M66](index.html#M66) | जमा करने से पहले फ़ोटो जोड़ें | mobile | Languages |
| [M67](index.html#M67) | મોકલતાં પહેલાં ફોટો ઉમેરો | mobile | Languages |
| [M68](index.html#M68) | સારા કામની શરૂઆત અહીંથી | mobile | Languages |
| [M69](index.html#M69) | अच्छे काम की शुरुआत यहाँ से | mobile | Languages |
| [M70](index.html#M70) | अपडेट जोड़ें | mobile | Languages |
| [M71](index.html#M71) | અપડેટ ઉમેરો | mobile | Languages |
| [M72](index.html#M72) | Interface language | mobile | Profile |
