# Tasks

## PHASE 0 — Platform Foundation

| ID | Task | Status |
|----|------|--------|
| TASK-01 | Repo scaffold + agent brain OS | DONE |
| TASK-02 | Dev environment via Docker (Postgres + Redis) | DONE |
| TASK-03 | Prisma schema + migrations (production-grade) | DONE |
| TASK-04 | Seed system + demo scenarios | DONE |
| TASK-05 | API contracts + validation layer | DONE |

## PHASE 1 — Scheduling Engine

| ID | Task | Status |
|----|------|--------|
| TASK-06 | Availability engine v1 (correctness first) | DONE |
| TASK-07 | Availability API + caching strategy | DONE |
| TASK-08 | Booking API (atomic, conflict-proof, idempotent) | DONE |
| TASK-09 | Appointment lifecycle (cancel/reschedule) | DONE |

## PHASE 2 — Provider Experience

| ID | Task | Status |
|----|------|--------|
| TASK-10 | Provider UI: services (durations + buffers + pricing) | DONE |
| TASK-11 | Provider UI: staff + skills mapping | DONE |
| TASK-12 | Provider UI: schedules + breaks + time off | DONE |
| TASK-13 | Provider calendar + agenda views | DONE |

## PHASE 3 — Customer Booking Journey

| ID | Task | Status |
|----|------|--------|
| TASK-14 | Customer service discovery + detail | DONE |
| TASK-15 | Customer booking flow (date → slots → confirm) | DONE |
| TASK-16 | Confirmation + notifications (dev-mode acceptable) | DONE |

## PHASE 4 — Quality, Security, Observability

| ID | Task | Status |
|----|------|--------|
| TASK-17 | Observability: structured logs + basic metrics | DONE |
| TASK-18 | Security + abuse prevention baseline | DONE |
| TASK-19 | Testing suite: core unit + smoke E2E | DONE |
| TASK-20 | Performance pass + query optimization | DONE |

## PHASE 5 — Demo Readiness

| ID | Task | Status |
|----|------|--------|
| TASK-21 | Demo script + operator checklist | DONE |
| TASK-22 | README final: setup, reset, demo, assumptions | DONE |
| TASK-23 | Final verification + email draft | DONE |

## PHASE 6 — UI Redesign (Apple Mirror Glass)

| ID | Task | Status |
|----|------|--------|
| UI-01 | Design token system (CSS variables, light/dark) | DONE |
| UI-02 | Tailwind config with token-based theming | DONE |
| UI-03 | Component library (Button, Input, Card, Modal, Table, etc.) | DONE |
| UI-04 | Theme provider + toast system + motion primitives | DONE |
| UI-05 | Home page redesign (glassmorphism) | DONE |
| UI-06 | Customer booking flow (3 pages) | DONE |
| UI-07 | Provider layout + dashboard | DONE |
| UI-08 | Provider services page (modal form, table) | DONE |
| UI-09 | Provider staff page (card list, skills modal) | DONE |
| UI-10 | Provider schedule page (hours, time-off, blackouts) | DONE |
| UI-11 | Provider appointments page (table, detail modal) | DONE |
| UI-12 | Provider calendar page (day/week views, staff colors) | DONE |
| UI-13 | TypeScript compilation verification | DONE |

## PHASE 7 — Multi-tenant Hardening, Timezone Fix, Error UX

| ID | Task | Status |
|----|------|--------|
| MT-01 | Propagate tenant scoping to all API routes (resolveTenant + businessId filters) | DONE |
| MT-02 | Create bizFetch client wrapper + NEXT_PUBLIC_BUSINESS_ID env var | DONE |
| MT-03 | Update all client pages to use bizFetch (eliminate missing x-business-id crashes) | DONE |
| MT-04 | Fix analytics route: replace $queryRaw AT TIME ZONE with JS-based grouping | DONE |
| MT-05 | Fix timezone display: add NEXT_PUBLIC_BUSINESS_TIMEZONE + format-date.ts helpers | DONE |
| MT-06 | Fix calendar grid positioning: use localHourMinute() instead of .getHours() | DONE |
| MT-07 | Add TenantGuard component + /api/tenant/check endpoint for friendly error screen | DONE |
| MT-08 | Write 19 unit tests for availability engine (double-booking, TZ edges, multi-tenant) | DONE |
| MT-09 | Fix TOCTOU race in cancel route (atomic updateMany) | DONE |
| MT-10 | Fix reschedule route: timezone-correct day boundaries, working-hours/time-off checks | DONE |
| MT-11 | Update README + AGENT_BRAIN to reflect all Phase 7 changes | DONE |
