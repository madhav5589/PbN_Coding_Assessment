import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateServiceSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const services = await prisma.service.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { staffServices: true, appointments: true } },
    },
  });

  return NextResponse.json({ services });
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

  const parsed = CreateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const service = await prisma.service.create({
    data: { ...parsed.data, businessId: tenant.businessId },
  });

  return NextResponse.json({ service }, { status: 201 });
}
