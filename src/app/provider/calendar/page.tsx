"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Button, Card, Badge, Avatar, Tabs, PageHeader, GlassPanel, FadeIn
} from "@/components/ui";
import { bizFetch } from "@/lib/client-fetch";
import { localHourMinute } from "@/lib/format-date";

interface Appointment {
  id: string;
  customerName: string;
  startAt: string;
  endAt: string;
  status: string;
  service: { name: string; durationMin: number };
  staff: { id: string; name: string };
}

interface StaffMember {
  id: string;
  name: string;
}

const STAFF_COLORS = [
  { bg: "rgba(var(--color-accent-emphasis-rgb, 59 130 246), 0.15)", border: "var(--color-accent-emphasis)", text: "var(--color-accent-text)" },
  { bg: "rgba(16, 185, 129, 0.15)", border: "rgb(16, 185, 129)", text: "rgb(16, 185, 129)" },
  { bg: "rgba(139, 92, 246, 0.15)", border: "rgb(139, 92, 246)", text: "rgb(139, 92, 246)" },
  { bg: "rgba(245, 158, 11, 0.15)", border: "rgb(245, 158, 11)", text: "rgb(245, 158, 11)" },
  { bg: "rgba(236, 72, 153, 0.15)", border: "rgb(236, 72, 153)", text: "rgb(236, 72, 153)" },
];

export default function ProviderCalendarPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [view, setView] = useState<"day" | "week">("day");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bizFetch("/api/provider/staff").then((r) => r.json()).then((d) => setStaff(d.staff));
  }, []);

  useEffect(() => {
    async function loadWeek() {
      setLoading(true);
      if (view === "day") {
        const res = await bizFetch(`/api/provider/appointments?date=${date}`);
        const data = await res.json();
        setAppointments(data.appointments);
      } else {
        const start = new Date(date + "T00:00:00");
        const dayOfWeek = start.getDay();
        const monday = new Date(start);
        monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
        const allAppts: Appointment[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(monday);
          d.setDate(d.getDate() + i);
          const ds = d.toISOString().slice(0, 10);
          const res = await bizFetch(`/api/provider/appointments?date=${ds}`);
          const data = await res.json();
          allAppts.push(...data.appointments);
        }
        setAppointments(allAppts);
      }
      setLoading(false);
    }
    loadWeek();
  }, [date, view]);

  const hours = Array.from({ length: 12 }, (_, i) => i + 8);

  function getStaffColor(staffId: string) {
    const idx = staff.findIndex((s) => s.id === staffId);
    return STAFF_COLORS[idx % STAFF_COLORS.length];
  }

  function navigateDate(direction: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + direction * (view === "week" ? 7 : 1));
    setDate(d.toISOString().slice(0, 10));
  }

  function renderDayView() {
    const dayAppts = appointments.filter((a) => a.status === "BOOKED");
    return (
      <Card className="overflow-hidden !p-0">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--glass-border)] bg-[var(--glass-bg)]">
          <span className="font-medium text-sm text-[var(--color-text-primary)]">
            {new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </div>
        {/* Time grid */}
        <div className="relative" style={{ height: `${hours.length * 80}px` }}>
          {hours.map((h) => (
            <div key={h} className="absolute w-full border-b border-[var(--glass-border)]" style={{ top: `${(h - 8) * 80}px`, height: "80px" }}>
              <span className="absolute -top-2 left-2 text-[11px] text-[var(--color-text-quaternary)] font-medium">
                {h > 12 ? `${h - 12}:00 PM` : h === 12 ? "12:00 PM" : `${h}:00 AM`}
              </span>
            </div>
          ))}
          {dayAppts.map((a) => {
            const start = new Date(a.startAt);
            const end = new Date(a.endAt);
            const { hour: startHour, minute: startMin } = localHourMinute(start);
            const topMinutes = startHour * 60 + startMin - 8 * 60;
            const heightMinutes = (end.getTime() - start.getTime()) / 60000;
            const topPx = (topMinutes / 60) * 80;
            const heightPx = (heightMinutes / 60) * 80;
            if (topPx < 0) return null;
            const color = getStaffColor(a.staff.id);
            return (
              <div
                key={a.id}
                className="absolute left-16 right-3 rounded-[var(--radius-md)] px-2.5 py-1.5 text-xs overflow-hidden border-l-[3px] backdrop-blur-sm"
                style={{
                  top: `${topPx}px`,
                  height: `${Math.max(heightPx, 28)}px`,
                  backgroundColor: color.bg,
                  borderLeftColor: color.border,
                  color: color.text,
                }}
              >
                <div className="font-semibold truncate">{a.customerName}</div>
                <div className="truncate opacity-80">{a.service.name} &middot; {a.staff.name}</div>
              </div>
            );
          })}
        </div>
      </Card>
    );
  }

  function renderWeekView() {
    const start = new Date(date + "T00:00:00");
    const dayOfWeek = start.getDay();
    const monday = new Date(start);
    monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      return d;
    });
    const today = new Date().toISOString().slice(0, 10);
    const bookedAppts = appointments.filter((a) => a.status === "BOOKED");

    return (
      <Card className="overflow-hidden !p-0">
        <div className="grid grid-cols-8 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] text-sm">
          <div className="px-2 py-2" />
          {days.map((d) => {
            const isToday = d.toISOString().slice(0, 10) === today;
            return (
              <div key={d.toISOString()} className="px-2 py-2 text-center">
                <div className={`text-xs font-medium ${isToday ? "text-[var(--color-accent-text)]" : "text-[var(--color-text-tertiary)]"}`}>
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div className={`text-sm font-semibold ${isToday ? "text-[var(--color-accent-text)]" : "text-[var(--color-text-primary)]"}`}>
                  {d.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="relative" style={{ height: `${hours.length * 60}px` }}>
          <div className="grid grid-cols-8 h-full">
            <div className="relative border-r border-[var(--glass-border)]">
              {hours.map((h) => (
                <div key={h} className="absolute w-full border-b border-[var(--glass-border)]" style={{ top: `${(h - 8) * 60}px`, height: "60px" }}>
                  <span className="text-[10px] text-[var(--color-text-quaternary)] pl-1 font-medium">
                    {h > 12 ? `${h - 12}P` : h === 12 ? "12P" : `${h}A`}
                  </span>
                </div>
              ))}
            </div>
            {days.map((d) => {
              const dayStr = d.toISOString().slice(0, 10);
              const dayAppts = bookedAppts.filter((a) => a.startAt.slice(0, 10) === dayStr);
              return (
                <div key={dayStr} className="relative border-r border-[var(--glass-border)]">
                  {hours.map((h) => (
                    <div key={h} className="absolute w-full border-b border-[var(--glass-border)]" style={{ top: `${(h - 8) * 60}px`, height: "60px" }} />
                  ))}
                  {dayAppts.map((a) => {
                    const s = new Date(a.startAt);
                    const e = new Date(a.endAt);
                    const { hour: sHour, minute: sMin } = localHourMinute(s);
                    const topMinutes = sHour * 60 + sMin - 8 * 60;
                    const heightMinutes = (e.getTime() - s.getTime()) / 60000;
                    const topPx = (topMinutes / 60) * 60;
                    const heightPx = (heightMinutes / 60) * 60;
                    if (topPx < 0) return null;
                    const color = getStaffColor(a.staff.id);
                    return (
                      <div
                        key={a.id}
                        className="absolute left-0 right-0 mx-0.5 rounded-[var(--radius-sm)] text-[10px] px-1 overflow-hidden border-l-2"
                        style={{
                          top: `${topPx}px`,
                          height: `${Math.max(heightPx, 18)}px`,
                          backgroundColor: color.bg,
                          borderLeftColor: color.border,
                          color: color.text,
                        }}
                      >
                        <div className="truncate font-semibold">{a.customerName}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    );
  }

  return (
    <FadeIn>
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="Calendar" description="" />
        <div className="flex items-center gap-3">
          <Tabs
            tabs={[
              { id: "day", label: "Day" },
              { id: "week", label: "Week" },
            ]}
            activeTab={view}
            onChange={(id) => setView(id as "day" | "week")}
          />
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => navigateDate(-1)}
              className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
              aria-label="Previous"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="surface rounded-[var(--radius-md)] border border-[var(--glass-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent-emphasis)]"
            />
            <button
              onClick={() => navigateDate(1)}
              className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-bg)] transition-colors"
              aria-label="Next"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setDate(new Date().toISOString().slice(0, 10))}>
            Today
          </Button>
        </div>
      </div>

      {/* Staff legend */}
      <div className="flex gap-2 flex-wrap mb-4">
        {staff.map((s) => {
          const color = getStaffColor(s.id);
          return (
            <span
              key={s.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
              style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color.border }} />
              {s.name}
            </span>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-16 w-full rounded-[var(--radius-md)]" />
          ))}
        </div>
      ) : view === "day" ? renderDayView() : renderWeekView()}
    </FadeIn>
  );
}
