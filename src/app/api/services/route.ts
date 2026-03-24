import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const services = await prisma.service.findMany({
    where: { businessId: tenant.businessId, isActive: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ services });
}
