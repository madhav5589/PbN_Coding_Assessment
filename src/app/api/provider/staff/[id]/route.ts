import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateStaffSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
    include: {
      staffServices: { include: { service: true } },
      workingHours: { orderBy: { dayOfWeek: "asc" } },
      timeOffs: { orderBy: { startAt: "asc" } },
    },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ staff });
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

  const parsed = UpdateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify ownership before updating.
  const existing = await prisma.staff.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const staff = await prisma.staff.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ staff });
}
