import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UpdateServiceSchema } from "@/lib/schemas";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

async function resolveService(id: string, businessId: string) {
  return prisma.service.findFirst({ where: { id, businessId } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const service = await prisma.service.findFirst({
    where: { id: params.id, businessId: tenant.businessId },
    include: { staffServices: { include: { staff: true } } },
  });
  if (!service) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ service });
}

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

  const parsed = UpdateServiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // Verify ownership before updating.
  const existing = await resolveService(params.id, tenant.businessId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = await prisma.service.update({
    where: { id: params.id },
    data: parsed.data,
  });

  return NextResponse.json({ service });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  // Verify ownership before soft-deleting.
  const existing = await resolveService(params.id, tenant.businessId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const service = await prisma.service.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  return NextResponse.json({ service });
}
