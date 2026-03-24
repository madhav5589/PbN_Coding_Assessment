import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { invalidateAvailabilityForBusiness } from "@/lib/cache";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  // Verify ownership before deleting — prevents cross-tenant deletion.
  const blackout = await prisma.blackout.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!blackout) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.blackout.delete({ where: { id: params.id } });

  // Deleting a blackout restores slots across an unknown set of dates.
  await invalidateAvailabilityForBusiness(tenant.businessId);

  return NextResponse.json({ success: true });
}
