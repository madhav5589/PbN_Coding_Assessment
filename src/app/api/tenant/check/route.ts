import { NextRequest, NextResponse } from "next/server";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

/**
 * Lightweight tenant-validity check used by TenantGuard on the client side.
 * Returns 200 { ok: true } when the business ID resolves to a known business,
 * or 400 TENANT_REQUIRED when it does not. No database writes, no heavy joins.
 */
export async function GET(request: NextRequest) {
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();
  return NextResponse.json({ ok: true });
}
