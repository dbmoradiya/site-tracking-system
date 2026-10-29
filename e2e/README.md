# E2E browser tests (Playwright)

Run from the repo root (needs JDK 21, Maven, Node, Chrome):

    CHROME_PATH=/usr/bin/google-chrome bash e2e/run-all.sh

Each run builds the frontend, starts the backend on a throwaway embedded database with seeded
dev users, runs the scripts and prints `OK` / `FAIL` per step plus a `TOTAL` line.
Screenshots and PDFs go to `e2e/e2e-out/`.

Run only some groups (letters match the `want` lines in run-all.sh; i = material groups on desktop, k/l = sale-only stock and Setup totals,
j = material groups on mobile, m/n = Projects list pagination (desktop/mobile),
o/p = Material Types CSV import (desktop/mobile),
others cover admin, setup, stages, coordinator and HSN):

    ONLY="i j" CHROME_PATH=/usr/bin/google-chrome bash e2e/run-all.sh

On a small machine run one or two groups at a time. Backend tests: `cd backend && mvn test`.

CSV checks cover template download, UTF-8 BOM, quoted commas/quotes, Gujarati text,
leading-zero HSN, partial success, same-name conflicts, exact-match skips, retry,
malformed quotes (no writes), upload limits, refreshed lists and mobile layout.
The runner fails on script errors, missing results, or failed seed setup. Each group
uses a random-port throwaway PostgreSQL database to prevent stale-run data reuse.
