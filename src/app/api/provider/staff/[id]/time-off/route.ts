import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateTimeOffSchema } from "@/lib/schemas";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const timeOffs = await prisma.timeOff.findMany({
    where: { staffId: params.id },
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json({ timeOffs });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateTimeOffSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const timeOff = await prisma.timeOff.create({
    data: {
      staffId: params.id,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      reason: parsed.data.reason || "",
    },
  });

  return NextResponse.json({ timeOff }, { status: 201 });
}
