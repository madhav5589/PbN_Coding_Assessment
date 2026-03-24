import { NextRequest, NextResponse } from "next/server";
import { computeAvailability } from "@/lib/availability";
import { AvailabilityQuerySchema } from "@/lib/schemas";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { resolveTenant, tenantRequired } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  // Tenant resolution — every availability request is now scoped to a business.
  const tenant = await resolveTenant(request);
  if (!tenant) return tenantRequired();

  const { business } = tenant;

  const searchParams = request.nextUrl.searchParams;
  const parsed = AvailabilityQuerySchema.safeParse({
    serviceId: searchParams.get("serviceId"),
    date: searchParams.get("date"),
    staffId: searchParams.get("staffId") || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { serviceId, date, staffId } = parsed.data;

  // Cache key now includes businessId.
  // Previously: "availability:{serviceId}:{date}:{staffId|all}"
  // Problem:    identical for all businesses — Business B's cached slots could
  //             be served to Business A, and Business A's booking would
  //             invalidate Business B's cache.
  // Fixed:      "availability:{businessId}:{serviceId}:{date}:{staffId|all}"
  const cacheKey = `availability:${business.id}:${serviceId}:${date}:${staffId ?? "all"}`;

  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info("Availability cache hit", {
        businessId: business.id,
        serviceId,
        date,
        staffId,
      });
      return NextResponse.json(JSON.parse(cached));
    }
  } catch {
    // Redis down — continue without cache
  }

  // Pass the already-loaded business object to avoid a second findFirst() inside
  // the availability engine. The tenant resolver's DB round-trip is reused.
  const slots = await computeAvailability({ business, serviceId, date, staffId });

  const response = { date, serviceId, slots };

  try {
    await redis.setex(cacheKey, 120, JSON.stringify(response));
  } catch {
    // Redis down — continue without cache
  }

  logger.info("Availability computed", {
    businessId: business.id,
    serviceId,
    date,
    staffId,
    slotCount: slots.length,
  });

  return NextResponse.json(response);
}
