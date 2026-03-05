import { z } from "zod";

// ─── Common ──────────────────────────────────────────────
export const DateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
export const TimeString = z.string().regex(/^\d{2}:\d{2}$/, "Must be HH:MM");
export const UuidString = z.string().uuid();

// ─── Service ─────────────────────────────────────────────
export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(100),
  durationMin: z.number().int().min(5).max(480),
  bufferBeforeMin: z.number().int().min(0).max(60).default(0),
  bufferAfterMin: z.number().int().min(0).max(60).default(0),
  priceCents: z.number().int().min(0),
  isActive: z.boolean().default(true),
});
export type CreateServiceInput = z.infer<typeof CreateServiceSchema>;

export const UpdateServiceSchema = CreateServiceSchema.partial();
export type UpdateServiceInput = z.infer<typeof UpdateServiceSchema>;

// ─── Staff ───────────────────────────────────────────────
export const CreateStaffSchema = z.object({
  name: z.string().min(1).max(100),
  isActive: z.boolean().default(true),
});
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

export const UpdateStaffSchema = CreateStaffSchema.partial();
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;

export const UpdateStaffServicesSchema = z.object({
  serviceIds: z.array(z.string().uuid()),
});
export type UpdateStaffServicesInput = z.infer<typeof UpdateStaffServicesSchema>;

// ─── Working Hours ───────────────────────────────────────
export const WorkingHoursEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTimeLocal: TimeString,
  endTimeLocal: TimeString,
  isClosed: z.boolean().default(false),
});

export const UpdateWorkingHoursSchema = z.object({
  hours: z.array(WorkingHoursEntrySchema),
});
export type UpdateWorkingHoursInput = z.infer<typeof UpdateWorkingHoursSchema>;

// ─── Time Off ────────────────────────────────────────────
export const CreateTimeOffSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(500).default(""),
});
export type CreateTimeOffInput = z.infer<typeof CreateTimeOffSchema>;

// ─── Blackout ────────────────────────────────────────────
export const CreateBlackoutSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  reason: z.string().max(500).default(""),
});
export type CreateBlackoutInput = z.infer<typeof CreateBlackoutSchema>;

// ─── Availability ────────────────────────────────────────
export const AvailabilityQuerySchema = z.object({
  serviceId: z.string().uuid(),
  date: DateString,
  staffId: z.string().uuid().optional(),
});
export type AvailabilityQuery = z.infer<typeof AvailabilityQuerySchema>;

// ─── Booking ─────────────────────────────────────────────
export const BookingSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid(),
  date: DateString,
  startTime: TimeString,
  customerName: z.string().min(1).max(200),
  customerEmail: z.string().email().max(300),
  customerPhone: z.string().max(30).default(""),
  notes: z.string().max(1000).default(""),
  idempotencyKey: z.string().uuid().optional(),
});
export type BookingInput = z.infer<typeof BookingSchema>;

// ─── Appointment Actions ─────────────────────────────────
export const CancelAppointmentSchema = z.object({
  reason: z.string().max(500).default(""),
});
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentSchema>;

export const RescheduleAppointmentSchema = z.object({
  date: DateString,
  startTime: TimeString,
  staffId: z.string().uuid().optional(),
});
export type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentSchema>;

export const UpdateNotesSchema = z.object({
  notes: z.string().max(1000),
});
export type UpdateNotesInput = z.infer<typeof UpdateNotesSchema>;

// ─── API Response Types ──────────────────────────────────
export interface SlotInfo {
  startTime: string; // "09:00"
  endTime: string;   // "09:45"
  staffId: string;
  staffName: string;
}

export interface AvailabilityResponse {
  date: string;
  serviceId: string;
  slots: SlotInfo[];
}

export type BookingErrorCode =
  | "SLOT_TAKEN"
  | "INVALID_INPUT"
  | "OUTSIDE_HOURS"
  | "STAFF_UNAVAILABLE"
  | "SERVICE_NOT_FOUND"
  | "DUPLICATE_BOOKING";
