/**
 * Shared timezone utilities for the StyleHub booking platform.
 *
 * All timestamps in the database are stored as UTC. These functions convert
 * between UTC and the business's local wall-clock time for scheduling logic.
 *
 * Bugs fixed vs the original per-file copies:
 *
 *  1. localToUtc — month-boundary arithmetic: the original compared raw
 *     day-of-month integers (e.g. guessLocalD=1 vs day=31) which produced the
 *     wrong sign at month rollovers. Fixed by using full UTC-epoch millisecond
 *     arithmetic so JS Date handles month/year overflow natively.
 *
 *  2. localToUtc / utcToLocalMinutes — midnight "24:00" edge case: with
 *     hour12:false, some environments emit "24" for midnight instead of "00",
 *     causing utcToLocalMinutes to return 1440 (entire day blocked) and
 *     localToUtc to miscalculate the offset. Fixed by adding hourCycle:"h23"
 *     which mandates the 00-23 range from the ECMA-402 spec.
 *
 *  3. getDayOfWeek — brittle locale string mapping: the original formatted the
 *     weekday as a short string ("Mon", "Tue", …) then looked it up in a
 *     hard-coded English map that defaulted to 0 (Sunday) for any unrecognised
 *     value. Fixed by computing the weekday purely from Date.UTC arithmetic —
 *     no string map, no locale dependency.
 *
 *  4. dayBoundariesUtc — 23:59 vs next-day 00:00: using "23:59" as the day-end
 *     boundary left a 60-second window where appointments or time-offs were
 *     invisible to the availability engine. Fixed by returning localToUtc of
 *     the next calendar day at "00:00".
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeRange {
  /** Minutes from midnight (local time). */
  start: number;
  /** Minutes from midnight (local time), exclusive upper bound. */
  end: number;
}

// ─── Minute ↔ String helpers ─────────────────────────────────────────────────

/** Convert a "HH:MM" string to minutes from midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Convert minutes from midnight to a "HH:MM" string. */
export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ─── UTC ↔ Local conversion ───────────────────────────────────────────────────

/**
 * Convert a local date + time to a UTC Date for the given IANA timezone.
 *
 * Algorithm: treat the local wall-clock as a UTC instant (the "guess"), ask
 * Intl what local time that UTC instant corresponds to in the target timezone,
 * compute the difference between what we got and what we wanted, then subtract
 * that difference from the guess. One iteration is sufficient because timezone
 * offsets do not depend on the exact minute within an hour.
 *
 * @param dateStr  Local calendar date, e.g. "2026-03-10"
 * @param timeStr  Local wall-clock time, e.g. "09:00"
 * @param timezone IANA timezone identifier, e.g. "America/Chicago"
 */
export function localToUtc(dateStr: string, timeStr: string, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, mins] = timeStr.split(":").map(Number);

  // hourCycle "h23" guarantees the formatter returns hours in 00-23, never "24".
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  // Initial guess: pretend the local wall-clock time is a UTC instant.
  const guess = new Date(Date.UTC(year, month - 1, day, hours, mins, 0));

  // Ask Intl: what local date+time does this UTC instant map to in `timezone`?
  const parts = formatter.formatToParts(guess);
  const get = (type: string): number =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  // Reconstruct the formatter's answer as a UTC-epoch millisecond value.
  // Using Date.UTC for both sides means JS handles month/year rollover, so
  // comparing Jan=31 to Feb=1 works correctly — unlike the original code's
  // raw day-of-month integer comparison.
  const formattedAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    0,
  );

  // The target, also as a UTC-epoch value (arithmetic only, not a timezone).
  const targetAsUtcMs = Date.UTC(year, month - 1, day, hours, mins, 0);

  // The difference tells us how far the timezone's local time drifted from
  // what we wanted; subtract it from the guess to land on the correct UTC.
  return new Date(guess.getTime() - (formattedAsUtcMs - targetAsUtcMs));
}

/**
 * Convert a UTC Date to minutes-from-midnight in the given IANA timezone.
 *
 * hourCycle "h23" prevents the formatter from emitting "24" for midnight,
 * which would previously have returned 1440 instead of 0.
 */
export function utcToLocalMinutes(utcDate: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(utcDate);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return h * 60 + m;
}

// ─── Day-of-week ──────────────────────────────────────────────────────────────

/**
 * Return the day of week (0 = Sunday … 6 = Saturday) for a local calendar date.
 *
 * The dateStr is always a business-timezone calendar date such as "2026-03-10".
 * The day of week for a calendar date is unambiguous — March 10 2026 is a
 * Tuesday everywhere — so no timezone conversion is required. We pin the time
 * to noon UTC so that getUTCDay() is stable regardless of the server's system
 * timezone.
 *
 * This replaces the original locale-string map approach that silently defaulted
 * to Sunday (0) for any weekday string it didn't recognise.
 */
export function getDayOfWeek(dateStr: string): number {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay();
}

// ─── Day boundaries ───────────────────────────────────────────────────────────

/**
 * Return the UTC start and end of a local calendar day.
 *
 * `start` = midnight at the beginning of the day in the given timezone.
 * `end`   = midnight at the start of the *next* calendar day (exclusive).
 *
 * The original code used "23:59" as the day-end, which left a 60-second gap
 * where appointments or time-offs starting between 23:59 and 24:00 local time
 * were invisible to the availability engine. Using next-day "00:00" closes
 * that gap and makes the boundary semantically correct (half-open interval).
 */
export function dayBoundariesUtc(
  dateStr: string,
  timezone: string,
): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split("-").map(Number);

  // Date.UTC with day+1 handles month and year rollovers automatically.
  const nextDayStr = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);

  return {
    start: localToUtc(dateStr, "00:00", timezone),
    end: localToUtc(nextDayStr, "00:00", timezone),
  };
}

// ─── Range overlap ────────────────────────────────────────────────────────────

/**
 * Return true if two minute-from-midnight ranges overlap.
 * Both ranges use exclusive upper bounds (standard half-open interval).
 */
export function rangesOverlap(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}
