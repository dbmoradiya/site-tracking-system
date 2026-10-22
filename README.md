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

ngrok HTTPS URLs under `ngrok-free.app`, `ngrok.app`, and `ngrok.io` are
allowed by default. For another tunnel domain, set
`APP_ALLOWED_ORIGIN_PATTERNS` before starting Docker Compose.

Demo accounts (password: `SiteTrack123!`):

- `admin@sitetrack.local`
- `coordinator@sitetrack.local`
- `supervisor@sitetrack.local`

## Product rules

See [requirements v0.4](docs/requirements-v0.4-working-draft.md). Site status
automatically becomes `COMPLETED` when every Stage is approved or directly completed. Project status
becomes `COMPLETED` when every Site is completed. Every Stage requires at least
one successfully uploaded evidence file before completion can be submitted.
