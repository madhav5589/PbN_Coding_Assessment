/**
 * Client-side date/time formatters that display timestamps in the business's
 * own timezone (NEXT_PUBLIC_BUSINESS_TIMEZONE) rather than the browser's local
 * timezone. This ensures the provider and customer always see times that match
 * the physical location of the business regardless of where their browser runs.
 */

const BIZ_TZ = process.env.NEXT_PUBLIC_BUSINESS_TIMEZONE ?? "UTC";

/** Format a UTC timestamp as a short date string in the business timezone. */
export function formatDateTZ(utcStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BIZ_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(utcStr));
}

/** Format a UTC timestamp as a time string (e.g. "10:00 AM") in the business timezone. */
export function formatTimeTZ(utcStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: BIZ_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(utcStr));
}

/**
 * Extract the hour and minute of a Date object in the business timezone.
 * Used for positioning appointments on a calendar grid where row positions
 * are calculated from local wall-clock hours, not UTC hours.
 */
export function localHourMinute(date: Date): { hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BIZ_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return {
    hour: parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10),
    minute: parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10),
  };
}
