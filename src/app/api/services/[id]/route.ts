import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const service = await prisma.service.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
    include: {
      staffServices: {
        include: { staff: { select: { id: true, name: true, isActive: true } } },
      },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  return NextResponse.json({ service });
}
