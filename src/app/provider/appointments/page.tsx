"use client";

import { useEffect, useState } from "react";
import { Search, X, FileText, CalendarClock, Ban, Pencil } from "lucide-react";
import {
  Button, Card, Input, Select, Modal, Badge, StatusPill, Avatar, PageHeader,
  Table, SkeletonTable, EmptyState, FadeIn, useToast
} from "@/components/ui";
import { bizFetch } from "@/lib/client-fetch";
import { formatDateTZ, formatTimeTZ } from "@/lib/format-date";
import { TextArea } from "@/components/ui/input";

interface Appointment {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  startAt: string;
  endAt: string;
  status: string;
  notes: string | null;
  service: { id: string; name: string; durationMin: number; priceCents: number };
  staff: { id: string; name: string };
}

export default function ProviderAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [showNotesEditor, setShowNotesEditor] = useState(false);
  const { toast } = useToast();

  async function loadAppointments() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateFilter) params.set("date", dateFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await bizFetch(`/api/provider/appointments?${params.toString()}`);
    const data = await res.json();
    setAppointments(data.appointments);
    setLoading(false);
  }

  useEffect(() => {
    loadAppointments();
  }, [dateFilter, statusFilter]);

  async function cancelAppointment(id: string) {
    if (!confirm("Cancel this appointment?")) return;
    await bizFetch(`/api/provider/appointments/${id}/cancel`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Cancelled by provider" }),
    });
    toast({ type: "info", title: "Appointment cancelled" });
    loadAppointments();
    setSelectedAppt(null);
  }

  async function reschedule(id: string) {
    if (!rescheduleDate) return;
    const [date, startTime] = rescheduleDate.split("T");
    const res = await bizFetch(`/api/provider/appointments/${id}/reschedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, startTime }),
    });
    if (res.ok) {
      setRescheduleDate("");
      toast({ type: "success", title: "Appointment rescheduled" });
      loadAppointments();
      setSelectedAppt(null);
    } else {
      const err = await res.json();
      toast({ type: "error", title: err.error || "Reschedule failed" });
    }
  }

  async function saveNotes(id: string) {
    await bizFetch(`/api/provider/appointments/${id}/notes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editNotes }),
    });
    setShowNotesEditor(false);
    toast({ type: "success", title: "Notes saved" });
    loadAppointments();
  }

  const columns: { key: string; header: string; render: (a: Appointment) => React.ReactNode }[] = [
    {
      key: "time",
      header: "Time",
      render: (a) => (
        <div>
          <div className="font-medium text-[var(--color-text-primary)]">{formatDateTZ(a.startAt)}</div>
          <div className="text-xs text-[var(--color-text-tertiary)]">
            {formatTimeTZ(a.startAt)}
            {" – "}
            {formatTimeTZ(a.endAt)}
          </div>
        </div>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (a) => (
        <div className="flex items-center gap-2">
          <Avatar name={a.customerName} size="sm" />
          <div>
            <div className="font-medium text-[var(--color-text-primary)]">{a.customerName}</div>
            <div className="text-xs text-[var(--color-text-quaternary)]">{a.customerEmail}</div>
          </div>
        </div>
      ),
    },
    {
      key: "service",
      header: "Service",
      render: (a) => (
        <span className="text-[var(--color-text-secondary)]">{a.service.name}</span>
      ),
    },
    {
      key: "staff",
      header: "Staff",
      render: (a) => (
        <span className="text-[var(--color-text-secondary)]">{a.staff.name}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (a) => <StatusPill status={a.status} />,
    },
  ];

  return (
    <FadeIn>
      <PageHeader
        title="Appointments"
        description="View and manage all bookings"
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-44">
            <Input
              label="Date"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
          <div className="w-44">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              placeholder="All"
              options={[
                { value: "BOOKED", label: "Booked" },
                { value: "CANCELLED", label: "Cancelled" },
                { value: "COMPLETED", label: "Completed" },
                { value: "NO_SHOW", label: "No Show" },
              ]}
            />
          </div>
          {(dateFilter || statusFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFilter(""); setStatusFilter(""); }}
              icon={<X className="w-4 h-4" />}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : appointments.length === 0 ? (
        <EmptyState
          title="No appointments found"
          description="Try adjusting your filters or check back later."
        />
      ) : (
        <Table<Appointment>
          data={appointments}
          columns={columns}
          keyField="id"
          onRowClick={(a) => {
            setSelectedAppt(a);
            setEditNotes(a.notes || "");
            setShowNotesEditor(false);
            setRescheduleDate("");
          }}
        />
      )}

      {/* Detail Modal */}
      <Modal
        open={!!selectedAppt}
        onClose={() => setSelectedAppt(null)}
        title="Appointment Details"
        size="md"
      >
        {selectedAppt && (
          <div className="space-y-5">
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <span className="text-[var(--color-text-tertiary)]">Customer</span>
                <p className="font-medium text-[var(--color-text-primary)]">{selectedAppt.customerName}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Phone</span>
                <p className="font-medium text-[var(--color-text-primary)]">{selectedAppt.customerPhone}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Service</span>
                <p className="font-medium text-[var(--color-text-primary)]">{selectedAppt.service.name}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Staff</span>
                <p className="font-medium text-[var(--color-text-primary)]">{selectedAppt.staff.name}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Date</span>
                <p className="font-medium text-[var(--color-text-primary)]">{formatDateTZ(selectedAppt.startAt)}</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Time</span>
                <p className="font-medium text-[var(--color-text-primary)]">
                  {formatTimeTZ(selectedAppt.startAt)} – {formatTimeTZ(selectedAppt.endAt)}
                </p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Duration</span>
                <p className="font-medium text-[var(--color-text-primary)]">{selectedAppt.service.durationMin} min</p>
              </div>
              <div>
                <span className="text-[var(--color-text-tertiary)]">Price</span>
                <p className="font-medium text-[var(--color-text-primary)]">${(selectedAppt.service.priceCents / 100).toFixed(2)}</p>
              </div>
              <div className="col-span-2">
                <StatusPill status={selectedAppt.status} />
              </div>
            </div>

            {/* Notes */}
            <div className="border-t border-[var(--glass-border)] pt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Notes
                </span>
                <Button variant="ghost" size="sm" onClick={() => setShowNotesEditor(!showNotesEditor)} icon={<Pencil className="w-3.5 h-3.5" />}>
                  {showNotesEditor ? "Cancel" : "Edit"}
                </Button>
              </div>
              {showNotesEditor ? (
                <div className="space-y-2">
                  <TextArea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={3}
                    placeholder="Add notes about this appointment..."
                  />
                  <Button size="sm" onClick={() => saveNotes(selectedAppt.id)}>Save Notes</Button>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-tertiary)]">{selectedAppt.notes || "No notes"}</p>
              )}
            </div>

            {/* Actions for booked appointments */}
            {selectedAppt.status === "BOOKED" && (
              <div className="border-t border-[var(--glass-border)] pt-4 space-y-4">
                <div>
                  <label className="text-sm font-medium text-[var(--color-text-secondary)] flex items-center gap-1.5 mb-2">
                    <CalendarClock className="w-4 h-4" /> Reschedule to
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="datetime-local"
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="flex-1 surface rounded-[var(--radius-md)] border border-[var(--glass-border)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent-emphasis)]"
                    />
                    <Button size="sm" variant="secondary" onClick={() => reschedule(selectedAppt.id)}>
                      Reschedule
                    </Button>
                  </div>
                </div>
                <Button variant="destructive" size="sm" onClick={() => cancelAppointment(selectedAppt.id)} icon={<Ban className="w-4 h-4" />}>
                  Cancel Appointment
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </FadeIn>
  );
}
