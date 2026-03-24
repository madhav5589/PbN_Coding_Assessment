import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";
import type { Business } from "@prisma/client";
import type { SlotInfo } from "@/lib/schemas";
import {
  utcToLocalMinutes,
  getDayOfWeek,
  timeToMinutes,
  minutesToTime,
  rangesOverlap,
  dayBoundariesUtc,
  type TimeRange,
} from "@/lib/timezone";

// Re-export so callers that previously imported TimeRange from here keep working.
export type { TimeRange };

export interface AvailabilityOptions {
  /**
   * Full Business record from the tenant layer. Passing it avoids a second
   * `findFirst()` round-trip inside this function — the tenant resolver already
   * loaded it.
   */
  business: Business;
  serviceId: string;
  /** "YYYY-MM-DD" expressed in the business's local timezone. */
  date: string;
  /** Optional: if set, only generate slots for this staff member. */
  staffId?: string;
}

export async function computeAvailability(
  opts: AvailabilityOptions
): Promise<SlotInfo[]> {
  const { business, serviceId, date, staffId } = opts;
  const { id: businessId, timezone, slotIntervalMin: slotInterval } = business;

  // ── 1. Service ─────────────────────────────────────────────────────────────
  // Scoped to `businessId` so a request for Service X can never surface data
  // from another tenant even if the caller passes a foreign serviceId.
  const service = await prisma.service.findFirst({
    where: { id: serviceId, businessId, isActive: true },
  });
  if (!service) return [];

  const totalDuration =
    service.bufferBeforeMin + service.durationMin + service.bufferAfterMin;

  // ── 2. Day boundaries ───────────────────────────────────────────────────────
  // Phase 1 fixed: uses next-day midnight (00:00) not "23:59", closing the
  // 60-second gap that made late-day events invisible to the engine.
  const { start: dayStartUtc, end: dayEndUtc } = dayBoundariesUtc(date, timezone);

  // ── 3. Business blackouts ───────────────────────────────────────────────────
  // Scoped to `businessId` — a blackout for Business B must not affect Business A.
  const blackouts = await prisma.blackout.findMany({
    where: {
      businessId,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
    },
  });

  // Convert to local-minute ranges once; reused across every staff iteration.
  const blackoutRanges: TimeRange[] = blackouts.map((b) => ({
    start: utcToLocalMinutes(b.startAt, timezone),
    end: utcToLocalMinutes(b.endAt, timezone),
  }));

  // Short-circuit: if any single blackout spans the full local day, done.
  if (blackoutRanges.some((r) => r.start <= 0 && r.end >= 23 * 60 + 59)) {
    return [];
  }

  // ── 4. Day of week ──────────────────────────────────────────────────────────
  // Phase 1 fixed: pure Date.UTC arithmetic — no locale string map that could
  // silently default to Sunday on non-English systems.
  const dayOfWeek = getDayOfWeek(date);

  // ── 5. Eligible staff ───────────────────────────────────────────────────────
  // The nested `staff: { businessId, isActive: true }` filter ensures the
  // staff member actually belongs to this tenant. Without it a caller could
  // pass a staffId from a different business and get their schedule.
  const staffServiceLinks = await prisma.staffService.findMany({
    where: {
      serviceId,
      ...(staffId ? { staffId } : {}),
      staff: { businessId, isActive: true },
    },
    include: {
      staff: {
        include: {
          workingHours: { where: { dayOfWeek } },
          timeOffs: {
            where: {
              startAt: { lt: dayEndUtc },
              endAt: { gt: dayStartUtc },
            },
          },
        },
      },
    },
  });

  if (staffServiceLinks.length === 0) return [];

  // ── 6. Batch appointment load (eliminates N+1) ──────────────────────────────
  // Previously: one `appointment.findMany` per staff member inside the loop.
  // With 4 eligible staff that was 4 sequential round-trips; proportionally
  // worse at scale. One query with `staffId: { in: [...] }` replaces all of
  // them and uses the composite index (staffId, startAt, endAt).
  const eligibleStaffIds = staffServiceLinks.map((l) => l.staff.id);

  const allAppointments = await prisma.appointment.findMany({
    where: {
      staffId: { in: eligibleStaffIds },
      status: AppointmentStatus.BOOKED,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
    },
    select: { staffId: true, startAt: true, endAt: true },
  });

  // Group by staffId → O(1) lookup inside the slot-generation loop below.
  const apptsByStaff = new Map<string, { startAt: Date; endAt: Date }[]>();
  for (const appt of allAppointments) {
    const bucket = apptsByStaff.get(appt.staffId) ?? [];
    bucket.push({ startAt: appt.startAt, endAt: appt.endAt });
    apptsByStaff.set(appt.staffId, bucket);
  }

  // ── 7. Slot generation ──────────────────────────────────────────────────────
  const slots: SlotInfo[] = [];

  for (const link of staffServiceLinks) {
    const staff = link.staff;

    const wh = staff.workingHours[0];
    if (!wh || wh.isClosed) continue;

    const workStart = timeToMinutes(wh.startTimeLocal);
    const workEnd = timeToMinutes(wh.endTimeLocal);

    // Blocked ranges: personal time-offs plus business-wide blackouts.
    const blocked: TimeRange[] = [
      ...staff.timeOffs.map((to) => ({
        start: utcToLocalMinutes(to.startAt, timezone),
        end: utcToLocalMinutes(to.endAt, timezone),
      })),
      ...blackoutRanges,
    ];

    // Booked ranges for this staff from the pre-fetched batch — no extra query.
    const booked: TimeRange[] = (apptsByStaff.get(staff.id) ?? []).map((a) => ({
      start: utcToLocalMinutes(a.startAt, timezone),
      end: utcToLocalMinutes(a.endAt, timezone),
    }));

    for (
      let slotStart = workStart;
      slotStart + totalDuration <= workEnd;
      slotStart += slotInterval
    ) {
      const sr: TimeRange = { start: slotStart, end: slotStart + totalDuration };
      if (blocked.some((r) => rangesOverlap(sr, r))) continue;
      if (booked.some((r) => rangesOverlap(sr, r))) continue;

      slots.push({
        startTime: minutesToTime(slotStart),
        // endTime shows the visible service window, not the full buffer span.
        endTime: minutesToTime(slotStart + service.durationMin),
        staffId: staff.id,
        staffName: staff.name,
      });
    }
  }

  return slots.sort((a, b) => {
    const t = a.startTime.localeCompare(b.startTime);
    return t !== 0 ? t : a.staffName.localeCompare(b.staffName);
  });
}
