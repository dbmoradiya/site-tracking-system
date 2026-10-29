#!/usr/bin/env bash
# Real-app browser suite. Local throwaway embedded PostgreSQL only; never touches any real database.
# Needs: JDK 21, Maven, Python 3, Node 20+, Google Chrome/Chromium (set CHROME_PATH), poppler (pdftotext).
# Run from anywhere:  CHROME_PATH=/usr/bin/google-chrome bash e2e/run-all.sh   (ONLY="a b" runs selected groups a-h)
set -u
cd "$(dirname "$0")"; E2E=$PWD; ROOT=$(cd .. && pwd)
mkdir -p e2e-out
[ -d node_modules ] || npm install --silent
(cd "$ROOT/frontend" && npm ci --silent && npm run build) >/dev/null || { echo "frontend build failed"; exit 2; }
(cd "$ROOT/backend" && mvn -o -q test-compile dependency:build-classpath -Dmdep.outputFile="$E2E/e2e-out/cp.txt") >/dev/null 2>&1 \
  || (cd "$ROOT/backend" && mvn -q test-compile dependency:build-classpath -Dmdep.outputFile="$E2E/e2e-out/cp.txt") >/dev/null || { echo "backend compile failed"; exit 2; }
PIDS=""
stop() { for p in $PIDS; do kill $p 2>/dev/null; done; PIDS=""; sleep 1; }
trap stop EXIT
want() { [ -z "${ONLY:-}" ] || [[ " $ONLY " == *" $1 "* ]]; }
start() {   # fresh DB each group
  stop
  (cd "$ROOT/backend" && exec ${JAVA_HOME:+$JAVA_HOME/bin/}java -cp "target/classes:target/test-classes:$(cat "$E2E/e2e-out/cp.txt")" com.sitetrack.DevServer >"$E2E/e2e-out/backend.log" 2>&1) & PIDS="$!"
  for i in $(seq 60); do grep -q "Started DevServer" e2e-out/backend.log 2>/dev/null && break; sleep 1; done
  python3 proxy.py >e2e-out/proxy.log 2>&1 & PIDS="$PIDS $!"
  grep -q "Started DevServer" e2e-out/backend.log || { tail -30 e2e-out/backend.log; exit 2; }
  sleep 1; python3 seed.py >/dev/null || { echo "seed failed"; exit 2; }
}
FAIL=0; TOTAL=0
run() {  # name, command...
  n=$1; shift; out=$("$@" 2>&1); rc=$?; echo "$out" | grep -E "^(OK|FAIL)" | sed "s/^/[$n] /"
  echo "$out" | grep -qE "^(OK|FAIL)" || echo "[$n] NO RESULT: $(echo "$out" | tail -25)"
  ok=$(echo "$out" | grep -c "^OK"); bad=$(echo "$out" | grep -c "^FAIL"); TOTAL=$((TOTAL+ok+bad)); FAIL=$((FAIL+bad))
  if [ "$rc" -ne 0 ] && [ "$bad" -eq 0 ]; then echo "[$n] FAIL script exit $rc"; FAIL=$((FAIL+1)); fi
  if [ "$ok" -eq 0 ] && [ "$bad" -eq 0 ]; then FAIL=$((FAIL+1)); fi
  echo "$out" | grep -E "^errors" | sed "s/^/[$n] /"
}
want a && { start; run admin-desktop node admin-desktop.mjs; run purchase-edit-desktop node purchase-edit.mjs; }
want b && { start; run admin-mobile node admin-mobile.mjs; run purchase-edit-mobile node purchase-edit.mjs mobile; }
want c && { start; run setup-desktop node setup.mjs; }
want d && { start; run setup-mobile node setup.mjs mobile; }
want e && { start; run stages node stages.mjs; }
want f && { start; run api-scope python3 seed-sales.py; run coordinator-desktop node coordinator.mjs; run coordinator-mobile node coordinator.mjs mobile; }
want g && { start; run hsn-desktop node hsn.mjs; }
want h && { start; run hsn-mobile node hsn.mjs mobile; }
want i && { start; run groups-desktop node groups.mjs; }
want j && { start; run groups-mobile node groups.mjs mobile; }
want k && { start; run stock-desktop node stock.mjs; }
want l && { start; run stock-mobile node stock.mjs mobile; }
want m && { start; run projects-pagination-desktop node projects-pagination.mjs; }
want n && { start; run projects-pagination-mobile node projects-pagination.mjs mobile; }
want o && { start; run material-csv-desktop node material-csv.mjs; }
want p && { start; run material-csv-mobile node material-csv.mjs mobile; }
echo "TOTAL steps: $TOTAL  FAILED: $FAIL"
exit $([ $FAIL -eq 0 ] && echo 0 || echo 1)
