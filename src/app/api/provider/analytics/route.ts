import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [
    serviceStats,
    dayOfWeekStats,
    hourStats,
    statusCounts,
    recentBookings,
    totalAppointments,
    eventLogs,
  ] = await Promise.all([
    // Most frequently booked services
    prisma.appointment.groupBy({
      by: ["serviceId"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
    // Most popular days of week (from startAt)
    prisma.$queryRaw<{ day_of_week: number; count: bigint }[]>`
      SELECT EXTRACT(DOW FROM start_at AT TIME ZONE (SELECT timezone FROM businesses LIMIT 1))::int AS day_of_week,
             COUNT(*)::bigint AS count
      FROM appointments
      WHERE status != 'CANCELLED'
      GROUP BY day_of_week
      ORDER BY count DESC
    `,
    // Most popular hours
    prisma.$queryRaw<{ hour: number; count: bigint }[]>`
      SELECT EXTRACT(HOUR FROM start_at AT TIME ZONE (SELECT timezone FROM businesses LIMIT 1))::int AS hour,
             COUNT(*)::bigint AS count
      FROM appointments
      WHERE status != 'CANCELLED'
      GROUP BY hour
      ORDER BY count DESC
    `,
    // Status breakdown
    prisma.appointment.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    // Recent 30 bookings with creation timestamps for behavior metrics
    prisma.appointment.findMany({
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
    // Total count
    prisma.appointment.count(),
    // Event logs for booking behavior (time between events)
    prisma.eventLog.findMany({
      where: { type: { in: ["APPOINTMENT_BOOKED", "APPOINTMENT_CANCELLED", "APPOINTMENT_RESCHEDULED"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Enrich service stats with names
  const serviceIds = serviceStats.map((s) => s.serviceId);
  const services = await prisma.service.findMany({
    where: { id: { in: serviceIds } },
    select: { id: true, name: true },
  });
  const serviceMap = new Map(services.map((s) => [s.id, s.name]));

  const topServices = serviceStats.map((s) => ({
    serviceId: s.serviceId,
    serviceName: serviceMap.get(s.serviceId) || "Unknown",
    count: s._count.id,
  }));

  // Day names
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const popularDays = dayOfWeekStats.map((d) => ({
    day: dayNames[d.day_of_week],
    dayIndex: d.day_of_week,
    count: Number(d.count),
  }));

  // Popular hours
  const popularHours = hourStats.map((h) => ({
    hour: h.hour,
    label: `${h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour}:00 ${h.hour >= 12 ? "PM" : "AM"}`,
    count: Number(h.count),
  }));

  // Status breakdown
  const statusBreakdown = statusCounts.map((s) => ({
    status: s.status,
    count: s._count.id,
  }));

  // Customer behavior: avg lead time (time between booking creation and appointment date)
  const leadTimes = recentBookings.map((b) => {
    const leadMs = new Date(b.startAt).getTime() - new Date(b.createdAt).getTime();
    return leadMs / (1000 * 60 * 60); // hours
  });
  const avgLeadTimeHours = leadTimes.length > 0
    ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
    : 0;

  // Cancellation rate
  const bookedCount = statusBreakdown.find((s) => s.status === "BOOKED")?.count || 0;
  const cancelledCount = statusBreakdown.find((s) => s.status === "CANCELLED")?.count || 0;
  const completedCount = statusBreakdown.find((s) => s.status === "COMPLETED")?.count || 0;
  const noShowCount = statusBreakdown.find((s) => s.status === "NO_SHOW")?.count || 0;
  const cancellationRate = totalAppointments > 0
    ? ((cancelledCount / totalAppointments) * 100).toFixed(1)
    : "0.0";
  const noShowRate = totalAppointments > 0
    ? ((noShowCount / totalAppointments) * 100).toFixed(1)
    : "0.0";

  // Reschedule count
  const rescheduleCount = eventLogs.filter((e) => e.type === "APPOINTMENT_RESCHEDULED").length;

  return NextResponse.json({
    topServices,
    popularDays,
    popularHours,
    statusBreakdown,
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
}
