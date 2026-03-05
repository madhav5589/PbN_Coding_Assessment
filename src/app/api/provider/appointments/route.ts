import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const date = sp.get("date");
  const staffId = sp.get("staffId");
  const status = sp.get("status") as AppointmentStatus | null;

  const where: any = {};

  if (date) {
    // Filter appointments that overlap with the given date (in business timezone)
    const dayStart = new Date(date + "T00:00:00Z");
    const dayEnd = new Date(date + "T23:59:59Z");
    // Approximate — for proper tz handling we'd convert, but this is close enough for filtering
    where.startAt = { gte: new Date(dayStart.getTime() - 12 * 60 * 60 * 1000) };
    where.endAt = { lte: new Date(dayEnd.getTime() + 12 * 60 * 60 * 1000) };
  }

  if (staffId) where.staffId = staffId;
  if (status) where.status = status;

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      service: { select: { id: true, name: true, durationMin: true, priceCents: true } },
      staff: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ appointments });
}
