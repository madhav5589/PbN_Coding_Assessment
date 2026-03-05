"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wrench, Users, Clock, CalendarClock, CalendarDays, ArrowRight,
  TrendingUp, BarChart3, CalendarCheck, UserX, Repeat2, Timer, Activity,
} from "lucide-react";
import {
  Card, PageHeader, StatusPill, FadeIn, StaggerContainer, StaggerItem,
} from "@/components/ui";

interface Analytics {
  topServices: { serviceId: string; serviceName: string; count: number }[];
  popularDays: { day: string; dayIndex: number; count: number }[];
  popularHours: { hour: number; label: string; count: number }[];
  statusBreakdown: { status: string; count: number }[];
  behavior: {
    totalAppointments: number;
    bookedCount: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
    cancellationRate: string;
    noShowRate: string;
    rescheduleCount: number;
    avgLeadTimeHours: number;
  };
  recentBookings: {
    id: string;
    createdAt: string;
    startAt: string;
    status: string;
    service: { name: string };
    staff: { name: string };
  }[];
}

const quickLinks = [
  { href: "/provider/services", icon: Wrench, title: "Services", desc: "Manage offerings" },
  { href: "/provider/staff", icon: Users, title: "Staff", desc: "Team & skills" },
  { href: "/provider/schedule", icon: Clock, title: "Schedule", desc: "Hours & time off" },
  { href: "/provider/appointments", icon: CalendarClock, title: "Appointments", desc: "Manage bookings" },
  { href: "/provider/calendar", icon: CalendarDays, title: "Calendar", desc: "Visual overview" },
];

function BarCell({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 flex-1">
      <div className="flex-1 h-6 rounded-[var(--radius-md)] bg-[rgb(var(--color-bg-tertiary))] overflow-hidden">
        <div
          className="h-full rounded-[var(--radius-md)] bg-[var(--color-accent)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-[var(--color-text-secondary)] tabular-nums w-8 text-right">
        {value}
      </span>
    </div>
  );
}

export default function ProviderDashboard() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/provider/analytics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-8">
          <div className="skeleton h-8 w-48 mb-2" />
          <div className="skeleton h-4 w-72" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-[var(--radius-xl)]" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-[var(--radius-xl)]" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <FadeIn>
        <PageHeader title="Dashboard" description="Manage your salon operations" />
        <p className="text-[var(--color-text-secondary)]">Unable to load analytics.</p>
      </FadeIn>
    );
  }

  const b = data.behavior;
  const maxServiceCount = Math.max(...data.topServices.map((s) => s.count), 1);
  const maxDayCount = Math.max(...data.popularDays.map((d) => d.count), 1);
  const maxHourCount = Math.max(...data.popularHours.map((h) => h.count), 1);

  return (
    <FadeIn>
      <PageHeader title="Dashboard" description="Insights and salon operations at a glance" />

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <StaggerItem>
          <Card className="text-center">
            <CalendarCheck className="w-5 h-5 mx-auto mb-2 text-[var(--color-accent-text)]" />
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">{b.totalAppointments}</div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Total Appointments</div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="text-center">
            <UserX className="w-5 h-5 mx-auto mb-2 text-[var(--color-error-text)]" />
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">{b.cancellationRate}</div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Cancellation Rate</div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="text-center">
            <Repeat2 className="w-5 h-5 mx-auto mb-2 text-[var(--color-warning-text)]" />
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">{b.rescheduleCount}</div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Rescheduled</div>
          </Card>
        </StaggerItem>
        <StaggerItem>
          <Card className="text-center">
            <Timer className="w-5 h-5 mx-auto mb-2 text-[var(--color-info-text)]" />
            <div className="text-2xl font-bold text-[var(--color-text-primary)] tabular-nums">
              {b.avgLeadTimeHours < 24
                ? `${b.avgLeadTimeHours}h`
                : `${Math.round(b.avgLeadTimeHours / 24)}d`}
            </div>
            <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Avg. Lead Time</div>
          </Card>
        </StaggerItem>
      </StaggerContainer>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Services */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-[var(--color-accent-text)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">Most Booked Services</h2>
          </div>
          <div className="space-y-3">
            {data.topServices.length === 0 && (
              <p className="text-sm text-[var(--color-text-tertiary)]">No bookings yet</p>
            )}
            {data.topServices.slice(0, 5).map((s, i) => (
              <div key={s.serviceId} className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--color-text-quaternary)] w-5 text-right tabular-nums">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-[var(--color-text-primary)] w-32 truncate shrink-0">
                  {s.serviceName}
                </span>
                <BarCell value={s.count} max={maxServiceCount} />
              </div>
            ))}
          </div>
        </Card>

        {/* Popular Days */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-[var(--color-accent-text)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">Popular Days</h2>
          </div>
          <div className="space-y-3">
            {data.popularDays.length === 0 && (
              <p className="text-sm text-[var(--color-text-tertiary)]">No data yet</p>
            )}
            {data.popularDays.map((d) => (
              <div key={d.dayIndex} className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--color-text-primary)] w-24 shrink-0">
                  {d.day}
                </span>
                <BarCell value={d.count} max={maxDayCount} />
              </div>
            ))}
          </div>
        </Card>

        {/* Popular Hours */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[var(--color-accent-text)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">Popular Times</h2>
          </div>
          <div className="space-y-3">
            {data.popularHours.length === 0 && (
              <p className="text-sm text-[var(--color-text-tertiary)]">No data yet</p>
            )}
            {data.popularHours.slice(0, 8).map((h) => (
              <div key={h.hour} className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--color-text-primary)] w-20 shrink-0">
                  {h.label}
                </span>
                <BarCell value={h.count} max={maxHourCount} />
              </div>
            ))}
          </div>
        </Card>

        {/* Booking Status Breakdown */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-[var(--color-accent-text)]" />
            <h2 className="font-semibold text-[var(--color-text-primary)]">Booking Status Overview</h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="surface rounded-[var(--radius-lg)] p-4 text-center">
              <div className="text-xl font-bold text-[var(--color-info-text)] tabular-nums">{b.bookedCount}</div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Active</div>
            </div>
            <div className="surface rounded-[var(--radius-lg)] p-4 text-center">
              <div className="text-xl font-bold text-[var(--color-success-text)] tabular-nums">{b.completedCount}</div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Completed</div>
            </div>
            <div className="surface rounded-[var(--radius-lg)] p-4 text-center">
              <div className="text-xl font-bold text-[var(--color-error-text)] tabular-nums">{b.cancelledCount}</div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1">Cancelled</div>
            </div>
            <div className="surface rounded-[var(--radius-lg)] p-4 text-center">
              <div className="text-xl font-bold text-[var(--color-warning-text)] tabular-nums">{b.noShowCount}</div>
              <div className="text-xs text-[var(--color-text-tertiary)] mt-1">No Shows</div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--glass-border)] flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
            <span>No-show rate: <strong className="text-[var(--color-text-secondary)]">{b.noShowRate}</strong></span>
            <span>Cancel rate: <strong className="text-[var(--color-text-secondary)]">{b.cancellationRate}</strong></span>
          </div>
        </Card>
      </div>

      {/* Recent Bookings */}
      {data.recentBookings.length > 0 && (
        <Card className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-[var(--color-text-primary)]">Recent Bookings</h2>
            <Link
              href="/provider/appointments"
              className="text-xs font-medium text-[var(--color-accent-text)] hover:underline flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--glass-border)]">
                  <th className="text-left font-medium text-[var(--color-text-tertiary)] px-6 pb-2">Service</th>
                  <th className="text-left font-medium text-[var(--color-text-tertiary)] px-3 pb-2">Staff</th>
                  <th className="text-left font-medium text-[var(--color-text-tertiary)] px-3 pb-2">Date</th>
                  <th className="text-left font-medium text-[var(--color-text-tertiary)] px-3 pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentBookings.map((rb) => (
                  <tr key={rb.id} className="border-b border-[var(--glass-border)] last:border-0">
                    <td className="px-6 py-2.5 font-medium text-[var(--color-text-primary)]">{rb.service.name}</td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)]">{rb.staff.name}</td>
                    <td className="px-3 py-2.5 text-[var(--color-text-secondary)] tabular-nums">
                      {new Date(rb.startAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </td>
                    <td className="px-3 py-2.5"><StatusPill status={rb.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Quick Links */}
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-4">
        Quick Links
      </h2>
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map((c) => (
          <StaggerItem key={c.href}>
            <Link href={c.href}>
              <Card hover className="group h-full">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-[var(--radius-lg)] bg-[var(--color-accent-subtle)] flex items-center justify-center shrink-0">
                    <c.icon className="w-5 h-5 text-[var(--color-accent-text)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{c.title}</h3>
                      <ArrowRight className="w-4 h-4 text-[var(--color-text-quaternary)] group-hover:text-[var(--color-accent-text)] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{c.desc}</p>
                  </div>
                </div>
              </Card>
            </Link>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </FadeIn>
  );
}
