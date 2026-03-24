"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import {
  Button, Card, Input, Checkbox, Modal, Table, Badge, PageHeader,
  SkeletonTable, EmptyState, FadeIn, useToast
} from "@/components/ui";
import { bizFetch } from "@/lib/client-fetch";

interface Service {
  id: string;
  name: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  priceCents: number;
  isActive: boolean;
  _count?: { staffServices: number; appointments: number };
}

export default function ProviderServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 5,
    priceCents: 0,
    isActive: true,
  });
  const { toast } = useToast();

  async function loadServices() {
    const res = await bizFetch("/api/provider/services");
    const data = await res.json();
    setServices(data.services);
    setLoading(false);
  }

  useEffect(() => { loadServices(); }, []);

  function resetForm() {
    setForm({ name: "", durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 5, priceCents: 0, isActive: true });
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId) {
      await bizFetch(`/api/provider/services/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast({ type: "success", title: "Service updated" });
    } else {
      await bizFetch("/api/provider/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      toast({ type: "success", title: "Service created" });
    }
    resetForm();
    loadServices();
  }

  function startEdit(s: Service) {
    setForm({
      name: s.name,
      durationMin: s.durationMin,
      bufferBeforeMin: s.bufferBeforeMin,
      bufferAfterMin: s.bufferAfterMin,
      priceCents: s.priceCents,
      isActive: s.isActive,
    });
    setEditingId(s.id);
    setShowForm(true);
  }

  async function toggleActive(s: Service) {
    await bizFetch(`/api/provider/services/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    toast({ type: "info", title: s.isActive ? "Service deactivated" : "Service activated" });
    loadServices();
  }

  if (loading) {
    return (
      <div>
        <div className="flex justify-between mb-8">
          <div className="skeleton h-8 w-32" />
          <div className="skeleton h-10 w-32 rounded-[var(--radius-md)]" />
        </div>
        <SkeletonTable rows={5} cols={6} />
      </div>
    );
  }

  return (
    <FadeIn>
      <PageHeader
        title="Services"
        description="Manage your salon service offerings"
        actions={
          <Button onClick={() => { resetForm(); setShowForm(true); }} icon={<Plus className="w-4 h-4" />}>
            Add Service
          </Button>
        }
      />

      {/* Form Modal */}
      <Modal open={showForm} onClose={resetForm} title={editingId ? "Edit Service" : "New Service"} size="md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Service Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            placeholder="e.g. Men's Haircut"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (min)"
              type="number"
              value={form.durationMin}
              onChange={(e) => setForm({ ...form, durationMin: parseInt(e.target.value) || 0 })}
              min={5}
              required
            />
            <Input
              label="Price ($)"
              type="number"
              step="0.01"
              value={(form.priceCents / 100).toFixed(2)}
              onChange={(e) => setForm({ ...form, priceCents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
              min={0}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Buffer Before (min)"
              type="number"
              value={form.bufferBeforeMin}
              onChange={(e) => setForm({ ...form, bufferBeforeMin: parseInt(e.target.value) || 0 })}
              min={0}
            />
            <Input
              label="Buffer After (min)"
              type="number"
              value={form.bufferAfterMin}
              onChange={(e) => setForm({ ...form, bufferAfterMin: parseInt(e.target.value) || 0 })}
              min={0}
            />
          </div>
          <Checkbox
            label="Active"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: (e.target as HTMLInputElement).checked })}
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">{editingId ? "Update" : "Create"} Service</Button>
            <Button type="button" variant="ghost" onClick={resetForm}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {services.length === 0 ? (
        <EmptyState
          title="No services yet"
          description="Add your first service to start accepting bookings."
          action={
            <Button onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
              Add Service
            </Button>
          }
        />
      ) : (
        <Table
          data={services}
          keyField="id"
          columns={[
            {
              key: "name",
              header: "Service",
              render: (s) => (
                <span className={`font-medium ${!s.isActive ? "opacity-50" : ""}`}>{s.name}</span>
              ),
            },
            {
              key: "duration",
              header: "Duration",
              render: (s) => <span className="text-[var(--color-text-secondary)]">{s.durationMin} min</span>,
            },
            {
              key: "buffers",
              header: "Buffers",
              render: (s) => (
                <span className="text-[var(--color-text-tertiary)] text-xs">
                  {s.bufferBeforeMin > 0 ? `${s.bufferBeforeMin}m before` : "–"}
                  {" / "}
                  {s.bufferAfterMin > 0 ? `${s.bufferAfterMin}m after` : "–"}
                </span>
              ),
            },
            {
              key: "price",
              header: "Price",
              render: (s) => (
                <span className="font-medium text-[var(--color-text-primary)]">
                  ${(s.priceCents / 100).toFixed(2)}
                </span>
              ),
            },
            {
              key: "staff",
              header: "Staff",
              render: (s) => <span className="text-[var(--color-text-secondary)]">{s._count?.staffServices ?? 0}</span>,
            },
            {
              key: "status",
              header: "Status",
              render: (s) => (
                <Badge variant={s.isActive ? "success" : "error"}>
                  {s.isActive ? "Active" : "Inactive"}
                </Badge>
              ),
            },
            {
              key: "actions",
              header: "",
              className: "w-24",
              render: (s) => (
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(s); }}
                    className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-text)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                    aria-label="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleActive(s); }}
                    className="p-1.5 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[rgb(var(--color-bg-tertiary))] transition-colors"
                    aria-label={s.isActive ? "Deactivate" : "Activate"}
                  >
                    <Power className="w-3.5 h-3.5" />
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
    </FadeIn>
  );
}
