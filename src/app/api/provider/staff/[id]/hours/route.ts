import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateWorkingHoursSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { invalidateAvailabilityForBusiness } from "@/lib/cache";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  // Verify staff belongs to this business before returning their schedule.
  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const hours = await prisma.workingHours.findMany({
    where: { staffId: params.id },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ hours });
}

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

  const parsed = UpdateWorkingHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify staff belongs to this business before modifying their schedule.
  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staffId = params.id;

  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { staffId } });
    await tx.workingHours.createMany({
      data: parsed.data.hours.map((h) => ({
        staffId,
        dayOfWeek: h.dayOfWeek,
        startTimeLocal: h.startTimeLocal,
        endTimeLocal: h.endTimeLocal,
        isClosed: h.isClosed,
      })),
    });
  });

  const hours = await prisma.workingHours.findMany({
    where: { staffId },
    orderBy: { dayOfWeek: "asc" },
  });

  // Working hours affect all future dates — invalidate all cached slots for this business.
  await invalidateAvailabilityForBusiness(tenant.businessId);

  return NextResponse.json({ hours });
}
