# JMJ Management System (V-Ops)

Full-stack app for managing JMJ operations (attendance, payroll, borewell tracking).

## Tech stack

- Frontend: React + Vite
- Backend: Node.js (Express)
- Database: PostgreSQL
- Docker: docker-compose + Nginx (frontend reverse-proxies `/api` to backend)

## Requirements

- Docker + Docker Compose
- Node.js `20.x` (for local development)

## Quick start (recommended)

This repo ships with a one-command launcher.

```bash
chmod +x start.sh

# Dev mode (default): DB in Docker, frontend+backend on host
./start.sh

# Full Docker mode: frontend+backend+db all in containers
./start.sh docker

# Stop everything
./start.sh stop
```

On first run, `./start.sh` will:

1. Create `.env` from `.env.example` if missing
2. Start Postgres
3. Run migrations
4. Seed default users (unless you pass `--no-seed`)
5. Start frontend + backend

## URLs & ports

Dev mode (`./start.sh`):

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3002/api`
- Postgres: `localhost:5435`

Docker mode (`./start.sh docker`):

- Frontend: `http://localhost:8085`
- Backend API: `http://localhost:3005/api`
- Postgres: `localhost:5435`

## Default seeded users

Created by `npm run seed` (see `backend/seeds/run.js`):

- Admin: `Admin` / `Admin@13`
- Supervisor: `Supervisor` / `Super@13`
- Employee: `User1` / `User@123`

## Authentication rules (current behavior)

- Roles: `ADMIN`, `SUPERVISOR`, `EMPLOYEE`
- No public registration
- Account lockout: after **3 failed login attempts**
- Password reset:
  - Admin: email-based reset is supported (see “Email (SMTP)” below)
  - Supervisor/Employee: no self-service “forgot password”; they must contact Admin
- UI rule: “Admin: Forgot Password?” is hidden until the Admin fails login 3 times
- Admin reset/unlock: when Admin resets a user’s password, lockout counters are cleared

## Environment variables

### Root `.env` (used by `start.sh` and `docker-compose.yml`)

Start by copying `.env.example` → `.env` and filling values.

Key variables:

- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `FRONTEND_URL` (used for CORS + password reset links)
- Local DB access (dev mode): `DB_HOST=localhost`, `DB_PORT=5435`, `DB_*`

### Frontend `.env`

For dev mode only (`frontend/.env`):

```dotenv
VITE_API_URL=http://localhost:3002/api
```

In Docker mode, the frontend uses `/api` and Nginx proxies to the backend container (no `VITE_API_URL` needed).

## Email (SMTP) for admin reset

Admin password reset emails are sent via Nodemailer.

- If SMTP is configured: email is sent to the Admin email address.
- If SMTP is not configured: the reset link is logged to the backend console (development fallback).

Required env vars:

- `SMTP_SERVICE` (optional; defaults to `gmail`)
- `SMTP_USER`
- `SMTP_PASS` (Gmail App Password)

Important: restart the backend after changing SMTP env vars.

## Useful commands

From repo root:

- `npm run dev` — run frontend + backend locally
- `npm run migrate` — run backend migrations
- `npm run seed` — seed default users
- `npm run setup` — install all deps + migrate + seed
- `npm run docker:up:build` — build + run containers

## Troubleshooting

- Ports already in use: run `./start.sh stop`, then retry.
- Not receiving reset email: verify `SMTP_USER`/`SMTP_PASS` and restart backend.
- Fresh DB: `docker compose down -v` removes the database volume.
