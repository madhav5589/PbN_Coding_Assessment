# API Contracts

## Base URL
`http://localhost:3000/api`

## Tenant Header
All routes (except `/api/health`) require the `x-business-id` HTTP header containing a valid business UUID. The `bizFetch` client wrapper injects this automatically from `NEXT_PUBLIC_BUSINESS_ID`.

Missing or invalid header → `400 { error: "TENANT_REQUIRED", message: "..." }`

## Tenant Check

### GET /api/tenant/check
Verify that the current `x-business-id` resolves to a known business. Used by `TenantGuard` on mount.
- **200** `{ ok: true }` — business found
- **400** `{ error: "TENANT_REQUIRED" }` — business not found

## Common Types (Zod)

```typescript
// Shared
const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD
const TimeString = z.string().regex(/^\d{2}:\d{2}$/); // HH:MM

// Pagination
const PaginationParams = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

---

## Services

### GET /api/services
List all active services.
Response: `{ services: Service[] }`

### GET /api/services/:id
Get service detail.
Response: `{ service: Service }`

### POST /api/provider/services (provider)
Create service.
Body: `{ name, durationMin, bufferBeforeMin, bufferAfterMin, priceCents, isActive }`

### PUT /api/provider/services/:id (provider)
Update service.

### DELETE /api/provider/services/:id (provider)
Soft-delete (set isActive=false).

---

## Staff

### GET /api/provider/staff (provider)
List all staff.
Response: `{ staff: Staff[] }`

### POST /api/provider/staff (provider)
Create staff member.
Body: `{ name, isActive }`

### PUT /api/provider/staff/:id (provider)
Update staff.

### GET /api/provider/staff/:id/services (provider)
Get staff service assignments.

### PUT /api/provider/staff/:id/services (provider)
Update staff service assignments.
Body: `{ serviceIds: string[] }`

---

## Working Hours

### GET /api/provider/staff/:id/hours (provider)
Get weekly schedule for staff.

### PUT /api/provider/staff/:id/hours (provider)
Set weekly schedule.
Body: `{ hours: { dayOfWeek, startTime, endTime, isClosed }[] }`

---

## Time Off

### GET /api/provider/staff/:id/time-off (provider)
List time off for staff.

### POST /api/provider/staff/:id/time-off (provider)
Create time off.
Body: `{ startAt, endAt, reason }`

### DELETE /api/provider/time-off/:id (provider)
Delete time off entry.

---

## Blackout Dates

### GET /api/provider/blackouts (provider)
List business blackout dates.

### POST /api/provider/blackouts (provider)
Create blackout date.
Body: `{ startAt, endAt, reason }`

### DELETE /api/provider/blackouts/:id (provider)
Delete blackout.

---

## Availability

### GET /api/availability?serviceId=X&date=YYYY-MM-DD&staffId=Y
Get available slots for a service on a date.
Response:
```json
{
  "date": "2026-03-10",
  "serviceId": "...",
  "slots": [
    {
      "startTime": "09:00",
      "endTime": "09:45",
      "staffId": "...",
      "staffName": "..."
    }
  ]
}
```

---

## Booking

### POST /api/book
Book an appointment.
Body:
```json
{
  "serviceId": "...",
  "staffId": "...",
  "date": "2026-03-10",
  "startTime": "09:00",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "notes": "First visit",
  "idempotencyKey": "uuid-v4"
}
```
Response: `{ appointment: Appointment }`
Errors: `SLOT_TAKEN`, `INVALID_INPUT`, `OUTSIDE_HOURS`, `STAFF_UNAVAILABLE`

---

## Appointments (Provider)

### GET /api/provider/appointments?date=X&staffId=Y&status=Z
List appointments with filters.

### GET /api/provider/appointments/:id
Appointment detail.

### PUT /api/provider/appointments/:id/cancel
Cancel appointment.
Body: `{ reason }`

### PUT /api/provider/appointments/:id/reschedule
Reschedule appointment.
Body: `{ date, startTime, staffId }`

### PUT /api/provider/appointments/:id/notes
Update appointment notes.
Body: `{ notes }`
