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

  // Verify the time-off record belongs to a staff member of this business.
  // Without this check, a provider for Business A could delete Business B's
  // time-off records by guessing their IDs.
  const timeOff = await prisma.timeOff.findFirst({
    where: {
      id: params.id,
      staff: { businessId: tenant.businessId },
    },
  });
  if (!timeOff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.timeOff.delete({ where: { id: params.id } });

  // Deleting time-off restores slots across an unknown set of dates.
  await invalidateAvailabilityForBusiness(tenant.businessId);

  return NextResponse.json({ success: true });
}
