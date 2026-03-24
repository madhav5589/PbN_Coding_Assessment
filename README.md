# StyleHub — Appointment Booking Web App

**Start time: 2026-03-04 07:48 PM CT**

> Production-grade appointment booking platform for a hair salon, featuring provider management (services, staff, schedules, calendar) and a complete customer booking journey with real-time availability, conflict-proof transactional booking, and Redis-cached slot computation.

---

## Quick Start

```bash
# 1. Start infrastructure (PostgreSQL 16 + Redis 7)
docker compose -f infrastructure/docker-compose.yml up -d

# 2. Install dependencies
npm install

# 3. Create your .env file from the sample
cp .env.sample .env

# 4. Run migrations and seed
npx prisma migrate dev
npx prisma db seed

# 5. Find your seeded business ID and update .env
#    psql or any PG client:
#    SELECT id FROM businesses LIMIT 1;
#    Then set NEXT_PUBLIC_BUSINESS_ID in .env

# 6. Start the app
npm run dev
```

Open:
- **Customer Booking**: http://localhost:3000/book
- **Provider Dashboard**: http://localhost:3000/provider
- **Health Check**: http://localhost:3000/api/health

### Reset Database
```bash
npx prisma migrate reset --force   # drops all data, re-migrates, re-seeds
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL 16 (Docker) |
| ORM | Prisma 6 |
| Cache | Redis 7 (Docker, ioredis) |
| Validation | Zod |
| Styling | Tailwind CSS 3 + CSS variable design tokens |
| UI Components | Custom component library (25+ components, glassmorphism design) |
| Animations | framer-motion (reduced-motion aware) |
| Icons | lucide-react |
| Timezone | UTC storage, business timezone display via `Intl.DateTimeFormat` |
| Testing | Jest + ts-jest |

---

## Architecture

### Key Design Decisions

- **Multi-tenant via `x-business-id` header**: Every API request identifies its business via an HTTP header. The `resolveTenant()` helper validates the header as a UUID and confirms it against the database before any scoped query runs. Client pages use the `bizFetch` wrapper (see `src/lib/client-fetch.ts`) which injects the header automatically from `NEXT_PUBLIC_BUSINESS_ID`.
- **UTC-everywhere**: All timestamps stored as UTC in PostgreSQL. Business timezone (`NEXT_PUBLIC_BUSINESS_TIMEZONE`) used only for display and slot computation.
- **Business-timezone-aware display**: `src/lib/format-date.ts` provides `formatDateTZ()`, `formatTimeTZ()`, and `localHourMinute()` helpers used by all provider pages and the calendar grid. Times always reflect the business location, regardless of the browser's timezone.
- **Serializable transactions + `SELECT ... FOR UPDATE`**: Booking API uses the strongest isolation level plus row-level locks to prevent double-booking under concurrent requests.
- **Availability engine**: Computes available slots by intersecting working hours, time-off, blackout dates, and existing appointments. Returns 15-minute granularity slots.
- **Redis caching**: Availability responses cached for 2 minutes. Cache invalidated on booking/cancellation/reschedule via `invalidateAvailabilityForDate`.
- **Rate limiting**: Sliding window rate limiter on booking endpoint (10 req/min per email) to prevent abuse.
- **Idempotency keys**: Optional UUID-based idempotency for booking requests.
- **Structured logging**: JSON logger with request correlation IDs.
- **Friendly error screens**: `TenantGuard` component wraps all provider and booking pages. If `NEXT_PUBLIC_BUSINESS_ID` doesn't match a business in the database, a clear error screen with fix instructions is shown instead of a stack trace.

### Data Model

10 tables: Business, Service, Staff, StaffService, WorkingHours, TimeOff, Blackout, Appointment, EventLog, NotificationJob.

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (DB + Redis) |
| GET | `/api/tenant/check` | Lightweight tenant validity check |
| GET | `/api/services` | List all active services |
| GET | `/api/services/[id]` | Service detail with eligible staff |
| GET | `/api/availability?serviceId=&date=` | Compute + cache available slots |
| POST | `/api/book` | Create appointment (transactional) |
| GET | `/api/provider/analytics` | Dashboard analytics (JS-based timezone grouping) |
| GET | `/api/provider/appointments` | List appointments (filterable by date/status) |
| GET | `/api/provider/appointments/[id]` | Appointment detail |
| PUT | `/api/provider/appointments/[id]/cancel` | Cancel with event logging |
| PUT | `/api/provider/appointments/[id]/reschedule` | Reschedule with conflict check |
| PUT | `/api/provider/appointments/[id]/notes` | Update appointment notes |
| GET/POST | `/api/provider/services` | Provider service CRUD |
| PUT/DELETE | `/api/provider/services/[id]` | Update / soft-delete service |
| GET/POST | `/api/provider/staff` | Provider staff CRUD |
| PUT | `/api/provider/staff/[id]` | Update staff (name, active status) |
| GET/PUT | `/api/provider/staff/[id]/hours` | Working hours management |
| GET/POST | `/api/provider/staff/[id]/time-off` | Time-off management |
| DELETE | `/api/provider/time-off/[id]` | Delete time-off entry |
| GET/PUT | `/api/provider/staff/[id]/services` | Staff service assignments |
| GET/POST | `/api/provider/blackouts` | Business blackout dates |
| DELETE | `/api/provider/blackouts/[id]` | Delete blackout |

---

## Seed Data

The seed creates a realistic salon scenario:

- **1 Business**: StyleHub Hair Salon (timezone: America/Chicago)
- **6 Services**: Men's Haircut ($35/30min), Women's Haircut ($55/45min), Hair Coloring ($120/90min), Blowout & Style ($45/30min), Deep Conditioning ($65/45min), Beard Trim ($20/15min)
- **4 Staff**: Alex Rivera (senior, all services), Jordan Lee (barber), Taylor Kim (color specialist), Morgan Chen (junior, part-time)
- **15 Appointments**: Spread across the seed week (next Monday–Friday) with one cancellation
- **Conflicts**: Lunch breaks, Wednesday off for Taylor, Friday afternoon off for Alex, Sunday blackout
- **Seed week**: Always starts next Monday from current date

---

## Assumptions

1. Single business per deployment — `NEXT_PUBLIC_BUSINESS_ID` in `.env` identifies which business the app serves. The backend architecture supports multiple businesses (all queries are scoped by `businessId`) but the client is configured for one.
2. No authentication — provider pages are accessible without login (demo purposes).
3. 15-minute slot granularity (configurable via `SLOT_INTERVAL_MINUTES`).
4. Notifications are queued to `NotificationJob` table but not actually sent (dev-mode).
5. No payment processing.
6. Time-off entries are checked at appointment boundaries (not sub-slot).
7. Blackout dates block the entire business (all staff).

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://stylehub:stylehub_pass@localhost:5433/stylehub` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `NEXT_PUBLIC_BUSINESS_ID` | *(required)* | UUID of the business to serve — set this to the `id` from `SELECT id FROM businesses LIMIT 1` after seeding |
| `NEXT_PUBLIC_BUSINESS_TIMEZONE` | `America/Chicago` | IANA timezone for client-side date/time display (e.g. `America/New_York`, `America/Los_Angeles`) |
| `SLOT_INTERVAL_MINUTES` | `15` | Slot granularity |
| `PROVIDER_SECRET` | `stylehub-demo-2026` | Provider API auth (placeholder) |

---

## Key Source Files

| File | Purpose |
|------|---------|
| `src/lib/tenant.ts` | `resolveTenant()` — validates `x-business-id` header and loads the business |
| `src/lib/client-fetch.ts` | `bizFetch()` — thin `fetch` wrapper that injects `x-business-id` on every request |
| `src/lib/timezone.ts` | `localToUtc`, `utcToLocalMinutes`, `getDayOfWeek`, `dayBoundariesUtc` — timezone utilities |
| `src/lib/format-date.ts` | `formatDateTZ`, `formatTimeTZ`, `localHourMinute` — business-timezone-aware display helpers |
| `src/lib/availability.ts` | Core availability engine (working hours × time-off × blackouts × bookings) |
| `src/lib/rate-limit.ts` | Redis sliding-window rate limiter |
| `src/components/tenant-guard.tsx` | Shows "Business Not Found" error screen if `NEXT_PUBLIC_BUSINESS_ID` is invalid |
| `src/app/api/book/route.ts` | Atomic booking with Serializable isolation + SELECT FOR UPDATE |
| `src/app/provider/` | All provider management pages |
| `src/components/ui/` | Design system — 25+ components (Button, Card, Modal, Table, Badge, etc.) |
| `src/__tests__/availability.test.ts` | 19 unit tests: double-booking, timezone edges, buffer time, blackouts, multi-tenant |

---

## Running Tests

```bash
npx jest
```

19 tests covering:
- Double-booking prevention under concurrent requests
- Timezone edge cases (DST, midnight boundaries)
- Buffer time enforcement
- Blackout date handling
- Cancelled appointment slot recovery
- Multi-tenant isolation

---

## Known Issues / Warnings

- Docker compose `version: "3.8"` generates a deprecation warning (non-breaking)
- Prisma `package.json#prisma` config deprecated warning (works fine)
