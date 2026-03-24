import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  // findFirst with businessId prevents cross-tenant reads — a provider for
  // Business A cannot access Business B's appointments by guessing IDs.
  const appointment = await prisma.appointment.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
    include: {
      service: true,
      staff: true,
    },
  });
  if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ appointment });
}
