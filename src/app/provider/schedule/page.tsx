"use client";

import { useEffect, useState } from "react";
import { Clock, Plus, CalendarOff, Trash2, Pencil, X } from "lucide-react";
import {
  Button, Card, Input, Select, Modal, Badge, Switch, PageHeader,
  EmptyState, FadeIn, StaggerContainer, StaggerItem, useToast
} from "@/components/ui";

interface StaffMember {
  id: string;
  name: string;
}

interface WorkingHoursEntry {
  id: string;
  dayOfWeek: number;
  startTimeLocal: string;
  endTimeLocal: string;
  isClosed: boolean;
}

interface TimeOff {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
}

interface Blackout {
  id: string;
  startAt: string;
  endAt: string;
  reason: string;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProviderSchedulePage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>("");
  const [hours, setHours] = useState<WorkingHoursEntry[]>([]);
  const [timeOffs, setTimeOffs] = useState<TimeOff[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursForm, setHoursForm] = useState<{ dayOfWeek: number; startTimeLocal: string; endTimeLocal: string; isClosed: boolean }[]>([]);
  const [showTimeOffForm, setShowTimeOffForm] = useState(false);
  const [showBlackoutForm, setShowBlackoutForm] = useState(false);
  const [toForm, setToForm] = useState({ startAt: "", endAt: "", reason: "" });
  const [boForm, setBoForm] = useState({ startAt: "", endAt: "", reason: "" });
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/provider/staff")
      .then((r) => r.json())
      .then((d) => {
        setStaff(d.staff);
        if (d.staff.length > 0) setSelectedStaff(d.staff[0].id);
        setLoading(false);
      });
    fetch("/api/provider/blackouts")
      .then((r) => r.json())
      .then((d) => setBlackouts(d.blackouts));
  }, []);

  useEffect(() => {
    if (!selectedStaff) return;
    Promise.all([
      fetch(`/api/provider/staff/${selectedStaff}/hours`).then((r) => r.json()),
      fetch(`/api/provider/staff/${selectedStaff}/time-off`).then((r) => r.json()),
    ]).then(([hData, toData]) => {
      setHours(hData.hours);
      setTimeOffs(toData.timeOffs);
    });
  }, [selectedStaff]);

  function startEditHours() {
    const form = Array.from({ length: 7 }, (_, i) => {
      const existing = hours.find((h) => h.dayOfWeek === i);
      return {
        dayOfWeek: i,
        startTimeLocal: existing?.startTimeLocal || "09:00",
        endTimeLocal: existing?.endTimeLocal || "17:00",
        isClosed: existing?.isClosed ?? true,
      };
    });
    setHoursForm(form);
    setEditingHours(true);
  }

  async function saveHours() {
    await fetch(`/api/provider/staff/${selectedStaff}/hours`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: hoursForm }),
    });
    const res = await fetch(`/api/provider/staff/${selectedStaff}/hours`);
    const data = await res.json();
    setHours(data.hours);
    setEditingHours(false);
    toast({ type: "success", title: "Working hours saved" });
  }

  async function addTimeOff(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/provider/staff/${selectedStaff}/time-off`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: new Date(toForm.startAt).toISOString(),
        endAt: new Date(toForm.endAt).toISOString(),
        reason: toForm.reason,
      }),
    });
    setShowTimeOffForm(false);
    setToForm({ startAt: "", endAt: "", reason: "" });
    const res = await fetch(`/api/provider/staff/${selectedStaff}/time-off`);
    const data = await res.json();
    setTimeOffs(data.timeOffs);
    toast({ type: "success", title: "Time off added" });
  }

  async function deleteTimeOff(id: string) {
    await fetch(`/api/provider/time-off/${id}`, { method: "DELETE" });
    setTimeOffs(timeOffs.filter((t) => t.id !== id));
    toast({ type: "info", title: "Time off removed" });
  }

  async function addBlackout(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/provider/blackouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startAt: new Date(boForm.startAt).toISOString(),
        endAt: new Date(boForm.endAt).toISOString(),
        reason: boForm.reason,
      }),
    });
    setShowBlackoutForm(false);
    setBoForm({ startAt: "", endAt: "", reason: "" });
    const res = await fetch("/api/provider/blackouts");
    const data = await res.json();
    setBlackouts(data.blackouts);
    toast({ type: "success", title: "Blackout date added" });
  }

  async function deleteBlackout(id: string) {
    await fetch(`/api/provider/blackouts/${id}`, { method: "DELETE" });
    setBlackouts(blackouts.filter((b) => b.id !== id));
    toast({ type: "info", title: "Blackout date removed" });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-10 w-64 rounded-[var(--radius-md)]" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-40 w-full rounded-[var(--radius-lg)]" />
        ))}
      </div>
    );
  }

  return (
    <FadeIn>
      <PageHeader
        title="Schedule"
        description="Manage working hours, time off, and blackout dates"
      />

      {/* Staff selector */}
      <div className="mb-8">
        <Select
          label="Staff Member"
          value={selectedStaff}
          onChange={(e) => setSelectedStaff(e.target.value)}
          options={staff.map((s) => ({ value: s.id, label: s.name }))}
        />
      </div>

      <StaggerContainer className="space-y-6">
        {/* Working Hours */}
        <StaggerItem>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-[var(--color-accent-text)]" />
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Weekly Working Hours</h2>
              </div>
              <Button
                variant={editingHours ? "ghost" : "secondary"}
                size="sm"
                onClick={() => editingHours ? setEditingHours(false) : startEditHours()}
                icon={editingHours ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
              >
                {editingHours ? "Cancel" : "Edit"}
              </Button>
            </div>

            {editingHours ? (
              <div className="space-y-3">
                {hoursForm.map((h, i) => (
                  <div key={h.dayOfWeek} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-medium text-[var(--color-text-secondary)]">{DAY_SHORT[h.dayOfWeek]}</span>
                    <Switch
                      checked={!h.isClosed}
                      onChange={() => {
                        const updated = [...hoursForm];
                        updated[i] = { ...h, isClosed: !h.isClosed };
                        setHoursForm(updated);
                      }}
                    />
                    {!h.isClosed ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={h.startTimeLocal}
                          onChange={(e) => {
                            const updated = [...hoursForm];
                            updated[i] = { ...h, startTimeLocal: e.target.value };
                            setHoursForm(updated);
                          }}
                          className="surface rounded-[var(--radius-md)] border border-[var(--glass-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent-emphasis)]"
                        />
                        <span className="text-xs text-[var(--color-text-quaternary)]">to</span>
                        <input
                          type="time"
                          value={h.endTimeLocal}
                          onChange={(e) => {
                            const updated = [...hoursForm];
                            updated[i] = { ...h, endTimeLocal: e.target.value };
                            setHoursForm(updated);
                          }}
                          className="surface rounded-[var(--radius-md)] border border-[var(--glass-border)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent-emphasis)]"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-[var(--color-text-quaternary)]">Closed</span>
                    )}
                  </div>
                ))}
                <div className="pt-3">
                  <Button onClick={saveHours}>Save Hours</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {DAY_NAMES.map((name, i) => {
                  const h = hours.find((h) => h.dayOfWeek === i);
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm py-1">
                      <span className="w-24 font-medium text-[var(--color-text-secondary)]">{name}</span>
                      {h && !h.isClosed ? (
                        <Badge variant="success" size="sm">{h.startTimeLocal} – {h.endTimeLocal}</Badge>
                      ) : (
                        <span className="text-[var(--color-text-quaternary)]">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </StaggerItem>

        {/* Time Off */}
        <StaggerItem>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-[var(--color-warning)]" />
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Time Off & Breaks</h2>
              </div>
              <Button size="sm" onClick={() => setShowTimeOffForm(true)} icon={<Plus className="w-4 h-4" />}>
                Add Time Off
              </Button>
            </div>

            {/* Time Off Form Modal */}
            <Modal open={showTimeOffForm} onClose={() => { setShowTimeOffForm(false); setToForm({ startAt: "", endAt: "", reason: "" }); }} title="Add Time Off" size="sm">
              <form onSubmit={addTimeOff} className="space-y-4">
                <Input
                  label="Start"
                  type="datetime-local"
                  value={toForm.startAt}
                  onChange={(e) => setToForm({ ...toForm, startAt: e.target.value })}
                  required
                />
                <Input
                  label="End"
                  type="datetime-local"
                  value={toForm.endAt}
                  onChange={(e) => setToForm({ ...toForm, endAt: e.target.value })}
                  required
                />
                <Input
                  label="Reason"
                  value={toForm.reason}
                  onChange={(e) => setToForm({ ...toForm, reason: e.target.value })}
                  placeholder="Optional reason"
                />
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1">Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowTimeOffForm(false)}>Cancel</Button>
                </div>
              </form>
            </Modal>

            {timeOffs.length === 0 ? (
              <p className="text-sm text-[var(--color-text-quaternary)]">No time off scheduled</p>
            ) : (
              <div className="space-y-2">
                {timeOffs.map((to) => (
                  <div key={to.id} className="flex items-center justify-between py-2 border-b border-[var(--glass-border)] last:border-0">
                    <div className="text-sm">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {new Date(to.startAt).toLocaleDateString()} {new Date(to.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-[var(--color-text-quaternary)] mx-2">→</span>
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {new Date(to.endAt).toLocaleDateString()} {new Date(to.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      {to.reason && <span className="text-[var(--color-text-tertiary)] ml-2">({to.reason})</span>}
                    </div>
                    <button
                      onClick={() => deleteTimeOff(to.id)}
                      className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-quaternary)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
                      aria-label="Delete time off"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </StaggerItem>

        {/* Blackout Dates */}
        <StaggerItem>
          <Card>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <CalendarOff className="w-5 h-5 text-[var(--color-error)]" />
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Business Blackout Dates</h2>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setShowBlackoutForm(true)} icon={<Plus className="w-4 h-4" />}>
                Add Blackout
              </Button>
            </div>

            {/* Blackout Form Modal */}
            <Modal open={showBlackoutForm} onClose={() => { setShowBlackoutForm(false); setBoForm({ startAt: "", endAt: "", reason: "" }); }} title="Add Blackout Date" size="sm">
              <form onSubmit={addBlackout} className="space-y-4">
                <Input
                  label="Start"
                  type="datetime-local"
                  value={boForm.startAt}
                  onChange={(e) => setBoForm({ ...boForm, startAt: e.target.value })}
                  required
                />
                <Input
                  label="End"
                  type="datetime-local"
                  value={boForm.endAt}
                  onChange={(e) => setBoForm({ ...boForm, endAt: e.target.value })}
                  required
                />
                <Input
                  label="Reason"
                  value={boForm.reason}
                  onChange={(e) => setBoForm({ ...boForm, reason: e.target.value })}
                  placeholder="e.g. Public holiday"
                />
                <div className="flex gap-3 pt-2">
                  <Button type="submit" className="flex-1">Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowBlackoutForm(false)}>Cancel</Button>
                </div>
              </form>
            </Modal>

            {blackouts.length === 0 ? (
              <p className="text-sm text-[var(--color-text-quaternary)]">No blackout dates</p>
            ) : (
              <div className="space-y-2">
                {blackouts.map((b) => (
                  <div key={b.id} className="flex items-center justify-between py-2 border-b border-[var(--glass-border)] last:border-0">
                    <div className="text-sm">
                      <span className="font-medium text-[var(--color-text-primary)]">
                        {new Date(b.startAt).toLocaleDateString()} → {new Date(b.endAt).toLocaleDateString()}
                      </span>
                      {b.reason && <span className="text-[var(--color-text-tertiary)] ml-2">({b.reason})</span>}
                    </div>
                    <button
                      onClick={() => deleteBlackout(b.id)}
                      className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-quaternary)] hover:text-[var(--color-error)] hover:bg-red-500/10 transition-colors"
                      aria-label="Delete blackout"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </StaggerItem>
      </StaggerContainer>
    </FadeIn>
  );
}
