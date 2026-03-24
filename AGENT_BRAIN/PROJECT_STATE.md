# Project State

## Current Phase
PHASE 7 — Multi-tenant Hardening, Timezone Fix, Error UX

## Current Task
All Phase 7 tasks — COMPLETE

## Overall Progress
- [x] Step 0: Start time recorded (2026-03-04 07:48 PM CT)
- [x] PHASE 0: Platform Foundation (TASK-01 through TASK-05) — COMPLETE
- [x] PHASE 1: Scheduling Engine (TASK-06 through TASK-09) — COMPLETE
- [x] PHASE 2: Provider Experience (TASK-10 through TASK-13) — COMPLETE
- [x] PHASE 3: Customer Booking Journey (TASK-14 through TASK-16) — COMPLETE
- [x] PHASE 4: Quality, Security, Observability (TASK-17 through TASK-20) — COMPLETE
- [x] PHASE 5: Demo Readiness (TASK-21 through TASK-23) — COMPLETE
- [x] PHASE 6: UI Redesign — Apple Mirror Glass Design System — COMPLETE
- [x] PHASE 7: Multi-tenant Hardening, Timezone Fix, Error UX — COMPLETE

## Key Decisions
- Domain: Hair Salon ("StyleHub")
- DB: PostgreSQL 16 via Docker (port 5433 → 5432)
- Cache: Redis 7 via Docker (port 6379)
- UI: Tailwind CSS 3 + CSS variable design tokens + framer-motion + lucide-react
- Design: Apple Mirror Glass (glassmorphism, light/dark themes, reduced-motion support)
- Validation: Zod
- Auth: No auth (demo mode)
- Multi-tenancy: `x-business-id` header, validated by `resolveTenant()`, injected by `bizFetch`
- Business ID config: `NEXT_PUBLIC_BUSINESS_ID` env var; `TenantGuard` shows friendly error if not found
- Timezone: UTC storage, `NEXT_PUBLIC_BUSINESS_TIMEZONE` display via `Intl.DateTimeFormat`
- Slot granularity: 15 minutes
- Booking concurrency: Serializable isolation + SELECT FOR UPDATE
- Rate limiting: Sliding window via Redis (10 req/min per email on booking)

## Key Files
- `prisma/schema.prisma` — 10 models, 2 migrations applied
- `src/lib/tenant.ts` — resolveTenant(), tenantRequired()
- `src/lib/client-fetch.ts` — bizFetch() wrapper injecting x-business-id header
- `src/lib/timezone.ts` — localToUtc, utcToLocalMinutes, getDayOfWeek, dayBoundariesUtc
- `src/lib/format-date.ts` — formatDateTZ, formatTimeTZ, localHourMinute (business-TZ display)
- `src/lib/availability.ts` — Core availability engine
- `src/lib/rate-limit.ts` — Redis sliding window rate limiter
- `src/components/tenant-guard.tsx` — "Business Not Found" friendly error screen
- `src/app/api/tenant/check/route.ts` — Lightweight tenant validity endpoint
- `src/app/api/book/route.ts` — Atomic booking endpoint
- `src/app/api/provider/analytics/route.ts` — JS-based timezone grouping (no $queryRaw AT TIME ZONE)
- `src/app/book/[serviceId]/page.tsx` — Full customer booking flow
- `src/app/provider/` — All provider management pages
- `src/components/ui/` — Design system component library (25+ components)
- `src/app/globals.css` — CSS variable design tokens (light/dark)
- `src/components/ui/theme-provider.tsx` — Theme context with localStorage persistence
- `src/app/providers.tsx` — Client-side providers wrapper
- `src/__tests__/availability.test.ts` — 19 unit tests

## Known Issues
- Docker compose `version: "3.8"` generates deprecation warning (non-breaking)
- Prisma `package.json#prisma` config deprecated warning (works fine)
