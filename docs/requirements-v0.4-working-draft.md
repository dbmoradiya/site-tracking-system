# SiteTrack — Working Requirements

**Date: 22 October 2026 · Working version: 0.5**

આ document હાલની confirmed product baseline છે. Applicationના બધા Web/PWA screens અને user-facing text હંમેશાં ફક્ત Englishમાં રહેશે. Gujarati ફક્ત stakeholder સાથેની વાતચીત માટે છે.

## 1. Product અને platform

- SiteTrack project અને site execution tracking application છે.
- Responsive React PWA desktop Web અને Android Chrome બંનેમાં વપરાશે.
- અલગ native Android અથવા iOS application હાલ બનાવવાની નથી.
- Google Maps/location picker નહીં રાખવો. Project અને Siteમાં સામાન્ય text address રહેશે.
- Offline evidence queue અથવા background sync હાલ scopeમાં નથી.
- અલગ `My Work` screen નહીં બનાવવી.

## 2. Roles અને access

Systemમાં આ business roles રહેશે:

- `Coordinator`
- `Supervisor`
- `Design Engineer`
- `Procurement Manager`

Rules:

- એક employee પાસે એકથી વધારે roles હોઈ શકે.
- Employee create/edit formમાં roles multi-select રહેશે.
- Design Engineer અને Procurement Managerને assigned work માટે Supervisor જેવી operational permissions મળશે.
- Multi-role employeeને તેના બધા assigned rolesનું combined access મળશે.
- `Admin` system-level role છે અને તેને સંપૂર્ણ setup તથા management access રહેશે.
- Team માટે login/account નહીં હોય.

## 3. Setup

Setup screenમાં ત્રણ tabs રહેશે:

- Site Types
- Employees
- Teams

બધા records card gridમાં દેખાશે. Card click કરતાં read-only popup ખુલશે. Existing record માટે `Edit` button ફક્ત popupમાં રહેશે.

Employee અને Team detail popupમાં તેમને સોંપાયેલા Projects બતાવવાના.

## 4. Site Types અને default Stages

- દરેક Site Type પોતાના default Stages રાખશે.
- Admin Stage name, order અને dependency configure કરી શકશે.
- દરેક Stageમાં zero, one અથવા multiple `Required Roles` હોઈ શકે.
- દરેક Stage માટે evidence ફરજિયાત રહેશે.
- Site Type create/edit કરતી વખતે Required Roles multi-select રહેશે.
- Required Roles empty રાખવાની મંજૂરી રહેશે.
- Site Typeના Stages અને dependencies ફક્ત Admin બનાવી કે બદલી શકશે.

## 5. Projects

New Projectમાં આ fields રહેશે:

- Project name — required
- Customer name — required
- Customer mobile number — required
- Project address — optional text
- Target completion date — optional
- Project Coordinator — required

Rules:

- Project ફક્ત Admin બનાવી અને તેની master details બદલી શકશે.
- Project Coordinator project level પર રહેશે.
- Admin Project Coordinator બદલી શકશે.
- Coordinator change historyમાં previous coordinator, new coordinator, changed by અને date/time સાચવવાના.
- Admin Project delete કરી શકશે.
- Delete કરતાં પહેલાં સ્પષ્ટ confirmation dialog ફરજિયાત રહેશે.
- Project delete થયા પછી તેની Sites, Stages, evidence records અને uploaded evidence files પણ delete થશે.

## 6. Sites અને role assignments

- દરેક Site કોઈ એક Projectની અંદર જ રહેશે.
- એક Projectમાં એક અથવા વધુ Sites હોઈ શકે.
- એક જ Projectમાં અલગ Site Typesની Sites હોઈ શકે.
- Site ફક્ત Admin બનાવી અને તેની master details બદલી શકશે.
- Siteને બીજા Projectમાં ખસેડવાની permission ફક્ત Admin પાસે રહેશે.
- Site create કરતી વખતે પસંદ કરેલા Site Typeના default Stages, dependencies અને required roles load થશે.
- Admin નવી Site માટે Stage name, order, dependency અને required roles customize કરી શકશે.
- Operational role assignment Project level પર નહીં, Site level પર રહેશે.
- Siteના Stagesમાંથી distinct required roles calculate થશે.
- દરેક required role માટે તે role ધરાવતા eligible employeesનું dropdown બતાવવાનું.
- એક employee એક જ Site પર multiple roles માટે assign થઈ શકે.
- Admin અને Project Coordinator ચાલુ Siteમાં role assignments બદલી શકશે.
- Role assignment historyમાં role, previous employee, new employee, changed by અને date/time સાચવવાના.
- Assignment બદલવાથી જૂનું evidence, comments, review history અથવા progress delete/reset નહીં થાય.

## 7. Teams

- Teamનું નામ, contact person, mobile અને notes ફક્ત Admin create/edit કરી શકશે.
- Team login નહીં કરે.
- Team assignment fixed Stage roleનો ભાગ નહીં હોય.
- Site સાથે optional Team assignment રાખવામાં આવશે, જેથી Team detailમાં assigned Projects બતાવી શકાય.
- Team assignment બદલાય તો history સાચવવાની.

## 8. Stage workflow — required role ધરાવતો Stage

- Stageના required role માટે Site પર assign થયેલા employees evidence upload કરી શકશે.
- Evidence સાથે optional text comment ઉમેરી શકાશે.
- Evidence historyમાં file, uploader, comment અને upload date/time દેખાશે.
- Stage submit કરતાં પહેલાં ઓછામાં ઓછું એક successful evidence upload ફરજિયાત રહેશે.
- Dependency complete ન હોય તો Stage blocked રહેશે.
- બધા required roles માટે employee assigned ન હોય તો Stage submit નહીં કરી શકાય.
- Assigned employee `Submit for approval` કરી શકશે.
- Admin અથવા Project Coordinator Stage approve કરી શકશે અથવા changes request કરી શકશે.
- Changes request માટે reason ફરજિયાત રહેશે.
- Rejected/changes-requested Stage assigned employeesના pending actionsમાં દેખાશે.

## 9. Stage workflow — કોઈ required role ન ધરાવતો Stage

- Stageમાં employee assignment નહીં હોય.
- Admin અથવા Project Coordinator evidence upload અને text comment ઉમેરી શકશે.
- Evidence વગર Stage complete નહીં કરી શકાય.
- Admin અથવા Project Coordinator Stageને સીધો `Mark Complete` કરી શકશે.
- આ Stage માટે employee submission/approval round-trip નહીં હોય.
- Completion historyમાં completed by અને date/time સાચવવાના.
- Complete થયા પછી dependent Stage unlock થશે.

## 10. Status calculation

- નવા Project અને Siteની શરૂઆત `NOT_STARTED`થી થશે.
- કોઈ Stage પર valid work/evidence શરૂ થાય એટલે Site `IN_PROGRESS` થશે.
- Siteના બધા Stages approved/completed થાય એટલે Site automatically `COMPLETED` થશે.
- Projectમાં કોઈ Site progressમાં કે completed હોય અને બધી Sites complete ન હોય તો Project `IN_PROGRESS` રહેશે.
- Projectની બધી Sites complete થાય એટલે Project automatically `COMPLETED` થશે.
- Final Stageની approval/completion Siteને complete કરવામાં અલગ manual action માંગશે નહીં.

## 11. Overview અને Projects

Overview metrics clickable રહેશે:

- `All Projects` → Projects page, કોઈ status filter નહીં
- `In Progress` → Projects page with `IN_PROGRESS` filter
- `Not Started` → Projects page with `NOT_STARTED` filter
- `Completed` → Projects page with `COMPLETED` filter

Projects page status filter URL query parameterમાં રહેશે, જેથી refresh/back પછી filter જળવાય.

Projects pageમાં advanced filters રહેશે:

- Location/address
- Completion date range
- Supervisor
- Coordinator
- Status
- Action required

Dynamic roles લાગુ થયા પછી people filters role-aware બનાવવાના; ફક્ત hardcoded Supervisor field પર આધારિત નહીં રહેવાના.

## 12. Notifications

- Notifications માટે અલગ `/notifications` page રહેશે.
- Overview પર latest 8 pending notifications અને total pending count દેખાશે.
- `View all notifications`થી full Notifications page ખુલશે.
- Notifications page પર current userના બધા pending actions દેખાશે.
- Notification click કરતાં relevant Site Detail અને Stage ખૂલશે.
- Admin/Coordinator માટે approval requests, missing assignments અને no-role Stage actions દેખાશે.
- Assigned operational roles માટે ready work, evidence actions અને changes requested દેખાશે.
- Notifications pageમાં useful type/status filter અને search રહેશે.

## 13. Project Detail અને Site Detail

Project Detail project-level overview રહેશે:

- Project/customer information
- Project Coordinator અને history
- Site cards અને progress
- `Open Site Details`
- Admin edit/delete actions

Project Detailમાંથી `Show Stages`, inline evidence upload અને inline submission સંપૂર્ણપણે દૂર કરવાના.

Site Detail એકમાત્ર execution screen રહેશે. તેમાં:

- Stage timeline
- Dependencies અને required roles
- Site-level role assignments
- Team assignment
- Evidence upload
- Evidence comment
- Submit for approval
- Approve/request changes
- No-role Stage માટે Mark Complete
- Evidence files/history
- Assignment history
- Review/completion history

## 14. UI density

- આખી applicationની oversized feeling ઘટાડીને compact professional dashboard બનાવવો.
- Desktop પર heading sizes, page padding, card padding, grid gaps, buttons, inputs અને rows થોડાં compact કરવાના.
- એક screenમાં વધારે useful information દેખાય તેવી density રાખવાની.
- Mobile પર touch targets 44–48pxથી નાના નહીં કરવા.
- Keyboard focus, readable contrast, safe areas અને reduced-motion support જાળવવાના.
- UI cramped કે difficult-to-tap ન બનવી જોઈએ.

## 15. Evidence અને network behavior

- Evidence માટે image અને PDF support રહેશે.
- Failed/incomplete upload completion માટે ગણાશે નહીં.
- Upload fail થાય તો userને retry કરી શકાય એવો clear error બતાવવો.
- Internet વગર local queue અથવા automatic later upload નહીં થાય.
- Evidence કોણે upload કર્યું તે audit trailમાં હંમેશાં રહેશે.

## 16. Client setup data backup અને reset decision

22 October 2026ના current client setup dataમાંથી આ records backupમાં રાખવાના:

- Employees
- Teams
- Site Types
- Site Type Stage definitions અને dependencies

Projects, Sites, evidence અને workflow history preserve કરવાની જરૂર નથી.

નવી schema લાગુ કરતાં development database અને uploaded evidence reset કરી શકાય. પછી backupમાંથી Employees, Teams અને Site Types ફરી populate કરવાના.

Restore સમયે નવા schemaમાં કોઈ જરૂરી field backupમાં ન હોય—ખાસ કરીને employee multiple roles, Stage required roles અથવા Team assignment સંબંધિત field—તો value અનુમાનથી ભરવાની નહીં. પહેલા stakeholder સાથે discuss અને confirm કરવાનું.

Sensitive client setup backup Gitમાં commit કરવાનો નહીં.

## 17. હાલ scopeમાં નથી

- Material stock/request/dispatch/usage/return module
- Google Maps અથવા GPS capture
- Offline evidence queue અને sync
- Native Android/iOS application
- Team login/account

## 18. હજી નક્કી કરવાનું

- Approved/completed Stage reopen કરવાની ચોક્કસ process.
- Backupમાંથી restore કરતી વખતે નવા `Required Roles` દરેક existing Stage માટે શું રહેશે.
- Existing employeesના multiple rolesમાં કોઈ additional role ઉમેરવાનો હોય તો stakeholder confirmation.
- Existing Teamsને restore કર્યા પછી કઈ Sites/Projects પર assign કરવાના તે નવા Projects create થાય ત્યારે નક્કી કરવાનું.

આ open decisions implementationમાં અનુમાનથી ભરવાના નહીં. નિર્ણય થાય ત્યાં સુધી approved/completed Stage ફરી ખોલી શકાશે નહીં.
