import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateStaffSchema } from "@/lib/schemas";

export async function GET() {
  const staff = await prisma.staff.findMany({
    orderBy: { name: "asc" },
    include: {
      staffServices: { include: { service: { select: { id: true, name: true } } } },
      _count: { select: { appointments: true } },
    },
  });
  return NextResponse.json({ staff });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findFirst();
  if (!business) {
    return NextResponse.json({ error: "No business configured" }, { status: 500 });
  }

  const staff = await prisma.staff.create({
    data: { ...parsed.data, businessId: business.id },
  });

  return NextResponse.json({ staff }, { status: 201 });
}
