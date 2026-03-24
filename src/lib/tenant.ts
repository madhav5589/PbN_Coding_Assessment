/**
 * Tenant resolution for the StyleHub multi-tenant booking platform.
 *
 * Every API request must identify which business it belongs to. We use the
 * `x-business-id` HTTP header as the tenant discriminator. This is simple,
 * explicit, and works cleanly with Next.js App Router route handlers without
 * requiring URL restructuring.
 *
 * In a production system this header value would be derived from a signed JWT
 * or session cookie rather than accepted directly from the client. For now the
 * header is validated as a UUID and then confirmed against the database before
 * any scoped query is run, so an attacker cannot enumerate data by guessing IDs
 * — they would need the exact UUID of an existing business.
 *
 * Usage in a route handler:
 *
 *   export async function GET(request: NextRequest) {
 *     const tenant = await resolveTenant(request);
 *     if (!tenant) return tenantRequired();
 *     // tenant.businessId and tenant.business are now safe to use
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Business } from "@prisma/client";

// ─── Constants ────────────────────────────────────────────────────────────────

/** The HTTP header that carries the business identifier for every API request. */
export const BUSINESS_ID_HEADER = "x-business-id" as const;

/** UUID v4 pattern — validated before touching the database. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The resolved tenant context: a confirmed business ID and its full DB record.
 * Routes receive this after a successful `resolveTenant()` call and can use
 * `tenant.businessId` directly in every Prisma `where` clause.
 */
export interface TenantContext {
  businessId: string;
  business: Business;
}

// ─── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve the tenant context for an incoming API request.
 *
 * Steps:
 *  1. Read the `x-business-id` header.
 *  2. Validate it matches the UUID format — rejects obviously bad input before
 *     hitting the database.
 *  3. Look up the business in the database to confirm it actually exists.
 *  4. Return the context, or null if any step fails.
 *
 * Returning null (rather than throwing) lets each route decide its own error
 * shape; in practice every route should immediately call `tenantRequired()`.
 */
export async function resolveTenant(
  request: NextRequest,
): Promise<TenantContext | null> {
  const raw = request.headers.get(BUSINESS_ID_HEADER);
  if (!raw || !UUID_RE.test(raw)) return null;

  const business = await prisma.business.findUnique({ where: { id: raw } });
  if (!business) return null;

  return { businessId: business.id, business };
}

// ─── Standard error responses ─────────────────────────────────────────────────

/**
 * Return the standard 400 response when a request arrives without a valid
 * tenant header. Call this immediately after `resolveTenant()` returns null.
 *
 * Using a shared helper keeps the error shape consistent across all routes
 * and gives us one place to change the message or status code if needed.
 */
export function tenantRequired(): NextResponse {
  return NextResponse.json(
    {
      error: "TENANT_REQUIRED",
      message: `Missing or invalid '${BUSINESS_ID_HEADER}' header`,
    },
    { status: 400 },
  );
}
