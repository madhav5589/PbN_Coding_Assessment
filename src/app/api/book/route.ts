import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BookingSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { localToUtc, getDayOfWeek, timeToMinutes } from "@/lib/timezone";
import { invalidateAvailabilityForDate } from "@/lib/cache";

// ─── Typed booking errors ─────────────────────────────────────────────────────

type BookingErrorCode =
  | "SLOT_TAKEN"
  | "OUTSIDE_HOURS"
  | "STAFF_UNAVAILABLE"
  | "SERVICE_NOT_FOUND";

/** Create a typed error that carries both a message and a structured code. */
function bookingError(code: BookingErrorCode): Error & { bookingCode: BookingErrorCode } {
  return Object.assign(new Error(code), { bookingCode: code });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // ── Tenant resolution ───────────────────────────────────────────────────────
  // Every booking must be scoped to a business. Previously this called
  // `prisma.business.findFirst()` which is non-deterministic in a multi-tenant
  // database.
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();
  const { businessId, business } = tenant;

  // ── Parse and validate the request body ────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "INVALID_INPUT", message: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    serviceId,
    staffId,
    date,
    startTime,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    idempotencyKey,
  } = parsed.data;

  // ── Rate limiting ───────────────────────────────────────────────────────────
  // Key is now scoped to `businessId` so rate limit consumption on Business A
  // does not affect the same customer email on Business B.
  const rl = await rateLimit(`book:${businessId}:${customerEmail}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many booking attempts. Please wait." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rl.retryAfterMs ?? 60_000) / 1000)),
        },
      },
    );
  }

  // ── Idempotency fast-path ───────────────────────────────────────────────────
  // Optimistic check: if this key already exists, return the stored appointment
  // immediately without entering the transaction. A race between two concurrent
  // requests with the same key is handled in the catch block below via P2002.
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      logger.info("Duplicate booking (idempotency fast-path)", { idempotencyKey });
      return NextResponse.json({ appointment: existing });
    }
  }

  // ── UTC start time ──────────────────────────────────────────────────────────
  // Computed once outside the transaction — it is pure arithmetic over the
  // validated date + time strings and the business timezone. No DB state
  // is involved. `endAtUtc` depends on service duration so it is computed
  // inside the transaction where the service row is loaded under lock.
  const timezone = business.timezone;
  const startAtUtc = localToUtc(date, startTime, timezone);

  // ── Atomic booking transaction ──────────────────────────────────────────────
  try {
    const appointment = await prisma.$transaction(
      async (tx) => {
        // ── Service (scoped to this business) ─────────────────────────────────
        // `findFirst` with `businessId` prevents a caller from booking a service
        // that belongs to another tenant.
        const service = await tx.service.findFirst({
          where: { id: serviceId, businessId, isActive: true },
        });
        if (!service) throw bookingError("SERVICE_NOT_FOUND");

        const totalDuration =
          service.bufferBeforeMin + service.durationMin + service.bufferAfterMin;
        const endAtUtc = new Date(startAtUtc.getTime() + totalDuration * 60_000);

        // ── Staff capability + tenant membership ──────────────────────────────
        // The staffService lookup confirms the staff can perform this service.
        // The nested `staff` include verifies the staff record belongs to this
        // business and is active — preventing cross-tenant staff injection.
        const staffService = await tx.staffService.findUnique({
          where: { staffId_serviceId: { staffId, serviceId } },
          include: {
            staff: { select: { businessId: true, isActive: true } },
          },
        });
        if (
          !staffService ||
          staffService.staff.businessId !== businessId ||
          !staffService.staff.isActive
        ) {
          throw bookingError("STAFF_UNAVAILABLE");
        }

        // ── Working hours — day + time range ─────────────────────────────────
        // BUG FIXED — day of week:
        //   Original: `new Date(date + "T12:00:00Z").getDay()`
        //   Problem:  `.getDay()` returns the day in the Node process's local
        //             timezone, not the business timezone. If the server runs in
        //             UTC+X the computed weekday can be wrong.
        //   Fixed:    `getDayOfWeek(date)` from timezone.ts uses Date.UTC +
        //             getUTCDay(), which is stable regardless of server TZ.
        //
        // BUG FIXED — time-in-range check:
        //   Original: only checked `wh.isClosed`. Never verified the requested
        //             time actually falls within startTimeLocal–endTimeLocal.
        //             A direct API call could book at 3 AM on a working day.
        //   Fixed:    explicit `startMin >= workStart && endMin <= workEnd` guard.
        const dayOfWeek = getDayOfWeek(date);
        const wh = await tx.workingHours.findUnique({
          where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
        });
        if (!wh || wh.isClosed) throw bookingError("OUTSIDE_HOURS");

        const startMin = timeToMinutes(startTime);
        const endMin = startMin + totalDuration;
        const workStart = timeToMinutes(wh.startTimeLocal);
        const workEnd = timeToMinutes(wh.endTimeLocal);
        if (startMin < workStart || endMin > workEnd) {
          throw bookingError("OUTSIDE_HOURS");
        }

        // ── Time-off check ────────────────────────────────────────────────────
        const timeOffCount = await tx.timeOff.count({
          where: {
            staffId,
            startAt: { lt: endAtUtc },
            endAt: { gt: startAtUtc },
          },
        });
        if (timeOffCount > 0) throw bookingError("STAFF_UNAVAILABLE");

        // ── Blackout check (scoped to this business) ──────────────────────────
        const blackoutCount = await tx.blackout.count({
          where: {
            businessId,
            startAt: { lt: endAtUtc },
            endAt: { gt: startAtUtc },
          },
        });
        if (blackoutCount > 0) throw bookingError("OUTSIDE_HOURS");

        // ── Double-booking conflict check ─────────────────────────────────────
        // WHY THIS IS AIRTIGHT AGAINST DOUBLE-BOOKING:
        //
        // Two mechanisms work together:
        //
        // 1. Serializable isolation: PostgreSQL tracks all rows read and written
        //    by this transaction. If another concurrent transaction has already
        //    committed a write that would affect our reads (a "phantom" insert
        //    into the appointments table for the same slot), the database aborts
        //    one transaction with a serialization failure (Prisma P2034).
        //
        // 2. FOR UPDATE row lock: locks any already-existing BOOKED appointments
        //    that overlap our slot. If Transaction B holds the lock, Transaction A
        //    waits. When A resumes it re-reads and sees B's appointment, detects
        //    the conflict, and throws SLOT_TAKEN rather than inserting a duplicate.
        //
        // Together: FOR UPDATE handles the "row already exists" case explicitly;
        // Serializable handles the "phantom insert" case (empty slot, two
        // concurrent inserts). Either way only one booking can succeed.
        const conflicts = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM appointments
          WHERE staff_id      = ${staffId}
            AND status        = 'BOOKED'
            AND start_at      < ${endAtUtc}
            AND end_at        > ${startAtUtc}
          FOR UPDATE
        `;
        if (conflicts.length > 0) throw bookingError("SLOT_TAKEN");

        // ── Create the appointment ────────────────────────────────────────────
        const appt = await tx.appointment.create({
          data: {
            businessId,
            serviceId,
            staffId,
            customerName,
            customerEmail,
            customerPhone,
            startAt: startAtUtc,
            endAt: endAtUtc,
            status: AppointmentStatus.BOOKED,
            notes: notes ?? "",
            idempotencyKey: idempotencyKey ?? null,
          },
          include: { service: true, staff: true },
        });

        // ── Audit log ─────────────────────────────────────────────────────────
        await tx.eventLog.create({
          data: {
            type: "APPOINTMENT_BOOKED",
            payload: {
              appointmentId: appt.id,
              businessId,
              serviceId,
              staffId,
              customerEmail,
              date,
              startTime,
            },
          },
        });

        // ── Notification queue ────────────────────────────────────────────────
        await tx.notificationJob.create({
          data: {
            type: "BOOKING_CONFIRMATION",
            payload: {
              appointmentId: appt.id,
              businessId,
              customerName,
              customerEmail,
              serviceName: service.name,
              date,
              startTime,
            },
          },
        });

        return appt;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Cache invalidation — SCAN-based, non-blocking, businessId-scoped.
    await invalidateAvailabilityForDate(businessId, date);

    logger.info("Appointment booked", {
      appointmentId: appointment.id,
      businessId,
      serviceId,
      staffId,
      date,
      startTime,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err: unknown) {
    // ── Typed business logic errors ───────────────────────────────────────────
    const bookingCode = (err as { bookingCode?: string }).bookingCode;

    if (bookingCode === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "This time slot is no longer available" },
        { status: 409 },
      );
    }
    if (bookingCode === "OUTSIDE_HOURS") {
      return NextResponse.json(
        {
          error: "OUTSIDE_HOURS",
          message: "This time is outside working hours or during a blackout",
        },
        { status: 400 },
      );
    }
    if (bookingCode === "STAFF_UNAVAILABLE") {
      return NextResponse.json(
        { error: "STAFF_UNAVAILABLE", message: "Staff is unavailable at this time" },
        { status: 400 },
      );
    }
    if (bookingCode === "SERVICE_NOT_FOUND") {
      return NextResponse.json(
        { error: "SERVICE_NOT_FOUND", message: "Service not found or inactive" },
        { status: 404 },
      );
    }

    // ── Serialization failure (Prisma P2034) ──────────────────────────────────
    // PostgreSQL aborted one of two concurrent Serializable transactions that
    // conflicted at the same slot. Semantically this is the same as SLOT_TAKEN.
    if ((err as { code?: string }).code === "P2034") {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "This time slot is no longer available" },
        { status: 409 },
      );
    }

    // ── Idempotency key race (Prisma P2002) ───────────────────────────────────
    // Two concurrent requests with the same idempotencyKey both passed the
    // optimistic fast-path check and raced to insert. The unique constraint
    // killed one of them with P2002. Recover the winning appointment and return
    // it as a normal idempotent success rather than an unhandled 500.
    const prismaErr = err as { code?: string; meta?: { target?: string[] } };
    if (
      prismaErr.code === "P2002" &&
      idempotencyKey &&
      prismaErr.meta?.target?.some((t) => t.includes("idempotency_key"))
    ) {
      const existing = await prisma.appointment.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        logger.info("Duplicate booking (idempotency constraint race)", {
          idempotencyKey,
        });
        return NextResponse.json({ appointment: existing });
      }
    }

    logger.error("Booking error", {
      error: String(err),
      businessId,
      serviceId,
      staffId,
      date,
      startTime,
    });

    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to create booking" },
      { status: 500 },
    );
  }
}
