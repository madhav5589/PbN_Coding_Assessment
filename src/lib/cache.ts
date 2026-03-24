/**
 * Availability cache helpers shared across all routes that create or modify
 * scheduling data (bookings, cancellations, reschedules, time-offs, blackouts,
 * working hours).
 *
 * KEY STRUCTURE:
 *   availability:{businessId}:{serviceId}:{date}:{staffId|"all"}
 *
 * INVALIDATION STRATEGY:
 *   We use SCAN with a cursor (non-blocking) instead of KEYS (O(N) blocking).
 *   The pattern always includes {businessId} so one tenant's writes never
 *   evict another tenant's cache entries.
 *
 *   - Date-specific invalidation: used when we know the exact affected date
 *     (booking, cancellation, reschedule). Pattern: businessId:*:date:*
 *
 *   - Business-wide invalidation: used when the affected dates are not known
 *     upfront (time-off changes, blackout changes, working-hours updates).
 *     Pattern: businessId:*
 *     Still non-blocking via SCAN; bounded to one tenant's key namespace.
 */

import { redis } from "@/lib/redis";

/**
 * Delete all cached availability slots for a specific business + calendar date.
 * Call this after a booking, cancellation, or reschedule.
 */
export async function invalidateAvailabilityForDate(
  businessId: string,
  date: string,
): Promise<void> {
  await scanAndDelete(`availability:${businessId}:*:${date}:*`);
}

/**
 * Delete all cached availability slots for an entire business.
 * Call this when the affected date range is not known (time-off, blackout,
 * working-hours changes).
 */
export async function invalidateAvailabilityForBusiness(
  businessId: string,
): Promise<void> {
  await scanAndDelete(`availability:${businessId}:*`);
}

// ─── Internal ────────────────────────────────────────────────────────────────

async function scanAndDelete(pattern: string): Promise<void> {
  try {
    let cursor = "0";
    const toDelete: string[] = [];

    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
      cursor = next;
      toDelete.push(...keys);
    } while (cursor !== "0");

    if (toDelete.length > 0) await redis.del(...toDelete);
  } catch {
    // Redis is down — the 2-minute TTL handles natural expiry.
  }
}
