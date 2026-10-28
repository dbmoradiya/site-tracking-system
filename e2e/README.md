# Browser E2E suite (material module, stages, coordinator scoping)

Drives the real built frontend with real clicks against the real Spring Boot app on a throwaway embedded
PostgreSQL (`backend/src/test/java/com/sitetrack/DevServer.java`, test classpath only). It never connects to any
real database. A fresh database is created for each group of scenarios.

Needs: JDK 21, Maven, Python 3, Node 20+, Chrome or Chromium (`CHROME_PATH`), `pdftotext` (poppler).

    CHROME_PATH=/usr/bin/google-chrome bash e2e/run-all.sh

It prints one `OK` or `FAIL` line per step and a total. Screenshots are written to `e2e/e2e-out/`.
The seeded accounts are local test users only (admin `9000000009`, coordinators, supervisor; the password is the
dev-only value in `seed.py`). Nothing here is used outside this throwaway database.

Groups: a admin-desktop + purchase-edit-desktop, b admin-mobile + purchase-edit-mobile, c setup-desktop, d setup-mobile,
e stages, f API scope + coordinator desktop/mobile, g hsn-desktop (HSN + stored challan lifecycle), h hsn-mobile.
