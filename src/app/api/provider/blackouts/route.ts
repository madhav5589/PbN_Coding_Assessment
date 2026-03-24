import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateBlackoutSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { invalidateAvailabilityForBusiness } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const blackouts = await prisma.blackout.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ blackouts });
}

export async function POST(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateBlackoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const blackout = await prisma.blackout.create({
    data: {
      businessId: tenant.businessId,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      reason: parsed.data.reason ?? "",
    },
  });

  // Blackout spans an unknown set of dates — invalidate all cached slots.
  await invalidateAvailabilityForBusiness(tenant.businessId);

  return NextResponse.json({ blackout }, { status: 201 });
}
