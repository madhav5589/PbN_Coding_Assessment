import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateStaffServicesSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staffServices = await prisma.staffService.findMany({
    where: { staffId: params.id },
    include: {
      service: { select: { id: true, name: true, durationMin: true, isActive: true } },
    },
  });

  return NextResponse.json({ services: staffServices });
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

  const parsed = UpdateStaffServicesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { businessId } = tenant;

  // Verify the staff member belongs to this business.
  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify all requested services belong to this business.
  // This prevents cross-tenant service injection — e.g. Business A staff being
  // assigned to a service that belongs to Business B.
  const { serviceIds } = parsed.data;
  if (serviceIds.length > 0) {
    const validServices = await prisma.service.findMany({
      where: { id: { in: serviceIds }, businessId },
      select: { id: true },
    });
    if (validServices.length !== serviceIds.length) {
      return NextResponse.json(
        { error: "INVALID_INPUT", message: "One or more services do not belong to this business" },
        { status: 400 }
      );
    }
  }

  const staffId = params.id;

  await prisma.$transaction(async (tx) => {
    await tx.staffService.deleteMany({ where: { staffId } });
    if (serviceIds.length > 0) {
      await tx.staffService.createMany({
        data: serviceIds.map((serviceId) => ({ staffId, serviceId })),
      });
    }
  });

  const updated = await prisma.staffService.findMany({
    where: { staffId },
    include: { service: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ services: updated });
}
