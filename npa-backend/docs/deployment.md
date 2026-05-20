# Deployment & Installation Guide (Docker) — QA Technical Notes

This guide uses the existing `docker-compose.yml` in `npa-backend` and prioritizes explicit, reproducible steps. It is written for QA to verify configuration, startup, and connectivity. Duplicate compose definitions have been removed; the steps below assume you reuse the checked-in compose file.

---

## 1. Prerequisites
- Docker Engine 20.10+ and Docker Compose v2+
- Git
- Open ports: 8000 (backend API), 5433 (database exposed by compose), 3000 (frontend if run separately)
- Seed file present: `npa-backend/app/database/memory_gc_timeseries_v1.7.parquet`

---

## 2. Backend (npa-backend) using the existing compose

### 2.1 Environment configuration
- Use `.env.docker` referenced by `docker-compose.yml` in `npa-backend/`. Required keys:
```
POSTGRES_DB=your_db
POSTGRES_USER=your_user
POSTGRES_PASSWORD=your_password
POSTGRES_REQUIRE_SSL=false   # optional
```
The compose file maps database port 5433->5432 and uses service name `db`.

### 2.2 Start stack
From `npa-backend/`:
```sh
docker compose build
docker compose up -d
```
Services started:
- `db`: timescale/timescaledb:latest-pg17, port 5433 exposed, healthcheck enabled
- `web`: FastAPI backend, port 8000 exposed, seeds Postgres from the Parquet file if tables are missing, converts to Timescale hypertables

### 2.3 Access and verification
- API base: http://localhost:8000
- OpenAPI docs: http://localhost:8000/docs
- Health check: `curl http://localhost:8000/api/apps` returns JSON
- Logs: `docker compose logs -f web` and `docker compose logs -f db`

### 2.4 Maintenance
- Stop stack: `docker compose down`
- Stop and remove volumes (drops DB data): `docker compose down -v`
- Status: `docker compose ps`

---

## 3. Frontend (npa-frontend)

### 3.1 Environment configuration
Create `.env` in `npa-frontend/` with:
```
REACT_APP_API_URL=http://localhost:8000
```
Adjust the URL if the backend is hosted elsewhere.

### 3.2 Build and run (frontend only)
From `npa-frontend/`:
```sh
docker build -t npa-frontend .
docker run -d -p 3000:3000 --env-file .env --name npa-frontend npa-frontend
```
If you prefer compose, add a frontend service referencing the same `.env`.

### 3.3 Access and verification
- UI: http://localhost:3000
- Confirm API calls resolve to http://localhost:8000 and return JSON (inspect browser network).

---

## 4. Verification checklist (QA)
1. `docker compose ps` shows `web` and `db` running; db healthcheck is passing.
2. `curl http://localhost:8000/api/apps` returns JSON.
3. First run: seeding logs show tables created; hypertables exist.
4. Frontend at http://localhost:3000 loads; network calls to http://localhost:8000 return JSON (no HTML).
5. No errors in `docker compose logs -f web` or browser console.

---

## 5. Troubleshooting
- HTML instead of JSON / Unexpected token '<': `REACT_APP_API_URL` missing or incorrect; backend unreachable.
- Backend fails to seed: verify Parquet file at `app/database/memory_gc_timeseries_v1.7.parquet`, check Postgres credentials, check `db` health.
- Port conflicts: adjust port mappings in `docker-compose.yml` (8000, 5433) and frontend `.env`.
- DB connection errors: ensure `POSTGRES_SERVER` effectively resolves to `db` (compose service name), confirm healthcheck passing.
- CORS issues: backend CORS is open by default in `app/main.py`; tighten or allow origins as needed.
