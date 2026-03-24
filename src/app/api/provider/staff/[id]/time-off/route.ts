import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateTimeOffSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { invalidateAvailabilityForBusiness } from "@/lib/cache";

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

  const timeOffs = await prisma.timeOff.findMany({
    where: { staffId: params.id },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ timeOffs });
}

export async function POST(
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

  const parsed = CreateTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify the staff member belongs to this business.
  const staff = await prisma.staff.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const timeOff = await prisma.timeOff.create({
    data: {
      staffId: params.id,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      reason: parsed.data.reason ?? "",
    },
  });

  // Time-off spans an unknown set of dates — invalidate the full business cache.
  await invalidateAvailabilityForBusiness(tenant.businessId);

  return NextResponse.json({ timeOff }, { status: 201 });
}
