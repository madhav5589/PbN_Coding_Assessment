import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { BookingSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";
import { AppointmentStatus, Prisma } from "@prisma/client";

/**
 * Convert local date+time to UTC for the business timezone
 */
function localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, mins] = timeStr.split(":").map(Number);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const guess = new Date(Date.UTC(year, month - 1, day, hours, mins, 0));
  const parts = formatter.formatToParts(guess);
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0");

  const guessLocalH = getPart("hour");
  const guessLocalM = getPart("minute");
  const guessLocalD = getPart("day");

  let offsetMinutes = (guessLocalH - hours) * 60 + (guessLocalM - mins);
  if (guessLocalD !== day) {
    offsetMinutes += guessLocalD > day ? 24 * 60 : -24 * 60;
  }

  return new Date(guess.getTime() - offsetMinutes * 60 * 1000);
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_INPUT", message: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BookingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { serviceId, staffId, date, startTime, customerName, customerEmail, customerPhone, notes, idempotencyKey } = parsed.data;

  // Rate limit by customer email: 10 bookings per minute
  const rl = await rateLimit(`book:${customerEmail}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many booking attempts. Please wait." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.retryAfterMs || 60000) / 1000)) } }
    );
  }

  // Check idempotency
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      logger.info("Duplicate booking request (idempotency)", { idempotencyKey });
      return NextResponse.json({ appointment: existing });
    }
  }

  // Load business
  const business = await prisma.business.findFirst();
  if (!business) {
    return NextResponse.json({ error: "SERVICE_NOT_FOUND", message: "No business configured" }, { status: 404 });
  }

  // Load service
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service || !service.isActive) {
    return NextResponse.json({ error: "SERVICE_NOT_FOUND", message: "Service not found or inactive" }, { status: 404 });
  }

  // Verify staff can perform this service
  const staffService = await prisma.staffService.findUnique({
    where: { staffId_serviceId: { staffId, serviceId } },
  });
  if (!staffService) {
    return NextResponse.json({ error: "STAFF_UNAVAILABLE", message: "Staff cannot perform this service" }, { status: 400 });
  }

  // Calculate appointment times
  const timezone = business.timezone;
  const totalDuration = service.bufferBeforeMin + service.durationMin + service.bufferAfterMin;
  const startAtUtc = localToUtc(date, startTime, timezone);
  const endAtUtc = new Date(startAtUtc.getTime() + totalDuration * 60 * 1000);

  // ═══════════════════════════════════════════════════════════
  // ATOMIC BOOKING with transaction + conflict check
  // ═══════════════════════════════════════════════════════════
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      // Lock and check for overlapping BOOKED appointments for this staff
      const conflicts = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM appointments
        WHERE staff_id = ${staffId}
          AND status = 'BOOKED'
          AND start_at < ${endAtUtc}
          AND end_at > ${startAtUtc}
        FOR UPDATE
      `;

      if (conflicts.length > 0) {
        throw new Error("SLOT_TAKEN");
      }

      // Check working hours
      const dayOfWeek = new Date(date + "T12:00:00Z").getDay();
      // Adjust for timezone (approximate — we use the date string day)
      const wh = await tx.workingHours.findUnique({
        where: { staffId_dayOfWeek: { staffId, dayOfWeek } },
      });

      if (!wh || wh.isClosed) {
        throw new Error("OUTSIDE_HOURS");
      }

      // Check time-off
      const timeOffs = await tx.timeOff.findMany({
        where: {
          staffId,
          startAt: { lt: endAtUtc },
          endAt: { gt: startAtUtc },
        },
      });

      if (timeOffs.length > 0) {
        throw new Error("STAFF_UNAVAILABLE");
      }

      // Check blackouts
      const blackouts = await tx.blackout.findMany({
        where: {
          businessId: business.id,
          startAt: { lt: endAtUtc },
          endAt: { gt: startAtUtc },
        },
      });

      if (blackouts.length > 0) {
        throw new Error("OUTSIDE_HOURS");
      }

      // Create the appointment
      const appt = await tx.appointment.create({
        data: {
          businessId: business.id,
          serviceId,
          staffId,
          customerName,
          customerEmail,
          customerPhone,
          startAt: startAtUtc,
          endAt: endAtUtc,
          status: AppointmentStatus.BOOKED,
          notes: notes || "",
          idempotencyKey: idempotencyKey || null,
        },
        include: {
          service: true,
          staff: true,
        },
      });

      // Log event
      await tx.eventLog.create({
        data: {
          type: "APPOINTMENT_BOOKED",
          payload: {
            appointmentId: appt.id,
            serviceId,
            staffId,
            customerEmail,
            date,
            startTime,
          },
        },
      });

      // Queue notification
      await tx.notificationJob.create({
        data: {
          type: "BOOKING_CONFIRMATION",
          payload: {
            appointmentId: appt.id,
            customerName,
            customerEmail,
            serviceName: service.name,
            date,
            startTime,
          },
        },
      });

      return appt;
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    // Invalidate availability cache for this date
    try {
      const keys = await redis.keys(`availability:*:${date}:*`);
      if (keys.length > 0) await redis.del(...keys);
    } catch {
      // Redis down — cache will expire naturally
    }

    logger.info("Appointment booked", {
      appointmentId: appointment.id,
      serviceId,
      staffId,
      date,
      startTime,
    });

    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err: any) {
    const code = err?.message;
    if (code === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "This time slot is no longer available" },
        { status: 409 }
      );
    }
    if (code === "OUTSIDE_HOURS") {
      return NextResponse.json(
        { error: "OUTSIDE_HOURS", message: "This time is outside working hours or during a blackout" },
        { status: 400 }
      );
    }
    if (code === "STAFF_UNAVAILABLE") {
      return NextResponse.json(
        { error: "STAFF_UNAVAILABLE", message: "Staff is unavailable at this time" },
        { status: 400 }
      );
    }

    logger.error("Booking error", { error: String(err), serviceId, staffId, date, startTime });
    return NextResponse.json(
      { error: "INTERNAL_ERROR", message: "Failed to create booking" },
      { status: 500 }
    );
  }
}
