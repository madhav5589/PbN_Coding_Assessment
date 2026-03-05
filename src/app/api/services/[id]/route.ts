import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const service = await prisma.service.findUnique({
    where: { id: params.id },
    include: {
      staffServices: {
        include: { staff: { select: { id: true, name: true, isActive: true } } },
      },
    },
  });

  if (!service) {
    return NextResponse.json({ error: "Service not found" }, { status: 404 });
  }

  return NextResponse.json({ service });
}
