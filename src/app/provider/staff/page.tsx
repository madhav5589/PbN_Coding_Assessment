"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Power, Wrench } from "lucide-react";
import {
  Button, Card, Input, Modal, Badge, Avatar, PageHeader, Checkbox,
  SkeletonCard, EmptyState, FadeIn, StaggerContainer, StaggerItem, useToast
} from "@/components/ui";
import { bizFetch } from "@/lib/client-fetch";

interface StaffMember {
  id: string;
  name: string;
  isActive: boolean;
  staffServices: { service: { id: string; name: string } }[];
  _count?: { appointments: number };
}

interface Service {
  id: string;
  name: string;
}

export default function ProviderStaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSkills, setEditingSkills] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  async function loadData() {
    const [staffRes, servicesRes] = await Promise.all([
      bizFetch("/api/provider/staff"),
      bizFetch("/api/services"),
    ]);
    const staffData = await staffRes.json();
    const servicesData = await servicesRes.json();
    setStaff(staffData.staff);
    setServices(servicesData.services);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await bizFetch("/api/provider/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    toast({ type: "success", title: "Staff member added" });
    setNewName("");
    setShowForm(false);
    loadData();
  }

  function startEditSkills(s: StaffMember) {
    setEditingSkills(s.id);
    setSelectedServiceIds(s.staffServices.map((ss) => ss.service.id));
  }

  async function saveSkills(staffId: string) {
    await bizFetch(`/api/provider/staff/${staffId}/services`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceIds: selectedServiceIds }),
    });
    toast({ type: "success", title: "Skills updated" });
    setEditingSkills(null);
    loadData();
  }

  async function toggleActive(s: StaffMember) {
    await bizFetch(`/api/provider/staff/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    toast({ type: "info", title: s.isActive ? "Staff deactivated" : "Staff activated" });
    loadData();
  }

  if (loading) {
    return (
      <div>
        <div className="flex justify-between mb-8">
          <div className="skeleton h-8 w-24" />
          <div className="skeleton h-10 w-28 rounded-[var(--radius-md)]" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <FadeIn>
      <PageHeader
        title="Staff"
        description="Manage your team and their service assignments"
        actions={
          <Button onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
            Add Staff
          </Button>
        }
      />

      {/* Create Modal */}
      <Modal open={showForm} onClose={() => { setShowForm(false); setNewName(""); }} title="Add Staff Member" size="sm">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input
            label="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
            placeholder="e.g. Sarah Johnson"
          />
          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">Add Staff</Button>
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Skills Editor Modal */}
      <Modal
        open={!!editingSkills}
        onClose={() => setEditingSkills(null)}
        title={`Assign Services — ${staff.find((s) => s.id === editingSkills)?.name || ""}`}
        size="sm"
      >
        <p className="text-sm text-[var(--color-text-tertiary)] mb-4">
          Select the services this staff member can perform.
        </p>
        <div className="space-y-1 mb-6 -mx-3">
          {services.map((svc) => (
            <Checkbox
              key={svc.id}
              label={svc.name}
              checked={selectedServiceIds.includes(svc.id)}
              onChange={(e) => {
                if ((e.target as HTMLInputElement).checked) {
                  setSelectedServiceIds([...selectedServiceIds, svc.id]);
                } else {
                  setSelectedServiceIds(selectedServiceIds.filter((id) => id !== svc.id));
                }
              }}
            />
          ))}
          {services.length === 0 && (
            <p className="text-sm text-[var(--color-text-tertiary)] px-3">No services available. Create services first.</p>
          )}
        </div>
        <div className="flex gap-3">
          <Button onClick={() => editingSkills && saveSkills(editingSkills)} className="flex-1">Save</Button>
          <Button variant="ghost" onClick={() => setEditingSkills(null)}>Cancel</Button>
        </div>
      </Modal>

      {staff.length === 0 ? (
        <EmptyState
          title="No staff members"
          description="Add your first team member to get started."
          action={
            <Button onClick={() => setShowForm(true)} icon={<Plus className="w-4 h-4" />}>
              Add Staff
            </Button>
          }
        />
      ) : (
        <StaggerContainer className="space-y-4">
          {staff.map((s) => (
            <StaggerItem key={s.id}>
              <Card className={!s.isActive ? "opacity-60" : ""}>
                <div className="flex items-center gap-4">
                  <Avatar name={s.name} size="lg" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{s.name}</h3>
                      <Badge variant={s.isActive ? "success" : "error"} size="sm">
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <span className="text-xs text-[var(--color-text-quaternary)]">
                        {s._count?.appointments ?? 0} appointments
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {s.staffServices.map((ss) => (
                        <Badge key={ss.service.id} variant="default" size="sm">
                          {ss.service.name}
                        </Badge>
                      ))}
                      {s.staffServices.length === 0 && (
                        <span className="text-xs text-[var(--color-text-quaternary)]">No services assigned</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEditSkills(s)}
                      className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-accent-text)] hover:bg-[var(--color-accent-subtle)] transition-colors"
                      aria-label="Edit skills"
                    >
                      <Wrench className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => toggleActive(s)}
                      className="p-2 rounded-[var(--radius-md)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[rgb(var(--color-bg-tertiary))] transition-colors"
                      aria-label={s.isActive ? "Deactivate" : "Activate"}
                    >
                      <Power className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerContainer>
      )}
    </FadeIn>
  );
}
