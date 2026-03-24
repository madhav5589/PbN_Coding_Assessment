import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus, Prisma } from "@prisma/client";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { dayBoundariesUtc } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const sp = request.nextUrl.searchParams;
  const date = sp.get("date");
  const staffId = sp.get("staffId");
  const status = sp.get("status") as AppointmentStatus | null;

  const where: Prisma.AppointmentWhereInput = { businessId: tenant.businessId };

  if (date) {
    const { start, end } = dayBoundariesUtc(date, tenant.business.timezone);
    // Half-open interval overlap: appointment overlaps the day if its window
    // starts before the day ends AND ends after the day starts.
    // The original code used ±12h padding which under-counted and over-counted
    // at DST boundaries; dayBoundariesUtc gives exact local-midnight boundaries.
    where.startAt = { lt: end };
    where.endAt = { gt: start };
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
