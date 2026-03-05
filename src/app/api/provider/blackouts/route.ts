import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CreateBlackoutSchema } from "@/lib/schemas";

export async function GET() {
  const blackouts = await prisma.blackout.findMany({
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json({ blackouts });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = CreateBlackoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "INVALID_INPUT", details: parsed.error.flatten() }, { status: 400 });
  }

  const business = await prisma.business.findFirst();
  if (!business) {
    return NextResponse.json({ error: "No business configured" }, { status: 500 });
  }

  const blackout = await prisma.blackout.create({
    data: {
      businessId: business.id,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      reason: parsed.data.reason || "",
    },
  });

  return NextResponse.json({ blackout }, { status: 201 });
}
