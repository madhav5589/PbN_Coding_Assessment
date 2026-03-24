"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Clock, User, CheckCircle2, ChevronLeft, ChevronRight, Loader2
} from "lucide-react";
import {
  Button, Card, GlassPanel, Input, Badge, EmptyState, FadeIn, Skeleton
} from "@/components/ui";
import { bizFetch } from "@/lib/client-fetch";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
}

interface SlotInfo {
  startTime: string;
  endTime: string;
  staffId: string;
  staffName: string;
}

interface BookingResult {
  appointment: {
    id: string;
    customerName: string;
    startAt: string;
    endAt: string;
    service: { name: string };
    staff: { name: string };
  };
}

type Step = "date" | "slot" | "info" | "confirm";

const stepLabels: Record<Step, { num: number; label: string }> = {
  date: { num: 1, label: "Date" },
  slot: { num: 2, label: "Time" },
  info: { num: 3, label: "Details" },
  confirm: { num: 4, label: "Confirmed" },
};

const steps: Step[] = ["date", "slot", "info", "confirm"];

const BUSINESS_TIMEZONE = "America/Chicago";

export default function BookServicePage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = params.serviceId as string;

  const [service, setService] = useState<Service | null>(null);
  const [step, setStep] = useState<Step>("date");
  const [selectedDate, setSelectedDate] = useState("");
  const [slots, setSlots] = useState<SlotInfo[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotInfo | null>(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Calendar state
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  useEffect(() => {
    bizFetch(`/api/services/${serviceId}`)
      .then((r) => r.json())
      .then((d) => setService(d.service));
  }, [serviceId]);

  async function loadSlots(date: string) {
    setSlotsLoading(true);
    setSlots([]);
    setSelectedSlot(null);
    const res = await bizFetch(`/api/availability?serviceId=${serviceId}&date=${date}`);
    const data = await res.json();
    setSlots(data.slots || []);
    setSlotsLoading(false);
  }

  function handleDateSelect(date: string) {
    setSelectedDate(date);
    loadSlots(date);
    setStep("slot");
  }

  function handleSlotSelect(slot: SlotInfo) {
    setSelectedSlot(slot);
    setStep("info");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await bizFetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          staffId: selectedSlot.staffId,
          date: selectedDate,
          startTime: selectedSlot.startTime,
          customerName: form.name,
          customerEmail: form.email,
          customerPhone: form.phone,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error === "SLOT_TAKEN" ? "This slot was just booked by someone else. Please select a different time." : data.error || "Booking failed");
        setSubmitting(false);
        return;
      }
      setBooking(data);
      setStep("confirm");
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setSubmitting(false);
  }

  // Calendar helpers
  function getAvailableDates(): Set<string> {
    const dates = new Set<string>();
    for (let i = 1; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      dates.add(d.toISOString().slice(0, 10));
    }
    return dates;
  }

  const availableDates = getAvailableDates();

  function renderCalendar() {
    const firstDay = new Date(calYear, calMonth, 1);
    const lastDay = new Date(calYear, calMonth + 1, 0);
    const startPad = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = Array(startPad).fill(null);

    for (let d = 1; d <= daysInMonth; d++) {
      week.push(d);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    const monthStr = new Date(calYear, calMonth).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const canPrev = calYear > today.getFullYear() || (calYear === today.getFullYear() && calMonth > today.getMonth());

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
              else setCalMonth(calMonth - 1);
            }}
            disabled={!canPrev}
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-accent-subtle)] text-[var(--color-text-secondary)] disabled:opacity-30 transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{monthStr}</span>
          <button
            onClick={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
              else setCalMonth(calMonth + 1);
            }}
            className="p-2 rounded-[var(--radius-md)] hover:bg-[var(--color-accent-subtle)] text-[var(--color-text-secondary)] transition-colors"
            aria-label="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-quaternary)] py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weeks.flat().map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const isAvailable = availableDates.has(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === today.toISOString().slice(0, 10);

            return (
              <button
                key={i}
                disabled={!isAvailable}
                onClick={() => isAvailable && handleDateSelect(dateStr)}
                className={`
                  relative h-10 w-full rounded-[var(--radius-md)] text-sm font-medium
                  transition-all duration-fast
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]
                  ${isSelected
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : isAvailable
                      ? "text-[var(--color-text-primary)] hover:bg-[var(--color-accent-subtle)]"
                      : "text-[var(--color-text-quaternary)] cursor-not-allowed"
                  }
                `}
                aria-label={`${new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}`}
              >
                {day}
                {isToday && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--color-accent)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="skeleton h-24 rounded-[var(--radius-xl)]" />
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-[300px] rounded-[var(--radius-xl)]" />
      </div>
    );
  }

  const currentStepIdx = steps.indexOf(step);

  return (
    <FadeIn className="max-w-2xl mx-auto">
      {/* Service Header */}
      <GlassPanel padding="md" className="mb-6 flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">{service.name}</h1>
          {service.description && (
            <p className="text-sm text-[var(--color-text-tertiary)] mt-0.5">{service.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="default">
            <Clock className="w-3 h-3 mr-1" />
            {service.durationMin} min
          </Badge>
          <Badge variant="accent">
            ${(service.priceCents / 100).toFixed(2)}
          </Badge>
        </div>
      </GlassPanel>

      {/* Progress Steps */}
      <div className="flex items-center gap-0 mb-8">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={`
                  w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  transition-all duration-normal
                  ${step === s
                    ? "bg-[var(--color-accent)] text-white shadow-sm"
                    : currentStepIdx > i
                      ? "bg-[var(--color-accent-light)] text-[var(--color-accent-text)]"
                      : "bg-[rgb(var(--color-bg-tertiary))] text-[var(--color-text-quaternary)]"
                  }
                `}
              >
                {currentStepIdx > i ? <CheckCircle2 className="w-3.5 h-3.5" /> : stepLabels[s].num}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === s ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-tertiary)]"}`}>
                {stepLabels[s].label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${currentStepIdx > i ? "bg-[var(--color-accent)]" : "bg-[var(--color-border)]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {/* Step: Date */}
        {step === "date" && (
          <motion.div
            key="date"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <h2 className="font-semibold text-[var(--color-text-primary)] mb-5 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--color-accent-text)]" />
                Choose a Date
              </h2>
              {renderCalendar()}
            </Card>
          </motion.div>
        )}

        {/* Step: Slot Selection */}
        {step === "slot" && (
          <motion.div
            key="slot"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--color-accent-text)]" />
                  Available Times
                </h2>
                <button
                  onClick={() => setStep("date")}
                  className="flex items-center gap-1 text-xs text-[var(--color-accent-text)] hover:underline"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Change Date
                </button>
              </div>

              <p className="text-xs text-[var(--color-text-tertiary)] mb-4">
                {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}
              </p>

              {slotsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-[var(--color-accent)]" />
                </div>
              ) : slots.length === 0 ? (
                <EmptyState
                  title="No Available Slots"
                  description="No slots on this date. Try another day."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => setStep("date")}>
                      Pick Another Date
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-5">
                  {Array.from(new Set(slots.map((s) => s.staffId))).map((staffId) => {
                    const staffSlots = slots.filter((s) => s.staffId === staffId);
                    const staffName = staffSlots[0].staffName;
                    return (
                      <div key={staffId}>
                        <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          with {staffName}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {staffSlots.map((slot) => {
                            const selected = selectedSlot?.startTime === slot.startTime && selectedSlot?.staffId === slot.staffId;
                            return (
                              <motion.button
                                key={`${slot.staffId}-${slot.startTime}`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => handleSlotSelect(slot)}
                                className={`
                                  px-3.5 py-2 rounded-[var(--radius-md)] text-sm font-medium
                                  border transition-all duration-fast
                                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)]
                                  ${selected
                                    ? "bg-[var(--color-accent)] text-white border-transparent shadow-sm"
                                    : "border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-subtle)]"
                                  }
                                `}
                              >
                                {slot.startTime}
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* Step: Customer Info */}
        {step === "info" && selectedSlot && (
          <motion.div
            key="info"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-[var(--color-text-primary)]">Your Details</h2>
                <button
                  onClick={() => setStep("slot")}
                  className="flex items-center gap-1 text-xs text-[var(--color-accent-text)] hover:underline"
                >
                  <ArrowLeft className="w-3 h-3" />
                  Change Time
                </button>
              </div>

              {/* Summary */}
              <div className="rounded-[var(--radius-lg)] bg-[var(--color-accent-subtle)] px-4 py-3 mb-5 text-sm space-y-0.5">
                <p className="font-medium text-[var(--color-text-primary)]">
                  {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  {selectedSlot.startTime} – {selectedSlot.endTime} with {selectedSlot.staffName}
                </p>
              </div>

              {error && (
                <div className="rounded-[var(--radius-md)] bg-[var(--color-error-bg)] px-4 py-3 mb-5 text-sm text-[var(--color-error-text)]" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Full Name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Jane Smith"
                />
                <Input
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="jane@example.com"
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                  placeholder="(555) 123-4567"
                />
                <Button type="submit" loading={submitting} className="w-full" size="lg">
                  Confirm Booking
                </Button>
              </form>
            </Card>
          </motion.div>
        )}

        {/* Step: Confirmation */}
        {step === "confirm" && booking && (
          <motion.div
            key="confirm"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--color-success-bg)] flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 className="w-8 h-8 text-[var(--color-success-text)]" />
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">Booking Confirmed!</h2>
              <p className="text-sm text-[var(--color-text-tertiary)] mb-6">
                Your appointment has been booked successfully.
              </p>

              <div className="rounded-[var(--radius-lg)] bg-[rgb(var(--color-bg-secondary))] p-5 text-left text-sm space-y-3 mb-6">
                {[
                  ["Service", booking.appointment.service.name],
                  ["Stylist", booking.appointment.staff.name],
                  [
                    "Date",
                    new Date(booking.appointment.startAt).toLocaleDateString("en-US", {
                      timeZone: BUSINESS_TIMEZONE,
                    }),
                  ],
                  [
                    "Time",
                    `${new Date(booking.appointment.startAt).toLocaleTimeString("en-US", { timeZone: BUSINESS_TIMEZONE, hour: "2-digit", minute: "2-digit" })} – ${new Date(booking.appointment.endAt).toLocaleTimeString("en-US", { timeZone: BUSINESS_TIMEZONE, hour: "2-digit", minute: "2-digit" })}`,
                  ],
                  ["Confirmation", booking.appointment.id.slice(0, 8).toUpperCase()],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-[var(--color-text-tertiary)]">{label}</span>
                    <span className="font-medium text-[var(--color-text-primary)]">{value}</span>
                  </div>
                ))}
              </div>

              <Button variant="ghost" onClick={() => router.push("/book")}>
                <ArrowLeft className="w-4 h-4 mr-1" />
                Book Another Appointment
              </Button>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </FadeIn>
  );
}
