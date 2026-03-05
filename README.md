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

# 5. Start the app
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
| ORM | Prisma 6.19 |
| Cache | Redis 7 (Docker, ioredis) |
| Validation | Zod |
| Styling | Tailwind CSS 3 |
| Timezone | UTC storage, `America/Chicago` display via `Intl.DateTimeFormat` |

---

## Architecture

### Key Design Decisions

- **UTC-everywhere**: All timestamps stored as UTC in PostgreSQL. Business timezone (`America/Chicago`) used only for display and slot computation.
- **Serializable transactions + `SELECT ... FOR UPDATE`**: Booking API uses the strongest isolation level plus row-level locks to prevent double-booking under concurrent requests.
- **Availability engine**: Computes available slots by intersecting working hours, time-off, blackout dates, and existing appointments. Returns 15-minute granularity slots.
- **Redis caching**: Availability responses cached for 2 minutes. Cache invalidated on booking/cancellation/reschedule.
- **Rate limiting**: Sliding window rate limiter on booking endpoint (10 req/min per email) to prevent abuse.
- **Idempotency keys**: Optional UUID-based idempotency for booking requests.
- **Structured logging**: JSON logger with request correlation IDs.

### Data Model

10 tables: Business, Service, Staff, StaffService, WorkingHours, TimeOff, Blackout, Appointment, EventLog, NotificationJob.

### API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check (DB + Redis) |
| GET | `/api/services` | List all active services |
| GET | `/api/services/[id]` | Service detail with eligible staff |
| GET | `/api/availability?serviceId=&date=` | Compute + cache available slots |
| POST | `/api/book` | Create appointment (transactional) |
| GET | `/api/provider/appointments` | List appointments (filterable) |
| PUT | `/api/provider/appointments/[id]/cancel` | Cancel with event logging |
| PUT | `/api/provider/appointments/[id]/reschedule` | Reschedule with conflict check |
| PUT | `/api/provider/appointments/[id]/notes` | Update appointment notes |
| GET/POST | `/api/provider/services` | Provider service CRUD |
| GET/POST | `/api/provider/staff` | Provider staff CRUD |
| GET/PUT | `/api/provider/staff/[id]/hours` | Working hours management |
| GET/POST | `/api/provider/staff/[id]/time-off` | Time-off management |
| GET/POST | `/api/provider/blackouts` | Business blackout dates |

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

1. Single-tenant (one business).
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
| `BUSINESS_TIMEZONE` | `America/Chicago` | Display timezone |
| `SLOT_INTERVAL_MINUTES` | `15` | Slot granularity |
| `PROVIDER_SECRET` | `stylehub-demo-2026` | Provider API auth (placeholder) |
