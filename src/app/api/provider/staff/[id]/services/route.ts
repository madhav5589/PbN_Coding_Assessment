import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateStaffServicesSchema } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staffServices = await prisma.staffService.findMany({
    where: { staffId: params.id },
    include: { service: { select: { id: true, name: true, durationMin: true, isActive: true } } },
  });
  return NextResponse.json({ services: staffServices });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateStaffServicesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const staffId = params.id;

  // Transaction: delete old, create new
  await prisma.$transaction(async (tx) => {
    await tx.staffService.deleteMany({ where: { staffId } });
    await tx.staffService.createMany({
      data: parsed.data.serviceIds.map((serviceId) => ({
        staffId,
        serviceId,
      })),
    });
  });

  const updated = await prisma.staffService.findMany({
    where: { staffId },
    include: { service: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ services: updated });
}
