import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveTenant, tenantRequired } from "@/lib/tenant";
import { getDayOfWeek, utcToLocalMinutes } from "@/lib/timezone";

export async function GET(request: NextRequest) {
  try {
    const tenant = await resolveTenant(request);
    if (!tenant) return tenantRequired();

    const { businessId, business } = tenant;

    const [
      serviceStats,
      allNonCancelled,
      statusCounts,
      recentBookings,
      totalAppointments,
      allApptIds,
      rescheduleEvents,
    ] = await Promise.all([
      // Most frequently booked services — scoped to this business.
      prisma.appointment.groupBy({
        by: ["serviceId"],
        where: { businessId },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),
      // Lightweight list for JS-based timezone-aware grouping (avoids
      // $queryRaw AT TIME ZONE parameterization issues with PostgreSQL).
      prisma.appointment.findMany({
        where: { businessId, status: { not: "CANCELLED" } },
        select: { startAt: true },
      }),
      // Status breakdown for this business.
      prisma.appointment.groupBy({
        by: ["status"],
        where: { businessId },
        _count: { id: true },
      }),
      // Recent bookings for lead-time calculation — scoped to this business.
      prisma.appointment.findMany({
        where: { businessId },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          startAt: true,
          status: true,
          service: { select: { name: true } },
          staff: { select: { name: true } },
        },
      }),
      // Total count for this business.
      prisma.appointment.count({ where: { businessId } }),
      // All appointment IDs for this business (to scope reschedule count).
      prisma.appointment.findMany({
        where: { businessId },
        select: { id: true },
      }),
      // Reschedule event logs — filtered to this business's appointments in JS.
      prisma.eventLog.findMany({
        where: { type: "APPOINTMENT_RESCHEDULED" },
        select: { payload: true },
      }),
    ]);

    // JS-based day-of-week and hour grouping using the business's own timezone.
    // This avoids the PostgreSQL AT TIME ZONE parameterization issue where
    // Prisma's $queryRaw passes timezone as a positional parameter ($1) that
    // some PG versions reject for AT TIME ZONE expressions.
    const localDateFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: business.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    const dowCounts = new Map<number, number>();
    const hourCounts = new Map<number, number>();

    for (const appt of allNonCancelled) {
      const d = new Date(appt.startAt);

      // Day of week in business timezone
      const localDateStr = localDateFmt.format(d);
      const dow = getDayOfWeek(localDateStr);
      dowCounts.set(dow, (dowCounts.get(dow) ?? 0) + 1);

      // Hour in business timezone
      const hour = Math.floor(utcToLocalMinutes(d, business.timezone) / 60);
      hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);
    }

    const dayOfWeekStats = Array.from(dowCounts.entries())
      .map(([day_of_week, count]) => ({ day_of_week, count }))
      .sort((a, b) => b.count - a.count);

    const hourStats = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count);

    // Reschedule count: EventLog has no businessId, so scope via appointmentId.
    const apptIdSet = new Set(allApptIds.map((a) => a.id));
    const rescheduleCount = rescheduleEvents.filter((e) => {
      const p = e.payload as { appointmentId?: string };
      return p.appointmentId != null && apptIdSet.has(p.appointmentId);
    }).length;

    // Enrich service stats with names.
    const serviceIds = serviceStats.map((s) => s.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, businessId },
      select: { id: true, name: true },
    });
    const serviceMap = new Map(services.map((s) => [s.id, s.name]));

    const topServices = serviceStats.map((s) => ({
      serviceId: s.serviceId,
      serviceName: serviceMap.get(s.serviceId) ?? "Unknown",
      count: s._count.id,
    }));

    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const popularDays = dayOfWeekStats.map((d) => ({
      day: dayNames[d.day_of_week],
      dayIndex: d.day_of_week,
      count: d.count,
    }));

    const popularHours = hourStats.map((h) => ({
      hour: h.hour,
      label: `${h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour}:00 ${h.hour >= 12 ? "PM" : "AM"}`,
      count: h.count,
    }));

    const statusBreakdown = statusCounts.map((s) => ({
      status: s.status,
      count: s._count.id,
    }));

    // Lead time: average hours between booking creation and appointment start.
    const leadTimes = recentBookings.map((b) => {
      const leadMs = new Date(b.startAt).getTime() - new Date(b.createdAt).getTime();
      return leadMs / (1000 * 60 * 60);
    });
    const avgLeadTimeHours =
      leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0;

    const bookedCount = statusBreakdown.find((s) => s.status === "BOOKED")?.count ?? 0;
    const cancelledCount = statusBreakdown.find((s) => s.status === "CANCELLED")?.count ?? 0;
    const completedCount = statusBreakdown.find((s) => s.status === "COMPLETED")?.count ?? 0;
    const noShowCount = statusBreakdown.find((s) => s.status === "NO_SHOW")?.count ?? 0;

    const cancellationRate =
      totalAppointments > 0 ? ((cancelledCount / totalAppointments) * 100).toFixed(1) : "0.0";
    const noShowRate =
      totalAppointments > 0 ? ((noShowCount / totalAppointments) * 100).toFixed(1) : "0.0";

    return NextResponse.json({
      topServices,
      popularDays,
      popularHours,
      statusBreakdown,
      timezone: business.timezone,
      behavior: {
        totalAppointments,
        bookedCount,
        completedCount,
        cancelledCount,
        noShowCount,
        cancellationRate: `${cancellationRate}%`,
        noShowRate: `${noShowRate}%`,
        rescheduleCount,
        avgLeadTimeHours: Math.round(avgLeadTimeHours),
      },
      recentBookings: recentBookings.slice(0, 10),
    });
  } catch (err) {
    console.error("[analytics] error:", err);
    return NextResponse.json({ error: "ANALYTICS_ERROR" }, { status: 500 });
  }
}
