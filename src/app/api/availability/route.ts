import { NextRequest, NextResponse } from "next/server";
import { computeAvailability } from "@/lib/availability";
import { AvailabilityQuerySchema } from "@/lib/schemas";
import { redis } from "@/lib/redis";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
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
  const cacheKey = `availability:${serviceId}:${date}:${staffId || "all"}`;

  // Try cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      logger.info("Availability cache hit", { serviceId, date, staffId });
      return NextResponse.json(JSON.parse(cached));
    }
  } catch {
    // Redis down — continue without cache
  }

  const slots = await computeAvailability({ serviceId, date, staffId });

  const response = { date, serviceId, slots };

  // Cache for 2 minutes
  try {
    await redis.setex(cacheKey, 120, JSON.stringify(response));
  } catch {
    // Redis down — continue without cache
  }

  logger.info("Availability computed", { serviceId, date, staffId, slotCount: slots.length });

  return NextResponse.json(response);
}
