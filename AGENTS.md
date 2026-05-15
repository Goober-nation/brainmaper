# AGENTS.md - Brainmap AI

## Developer Commands

### Infrastructure
- Start stack: `docker compose up --build`
- Stop stack: `docker compose down`
- Reset database: `docker compose down -v && docker compose up -d`
- Check backend logs: `docker compose logs backend`

### Frontend
- Install deps: `npm install` (inside `frontend/`)
- Dev server: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

### Backend
- No standalone test suite identified in the repository.
- Backend runs inside Docker; build is handled by `docker compose`.

## Architecture Notes

### Database Discrepancy
- **CRITICAL:** The `README.md` incorrectly claims the project uses PostgreSQL. The project actually uses **MongoDB 7**.

### Data Storage
- **Metadata:** Stored in MongoDB (nodes, edges, workspace info).
- **Binary/Map Data:** Stored on the local filesystem at `/app/data/` inside the backend container, mapped to `./backend/data` on the host. Served via `/api/media/`.

### Key Entry Points
- Backend: `backend/main.go` (Router and Middleware).
- Backend Storage: `backend/storage/fs.go`.
- Backend DB: `backend/database/db.go`.

## Conventions & Quirks

### Backend Environment
- Requires `GEMINI_API_KEY` for AI functionality.
- MongoDB connection includes a retry loop (15 attempts) to handle container startup latency.

### Frontend
- Uses `reactflow` for the infinite canvas implementation.
- Served via Nginx in the production Docker build.
