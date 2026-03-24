import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateNotesSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = UpdateNotesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify the appointment belongs to this business before updating notes.
  const existing = await prisma.appointment.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const appointment = await prisma.appointment.update({
    where: { id: params.id },
    data: { notes: parsed.data.notes },
  });

  return NextResponse.json({ appointment });
}
