import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CancelAppointmentSchema } from "@/lib/schemas";
import { AppointmentStatus } from "@prisma/client";
import { logger } from "@/lib/logger";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
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
    body = {};
  }

  const parsed = CancelAppointmentSchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : "";

  // Verify ownership before mutating — prevents cross-tenant cancellations.
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  // Atomic cancel: updateMany with a status condition prevents the TOCTOU race
  // where two concurrent requests both read BOOKED, then both write CANCELLED
  // and duplicate the event log entry. Only the request that successfully
  // transitions from BOOKED writes the event.
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.appointment.updateMany({
      where: {
        id: params.id,
        businessId: tenant.businessId,
        status: AppointmentStatus.BOOKED,
      },
      data: {
        status: AppointmentStatus.CANCELLED,
        notes: reason
          ? `${appointment.notes}\n[Cancelled: ${reason}]`.trim()
          : appointment.notes,
      },
    });

    // Only log the event if this request won the race.
    if (count > 0) {
      await tx.eventLog.create({
        data: {
          type: "APPOINTMENT_CANCELLED",
          payload: { appointmentId: params.id, reason },
        },
      });
    }
  });

  // Convert the UTC timestamp to a business-local calendar date so the cache
  // key matches exactly what the availability engine wrote.
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: tenant.business.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(appointment.startAt);
  await invalidateAvailabilityForDate(tenant.businessId, dateStr);

  logger.info("Appointment cancelled", { appointmentId: params.id, reason });

  const updated = await prisma.appointment.findUnique({ where: { id: params.id } });
  return NextResponse.json({ appointment: updated });
}
