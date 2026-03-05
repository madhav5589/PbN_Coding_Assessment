import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";
import type { SlotInfo } from "@/lib/schemas";

interface TimeRange {
  start: number; // minutes from midnight in local time
  end: number;
}

/**
 * Convert "HH:MM" string to minutes from midnight
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Convert minutes from midnight to "HH:MM"
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Convert a local date + time to UTC Date for the given timezone
 */
function localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  // dateStr: "2026-03-10", timeStr: "09:00"
  const localStr = `${dateStr}T${timeStr}:00`;
  // Create a formatter that can tell us the UTC timestamp for a local time
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  // Parse the local date components
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, mins] = timeStr.split(":").map(Number);

  // Build a Date assuming UTC, then adjust
  // We need to find what UTC time corresponds to the given local time
  // Strategy: guess UTC = local, then adjust based on offset
  const guess = new Date(Date.UTC(year, month - 1, day, hours, mins, 0));
  const parts = formatter.formatToParts(guess);
  const getPart = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value || "0");

  const guessLocalH = getPart("hour");
  const guessLocalM = getPart("minute");
  const guessLocalD = getPart("day");

  // Offset in minutes: how much to adjust
  let offsetMinutes = (guessLocalH - hours) * 60 + (guessLocalM - mins);
  // Handle day boundary
  if (guessLocalD !== day) {
    offsetMinutes += guessLocalD > day ? 24 * 60 : -24 * 60;
  }

  return new Date(guess.getTime() - offsetMinutes * 60 * 1000);
}

/**
 * Convert a UTC Date to local time minutes-from-midnight in the given timezone
 */
function utcToLocalMinutes(utcDate: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0");
  return h * 60 + m;
}

/**
 * Check if two time ranges overlap
 */
function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Get the day of week (0=Sun..6=Sat) for a date string in the given timezone
 */
function getDayOfWeek(dateStr: string, timezone: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekday = formatter.format(d);
  const map: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return map[weekday] ?? 0;
}

export interface AvailabilityOptions {
  serviceId: string;
  date: string; // "YYYY-MM-DD"
  staffId?: string;
}

export async function computeAvailability(
  opts: AvailabilityOptions
): Promise<SlotInfo[]> {
  const { serviceId, date, staffId } = opts;

  // 1. Load business
  const business = await prisma.business.findFirst();
  if (!business) return [];

  const timezone = business.timezone;
  const slotInterval = business.slotIntervalMin;

  // 2. Load service
  const service = await prisma.service.findUnique({
    where: { id: serviceId },
  });
  if (!service || !service.isActive) return [];

  const totalDuration = service.bufferBeforeMin + service.durationMin + service.bufferAfterMin;

  // 3. Check for business blackout on this date
  const dayStartUtc = localToUtc(date, "00:00", timezone);
  const dayEndUtc = localToUtc(date, "23:59", timezone);

  const blackouts = await prisma.blackout.findMany({
    where: {
      businessId: business.id,
      startAt: { lt: dayEndUtc },
      endAt: { gt: dayStartUtc },
    },
  });

  // If blackout covers entire day, no slots
  for (const b of blackouts) {
    const bStart = utcToLocalMinutes(b.startAt, timezone);
    const bEnd = utcToLocalMinutes(b.endAt, timezone);
    if (bStart <= 0 && bEnd >= 23 * 60 + 59) return [];
  }

  // 4. Get day of week
  const dayOfWeek = getDayOfWeek(date, timezone);

  // 5. Load eligible staff (who can do this service)
  const staffServiceLinks = await prisma.staffService.findMany({
    where: {
      serviceId,
      ...(staffId ? { staffId } : {}),
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

  const slots: SlotInfo[] = [];

  for (const link of staffServiceLinks) {
    const staff = link.staff;
    if (!staff.isActive) continue;

    // Check working hours for this day
    const wh = staff.workingHours[0];
    if (!wh || wh.isClosed) continue;

    const workStart = timeToMinutes(wh.startTimeLocal);
    const workEnd = timeToMinutes(wh.endTimeLocal);

    // Build blocked ranges from time-offs (in local minutes)
    const blockedRanges: TimeRange[] = [];

    for (const to of staff.timeOffs) {
      const toStartMin = utcToLocalMinutes(to.startAt, timezone);
      const toEndMin = utcToLocalMinutes(to.endAt, timezone);
      blockedRanges.push({ start: toStartMin, end: toEndMin });
    }

    // Add blackout ranges
    for (const b of blackouts) {
      const bStart = utcToLocalMinutes(b.startAt, timezone);
      const bEnd = utcToLocalMinutes(b.endAt, timezone);
      blockedRanges.push({ start: bStart, end: bEnd });
    }

    // Load existing BOOKED appointments for this staff on this day
    const appointments = await prisma.appointment.findMany({
      where: {
        staffId: staff.id,
        status: AppointmentStatus.BOOKED,
        startAt: { lt: dayEndUtc },
        endAt: { gt: dayStartUtc },
      },
    });

    const appointmentRanges: TimeRange[] = appointments.map((a) => ({
      start: utcToLocalMinutes(a.startAt, timezone),
      end: utcToLocalMinutes(a.endAt, timezone),
    }));

    // Generate candidate slots
    for (let slotStart = workStart; slotStart + totalDuration <= workEnd; slotStart += slotInterval) {
      const slotEnd = slotStart + totalDuration;
      const slotRange: TimeRange = { start: slotStart, end: slotEnd };

      // Check against time-off/blackout
      const blockedByTimeOff = blockedRanges.some((r) => rangesOverlap(slotRange, r));
      if (blockedByTimeOff) continue;

      // Check against existing appointments
      const conflictsWithAppt = appointmentRanges.some((r) => rangesOverlap(slotRange, r));
      if (conflictsWithAppt) continue;

      slots.push({
        startTime: minutesToTime(slotStart),
        endTime: minutesToTime(slotStart + service.durationMin),
        staffId: staff.id,
        staffName: staff.name,
      });
    }
  }

  // Sort by start time, then by staff name
  slots.sort((a, b) => {
    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;
    return a.staffName.localeCompare(b.staffName);
  });

  return slots;
}
