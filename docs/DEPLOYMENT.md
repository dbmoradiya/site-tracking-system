# SiteTrack production deployment

Versions are identical to `develop`: Spring Boot 4.1.1, Java 21, React 19.3.1, Node 24 (build), PostgreSQL 17.

## What the `prod` profile does
- `SPRING_PROFILES_ACTIVE=prod` loads `application-prod.yml`.
- The schema comes from one migration, `V1__initial_schema.sql`, and a new database starts completely empty: no sample data and no built-in logins. Nothing is ever deleted at startup. Later schema changes are added as V2, V3, and so on.
- A database created by the earlier incremental migrations (V1 to V13) has a different Flyway history and will refuse to start with a validation error. If it holds data you want to keep, back it up and run `scripts/adopt-consolidated-schema.sql` once (it only rewrites Flyway's bookkeeping table; the schema is identical). Otherwise use a new empty database. Never promote a development database to production: it can still hold sample records and logins. Production always starts from a new empty database.
- The first Admin is created from `APP_BOOTSTRAP_ADMIN_MOBILE` / `APP_BOOTSTRAP_ADMIN_PASSWORD` (12+ characters) when no Admin exists; the app refuses to start without them. Create all other users in the app (Setup > Employees > Login password).
- The app refuses to start when `APP_JWT_SECRET` is shorter than 32 characters or looks like a default, or when `APP_ALLOWED_ORIGIN_PATTERNS` is empty.
- The Login page shows no demo accounts (`VITE_SHOW_DEMO_ACCOUNTS=false`).
- Only `/actuator/health` is exposed (no details). Error messages and stack traces are not returned.
- Failed sign-ins are throttled: 8 failures per email in 15 minutes returns 429. Deactivated users lose access immediately.

## Environment variables
| Variable | Purpose |
|---|---|
| `SITE_ADDRESS` | Public host name (compose only). CORS is set to `https://SITE_ADDRESS` |
| `DB_PASSWORD` | Postgres password |
| `APP_JWT_SECRET` | 32+ random characters (`openssl rand -base64 36`) |
| `APP_UPLOAD_DIR` | Evidence folder, default `/data/uploads`. **Must be on a persistent volume** |
| `APP_ALLOWED_ORIGIN_PATTERNS` | Comma separated allowed browser origins |
| `APP_BOOTSTRAP_ADMIN_*` | First start only (mobile number and password of the first Admin) |
| `APP_ADMIN_MOBILE`, `APP_ADMIN_PASSWORD` | Optional, any profile: set the Admin mobile / reset the Admin password at startup. Remove after use |

## Run with Docker Compose (any VM)
```
cp deploy/.env.example deploy/.env   # edit values
docker compose -f deploy/compose.prod.yaml --env-file deploy/.env up -d --build
```
Caddy gets a free HTTPS certificate automatically once `SITE_ADDRESS` points at the server (ports 80 and 443 open). Health is not exposed publicly; check with `docker compose exec backend wget -qO- localhost:8081/actuator/health` (the backend image also has a Docker HEALTHCHECK).

## Backups (do this, uploads and DB are the only state)
```
docker compose -f deploy/compose.prod.yaml exec -T db pg_dump -U sitetrack sitetrack | gzip > sitetrack-$(date +%F).sql.gz
docker run --rm -v deploy_upload_data:/d -v "$PWD":/b alpine tar czf /b/uploads-$(date +%F).tgz -C /d .
```
Run daily from cron and copy off the server. Volume names depend on the compose project name; check `docker volume ls`.

## Known limits
- Tokens are valid 12 hours with no refresh. Sign-in throttle is in memory (resets on restart, single instance only).
- One backend instance only (local disk uploads).

## Where to host (checked 22 Oct 2026)
Free and persistent: one Oracle Cloud Always Free Arm VM running the compose file (https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm). Risks: signup verification, capacity, idle reclamation.
Cheapest sensible paid: one small Hetzner VPS, about 4 to 5 euro/month (https://www.hetzner.com/cloud/).
Not suitable: Render free (sleeps after 15 min, files lost on restart, free Postgres expires after 30 days; https://render.com/docs/free). Fly.io has no free tier (https://docs.fly.io/about/pricing).

## ARM64 (Oracle Always Free Ampere A1)
Every image used has a linux/arm64 variant (checked on Docker Hub, 23 Oct 2026): postgres:17-alpine, caddy:2-alpine, nginx:1.29-alpine, node:24-alpine, maven:3.9.11-eclipse-temurin-21, eclipse-temurin:21-jre-alpine. No Dockerfile change is needed; `docker compose build` on the ARM VM builds native arm64 images. The same compose runs DB, backend, frontend and file storage on one VM; uploads live on the `upload_data` volume on the VM disk.

## Passwords
Passwords are stored as BCrypt hashes (salted, adaptive, cost 10) and are never returned by the API or written to logs. The Admin sets an employee's password when creating the employee (min 10 characters). Every signed-in user can change their own password with the key icon in the header (current + new). Existing sessions stay valid until their token expires (12 hours).

## Sign-in
Everyone, Admin included, signs in with mobile number + password. Numbers are normalized (spaces, dashes and +91 are accepted; Indian numbers are 10 digits starting 6-9) and must be unique. There is no email in the product and no default password. To set or reset the Admin password: start once with `APP_ADMIN_PASSWORD` set, then remove it.
