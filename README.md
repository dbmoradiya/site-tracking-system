# SiteTrack

Responsive project and Site execution tracking for Admins, Project
Coordinators and Supervisors. The product interface is English only; team
communication and requirement notes may be in Gujarati.

## Stack

- React 19 + TypeScript + Vite PWA frontend
- Spring Boot 4 REST API
- PostgreSQL 17
- Docker Compose for the complete local environment

The current product slice includes role-aware Project filters, Dashboard action
notifications, card-based Setup records, assigned-Project visibility, and
evidence uploads with comments inside expandable Site/Stage sections on the
Project detail screen. There is no separate work screen.

## Run

```sh
docker compose up --build
```

Open <http://localhost:8080>. The API health endpoint is
<http://localhost:8081/actuator/health>.

## Run locally without Docker

Prerequisites: Java 21, Node 22 or newer (24 works), PostgreSQL 17 (14+ also
works), and Python 3 only if you want the sample data.

1. Create the database (once):

   ```sh
   psql -U postgres -c "CREATE USER sitetrack WITH PASSWORD 'sitetrack' CREATEDB;"
   psql -U postgres -c "CREATE DATABASE sitetrack OWNER sitetrack;"
   ```

   These match the defaults in `backend/src/main/resources/application.yml`.
   Override with `DB_URL`, `DB_USERNAME`, `DB_PASSWORD` if yours differ.

2. Start the API on port 8081. The first start creates the Admin from two
   variables (mobile 10 digits, password 10 to 72 characters). After the first
   start you can drop them; the password is stored hashed.

   ```sh
   cd backend
   APP_ADMIN_MOBILE=9999988888 APP_ADMIN_PASSWORD='choose-a-strong-password' \
     mvn spring-boot:run
   ```

   (Or `mvn package` then `java -jar target/sitetrack-api-0.1.0.jar`.) Check
   <http://localhost:8081/actuator/health>.

3. Start the web app on port 5173. It proxies `/api` to port 8081.

   ```sh
   cd frontend
   npm install
   npm run dev
   ```

   Open <http://localhost:5173> and sign in with the Admin mobile and password.

4. Optional sample data (3 projects, 8 employees, 2 site types, evidence
   files). Run once on an empty database, never on production. It prints the
   employee logins (random passwords) at the end:

   ```sh
   SEED_ADMIN_MOBILE=9999988888 SEED_ADMIN_PASSWORD='choose-a-strong-password' \
     python3 scripts/seed-demo.py
   ```

   With Docker Compose, pass `APP_ADMIN_MOBILE` and `APP_ADMIN_PASSWORD` in the
   environment when running `docker compose up --build`, then seed against
   `http://localhost:8081`.

A fresh local database also carries a few built-in sample records from the early
migrations (a couple of projects, employees and teams). Their old shared-password
logins are switched off (inactive) by migration V13, so only the Admin you create
works. The seed script adds its own people next to them, so a few names appear
twice. For a clean demo, create an empty database for it. The seed script stops
without changing anything if its data already exists. Do not start the backend with
`SPRING_PROFILES_ACTIVE=prod` against a local database you care about; see
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

If you forget the Admin password, restart the API once with `APP_ADMIN_PASSWORD`
set to a new value, then remove it.

ngrok HTTPS URLs under `ngrok-free.app`, `ngrok.app`, and `ngrok.io` are
allowed by default. For another tunnel domain, set
`APP_ALLOWED_ORIGIN_PATTERNS` before starting Docker Compose.

Sign-in is by mobile number and password for everyone (no email). There is no
default password. Set the Admin mobile number and password at startup with
`APP_ADMIN_MOBILE` and `APP_ADMIN_PASSWORD` (10 to 72 characters; remove them afterwards).
The Admin creates every other login in Setup > Employees. Users change their own
password with the key icon in the header.

## Product rules

See [requirements v0.4](docs/requirements-v0.4-working-draft.md). Site status
automatically becomes `COMPLETED` when every Stage is approved or directly completed. Project status
becomes `COMPLETED` when every Site is completed. Every Stage requires at least
one successfully uploaded evidence file before completion can be submitted.
