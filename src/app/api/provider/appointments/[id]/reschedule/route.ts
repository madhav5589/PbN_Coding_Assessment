import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RescheduleAppointmentSchema } from "@/lib/schemas";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { localToUtc, getDayOfWeek, timeToMinutes } from "@/lib/timezone";
import { invalidateAvailabilityForDate } from "@/lib/cache";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RescheduleAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { date, startTime, staffId: newStaffId } = parsed.data;

  // Verify the appointment belongs to this business.
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
    include: { service: true },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (appointment.status !== AppointmentStatus.BOOKED) {
    return NextResponse.json(
      { error: "Only BOOKED appointments can be rescheduled" },
      { status: 400 }
    );
  }

  const targetStaffId = newStaffId ?? appointment.staffId;

  // If a different staff member is requested, verify they're active in this business.
  if (newStaffId && newStaffId !== appointment.staffId) {
    const targetStaff = await prisma.staff.findFirst({
      where: { id: targetStaffId, businessId: tenant.businessId, isActive: true },
    });
    if (!targetStaff) {
      return NextResponse.json(
        { error: "Not found", message: "Staff not found in this business" },
        { status: 404 }
      );
    }
  }

  const totalDuration =
    appointment.service.bufferBeforeMin +
    appointment.service.durationMin +
    appointment.service.bufferAfterMin;

  // Use the shared localToUtc from timezone.ts — the original local copy had
  // two bugs: hour12:false instead of hourCycle:"h23" (midnight edge case) and
  // a fragile day-of-month comparison that broke at month boundaries.
  const newStartUtc = localToUtc(date, startTime, tenant.business.timezone);
  const newEndUtc = new Date(newStartUtc.getTime() + totalDuration * 60 * 1000);

  // ─── Working hours check ────────────────────────────────────────────────────

  const dayOfWeek = getDayOfWeek(date);
  const workingHours = await prisma.workingHours.findFirst({
    where: { staffId: targetStaffId, dayOfWeek },
  });

  if (!workingHours || workingHours.isClosed) {
    return NextResponse.json(
      { error: "OUTSIDE_HOURS", message: "Staff does not work on that day" },
      { status: 409 }
    );
  }

  const startMin = timeToMinutes(startTime);
  const endMin = startMin + totalDuration;
  const workStart = timeToMinutes(workingHours.startTimeLocal);
  const workEnd = timeToMinutes(workingHours.endTimeLocal);

  if (startMin < workStart || endMin > workEnd) {
    return NextResponse.json(
      { error: "OUTSIDE_HOURS", message: "Requested time falls outside working hours" },
      { status: 409 }
    );
  }

  // ─── Time-off check ─────────────────────────────────────────────────────────

  const timeOffConflict = await prisma.timeOff.findFirst({
    where: {
      staffId: targetStaffId,
      startAt: { lt: newEndUtc },
      endAt: { gt: newStartUtc },
    },
  });

  if (timeOffConflict) {
    return NextResponse.json(
      { error: "STAFF_UNAVAILABLE", message: "Staff has time-off during that period" },
      { status: 409 }
    );
  }

  // ─── Blackout check ─────────────────────────────────────────────────────────

  const blackoutConflict = await prisma.blackout.findFirst({
    where: {
      businessId: tenant.businessId,
      startAt: { lt: newEndUtc },
      endAt: { gt: newStartUtc },
    },
  });

  if (blackoutConflict) {
    return NextResponse.json(
      { error: "BLACKOUT", message: "A business blackout covers that period" },
      { status: 409 }
    );
  }

  // ─── Conflict check + update (serializable) ─────────────────────────────────

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        // SELECT FOR UPDATE locks conflicting rows; Serializable isolation aborts
        // any concurrent transaction whose read set overlaps with our write set.
        const conflicts = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM appointments
          WHERE staff_id = ${targetStaffId}
            AND id != ${params.id}
            AND status = 'BOOKED'
            AND start_at < ${newEndUtc}
            AND end_at > ${newStartUtc}
          FOR UPDATE
        `;

        if (conflicts.length > 0) {
          throw new Error("SLOT_TAKEN");
        }

        const appt = await tx.appointment.update({
          where: { id: params.id },
          data: {
            staffId: targetStaffId,
            startAt: newStartUtc,
            endAt: newEndUtc,
          },
        });

        await tx.eventLog.create({
          data: {
            type: "APPOINTMENT_RESCHEDULED",
            payload: {
              appointmentId: params.id,
              newDate: date,
              newStartTime: startTime,
              newStaffId: targetStaffId,
            },
          },
        });

        return appt;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // Invalidate cache for both the old date and the new date.
    const oldDateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: tenant.business.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(appointment.startAt);

    await Promise.all([
      invalidateAvailabilityForDate(tenant.businessId, oldDateStr),
      invalidateAvailabilityForDate(tenant.businessId, date),
    ]);

    logger.info("Appointment rescheduled", { appointmentId: params.id, date, startTime });
    return NextResponse.json({ appointment: updated });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "SLOT_TAKEN") {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "New time slot is not available" },
        { status: 409 }
      );
    }
    // P2034 = Prisma serialization failure; treat as a booking race.
    if ((err as { code?: string }).code === "P2034") {
      return NextResponse.json(
        { error: "SLOT_TAKEN", message: "New time slot is not available" },
        { status: 409 }
      );
    }
    logger.error("Reschedule error", { error: String(err) });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
