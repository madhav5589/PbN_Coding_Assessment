import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateWorkingHoursSchema } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const hours = await prisma.workingHours.findMany({
    where: { staffId: params.id },
    orderBy: { dayOfWeek: "asc" },
  });
  return NextResponse.json({ hours });
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

  const parsed = UpdateWorkingHoursSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const staffId = params.id;

  await prisma.$transaction(async (tx) => {
    await tx.workingHours.deleteMany({ where: { staffId } });
    await tx.workingHours.createMany({
      data: parsed.data.hours.map((h) => ({
        staffId,
        dayOfWeek: h.dayOfWeek,
        startTimeLocal: h.startTimeLocal,
        endTimeLocal: h.endTimeLocal,
        isClosed: h.isClosed,
      })),
    });
  });

  const hours = await prisma.workingHours.findMany({
    where: { staffId },
    orderBy: { dayOfWeek: "asc" },
  });

  return NextResponse.json({ hours });
}
