import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateStaffSchema } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const staff = await prisma.staff.findUnique({
    where: { id: params.id },
    include: {
      staffServices: { include: { service: true } },
      workingHours: { orderBy: { dayOfWeek: "asc" } },
      timeOffs: { orderBy: { startAt: "asc" } },
    },
  });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ staff });
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

  const parsed = UpdateStaffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const staff = await prisma.staff.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ staff });
}
