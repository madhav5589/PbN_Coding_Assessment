import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateServiceSchema } from "@/lib/schemas";

export async function GET() {
  const services = await prisma.service.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { staffServices: true, appointments: true } },
    },
  });
  return NextResponse.json({ services });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findFirst();
  if (!business) {
    return NextResponse.json({ error: "No business configured" }, { status: 500 });
  }

  const service = await prisma.service.create({
    data: { ...parsed.data, businessId: business.id },
  });

  return NextResponse.json({ service }, { status: 201 });
}
