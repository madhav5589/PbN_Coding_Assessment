import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { CancelAppointmentSchema } from "@/lib/schemas";
import { AppointmentStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = CancelAppointmentSchema.safeParse(body);
  const reason = parsed.success ? parsed.data.reason : "";

  const appointment = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (appointment.status === AppointmentStatus.CANCELLED) {
    return NextResponse.json({ error: "Already cancelled" }, { status: 400 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.update({
      where: { id: params.id },
      data: {
        status: AppointmentStatus.CANCELLED,
        notes: reason ? `${appointment.notes}\n[Cancelled: ${reason}]`.trim() : appointment.notes,
      },
    });

    await tx.eventLog.create({
      data: {
        type: "APPOINTMENT_CANCELLED",
        payload: { appointmentId: params.id, reason },
      },
    });

    return appt;
  });

  // Invalidate cache
  try {
    const dateStr = updated.startAt.toISOString().split("T")[0];
    const keys = await redis.keys(`availability:*:${dateStr}:*`);
    if (keys.length > 0) await redis.del(...keys);
  } catch {}

  logger.info("Appointment cancelled", { appointmentId: params.id, reason });

  return NextResponse.json({ appointment: updated });
}
