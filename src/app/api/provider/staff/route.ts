import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateStaffSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const staff = await prisma.staff.findMany({
    where: { businessId: tenant.businessId },
    orderBy: { name: "asc" },
    include: {
      staffServices: { include: { service: { select: { id: true, name: true } } } },
      _count: { select: { appointments: true } },
    },
  });

  return NextResponse.json({ staff });
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

  const parsed = CreateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const staff = await prisma.staff.create({
    data: { ...parsed.data, businessId: tenant.businessId },
  });

  return NextResponse.json({ staff }, { status: 201 });
}
