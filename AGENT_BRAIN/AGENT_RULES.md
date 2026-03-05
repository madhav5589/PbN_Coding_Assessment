# Agent Rules

## Bootstrap Protocol (Every Session)
1. Read `AGENT_BRAIN/AGENT_RULES.md` (this file)
2. Read `AGENT_BRAIN/PROJECT_STATE.md`
3. Open `AGENT_BRAIN/TASKS.md` → pick first `PENDING`
4. Mark it `IN_PROGRESS` in TASKS.md
5. Implement + test
6. Before session end: update PROJECT_STATE, TASKS, and SESSION_LOG

## Working Agreement
- **No git commits** — all changes are file edits only
- Keep AGENT_BRAIN files as single source of truth
- Max 30 tasks total
- Update SESSION_LOG after every task completion

## Architecture
- **Next.js 14** (App Router, TypeScript)
- **Prisma** ORM → PostgreSQL (Docker)
- **Redis** (Docker) for caching + job queue
- **Tailwind CSS** + shadcn/ui
- **Zod** validation everywhere
- Store timestamps as UTC, business timezone configurable (default America/Chicago)
- Slot granularity: 15 minutes

## Domain
**Hair Salon — "StyleHub"**

## Routes
- `/provider/*` — Provider/admin UI
- `/book/*` — Customer booking flow

## Quality Standards
- No double booking (transactional conflict checks)
- Input validation on all endpoints
- Structured logging with requestId
- Rate limiting on booking endpoints
- Unit tests for availability engine
- Smoke E2E test for booking flow
