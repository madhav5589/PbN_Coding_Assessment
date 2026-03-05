import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { RescheduleAppointmentSchema } from "@/lib/schemas";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

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

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = RescheduleAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const { date, startTime, staffId: newStaffId } = parsed.data;

  const appointment = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { service: true },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (appointment.status !== AppointmentStatus.BOOKED) {
    return NextResponse.json({ error: "Only BOOKED appointments can be rescheduled" }, { status: 400 });
  }

  const business = await prisma.business.findFirst();
  if (!business) return NextResponse.json({ error: "No business" }, { status: 500 });

  const targetStaffId = newStaffId || appointment.staffId;
  const totalDuration =
    appointment.service.bufferBeforeMin +
    appointment.service.durationMin +
    appointment.service.bufferAfterMin;

  const newStartUtc = localToUtc(date, startTime, business.timezone);
  const newEndUtc = new Date(newStartUtc.getTime() + totalDuration * 60 * 1000);

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Check conflicts (excluding this appointment)
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
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    // Invalidate caches
    try {
      const oldDate = appointment.startAt.toISOString().split("T")[0];
      const keys = await redis.keys(`availability:*:${oldDate}:*`);
      const newKeys = await redis.keys(`availability:*:${date}:*`);
      const allKeys = Array.from(new Set([...keys, ...newKeys]));
      if (allKeys.length > 0) await redis.del(...allKeys);
    } catch {}

    logger.info("Appointment rescheduled", { appointmentId: params.id, date, startTime });
    return NextResponse.json({ appointment: updated });
  } catch (err: any) {
    if (err?.message === "SLOT_TAKEN") {
      return NextResponse.json({ error: "SLOT_TAKEN", message: "New time slot is not available" }, { status: 409 });
    }
    logger.error("Reschedule error", { error: String(err) });
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
