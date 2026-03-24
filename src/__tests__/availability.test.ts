/**
 * Unit tests for the availability engine (src/lib/availability.ts).
 *
 * Prisma is mocked throughout — these tests validate scheduling logic, not
 * database behaviour. The mock return values simulate what the database would
 * return for each scenario.
 *
 * Coverage areas:
 *  1. Double-booking prevention
 *  2. Timezone edge cases
 *  3. Buffer time enforcement
 *  4. Blackout handling
 *  5. Cancelled-appointment slot recovery
 *  6. Multi-tenant isolation
 */

import { computeAvailability, type AvailabilityOptions } from "@/lib/availability";
import { prisma } from "@/lib/prisma";
import { AppointmentStatus } from "@prisma/client";
import { localToUtc } from "@/lib/timezone";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

jest.mock("@/lib/prisma", () => ({
  prisma: {
    service: { findFirst: jest.fn() },
    blackout: { findMany: jest.fn() },
    staffService: { findMany: jest.fn() },
    appointment: { findMany: jest.fn() },
  },
}));

// Typed handles to the mock functions for easy setup in each test.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockService = (prisma.service as any).findFirst as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockBlackout = (prisma.blackout as any).findMany as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockStaffService = (prisma.staffService as any).findMany as jest.Mock;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockAppointment = (prisma.appointment as any).findMany as jest.Mock;

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal Business record sufficient for the availability engine. */
function makeBusiness(overrides: {
  id?: string;
  timezone?: string;
  slotIntervalMin?: number;
} = {}) {
  return {
    id: "biz-a",
    name: "Test Business",
    timezone: "UTC",
    slotIntervalMin: 60,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/** Service with no buffers and a 60-minute duration by default. */
function makeService(overrides: {
  id?: string;
  businessId?: string;
  durationMin?: number;
  bufferBeforeMin?: number;
  bufferAfterMin?: number;
} = {}) {
  return {
    id: "svc-1",
    businessId: "biz-a",
    name: "Haircut",
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    priceCents: 5000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * A StaffService link shaped to match the nested include from
 * prisma.staffService.findMany({ include: { staff: { include: { ... } } } }).
 */
function makeStaffLink(overrides: {
  staffId?: string;
  staffName?: string;
  businessId?: string;
  workStart?: string;
  workEnd?: string;
  dayOfWeek?: number;
  isClosed?: boolean;
  timeOffs?: Array<{ startAt: Date; endAt: Date }>;
} = {}) {
  const {
    staffId = "staff-1",
    staffName = "Alice",
    businessId = "biz-a",
    workStart = "09:00",
    workEnd = "17:00",
    dayOfWeek = 1, // Monday — matches TEST_DATE 2026-03-23
    isClosed = false,
    timeOffs = [],
  } = overrides;

  return {
    id: `${staffId}-link`,
    staffId,
    serviceId: "svc-1",
    proficiencyLevel: 1,
    staff: {
      id: staffId,
      businessId,
      name: staffName,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      workingHours: [
        {
          id: "wh-1",
          staffId,
          dayOfWeek,
          startTimeLocal: workStart,
          endTimeLocal: workEnd,
          isClosed,
        },
      ],
      timeOffs: timeOffs.map((to, i) => ({
        id: `to-${i}`,
        staffId,
        startAt: to.startAt,
        endAt: to.endAt,
        reason: "",
        createdAt: new Date(),
      })),
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// 2026-03-23 is a Monday (dayOfWeek = 1) — matches makeStaffLink's default.
const TEST_DATE = "2026-03-23";

/** Create a UTC Date from a time string on the given date (default: TEST_DATE). */
function utcAt(timeStr: string, date = TEST_DATE): Date {
  return new Date(`${date}T${timeStr}:00.000Z`);
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Double-booking prevention
// ─────────────────────────────────────────────────────────────────────────────

describe("double-booking prevention", () => {
  it("excludes a slot that overlaps with an existing BOOKED appointment", async () => {
    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    // Staff has a BOOKED appointment from 10:00–11:00 UTC.
    mockAppointment.mockResolvedValue([
      { staffId: "staff-1", startAt: utcAt("10:00"), endAt: utcAt("11:00") },
    ]);

    const slots = await computeAvailability({
      business: makeBusiness(),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    expect(times).not.toContain("10:00"); // booked
    expect(times).toContain("09:00");     // free before
    expect(times).toContain("11:00");     // free after
  });

  it("shows all slots as available when there are no existing appointments", async () => {
    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    mockAppointment.mockResolvedValue([]); // no bookings

    const slots = await computeAvailability({
      business: makeBusiness(),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    // With 60-min slots from 09:00–17:00 and 60-min interval, expect 8 slots.
    expect(times).toHaveLength(8);
    expect(times).toContain("09:00");
    expect(times).toContain("10:00");
    expect(times).toContain("16:00");
  });

  it("blocks all overlapping slots when multiple appointments are booked", async () => {
    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    // Two booked slots: 09:00–10:00 and 14:00–15:00.
    mockAppointment.mockResolvedValue([
      { staffId: "staff-1", startAt: utcAt("09:00"), endAt: utcAt("10:00") },
      { staffId: "staff-1", startAt: utcAt("14:00"), endAt: utcAt("15:00") },
    ]);

    const slots = await computeAvailability({
      business: makeBusiness(),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    expect(times).not.toContain("09:00");
    expect(times).not.toContain("14:00");
    expect(times).toContain("10:00");
    expect(times).toContain("11:00");
    expect(times).toContain("15:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Timezone edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("timezone edge cases", () => {
  it("converts UTC appointment timestamps to business-local time for slot blocking", async () => {
    // Business is in America/Chicago (UTC-6 in January, standard time).
    // Staff works 09:00–11:00 CST (2 one-hour slots).
    // We add a BOOKED appointment at 10:00 CST (= 16:00 UTC).
    // The slot at 10:00 must be blocked; 09:00 must be free.
    const WINTER_DATE = "2026-01-15"; // Thursday — dayOfWeek = 4
    const THURSDAY = 4;

    const business = makeBusiness({
      id: "biz-chicago",
      timezone: "America/Chicago",
      slotIntervalMin: 60,
    });

    mockService.mockResolvedValue(makeService({ businessId: "biz-chicago" }));
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([
      makeStaffLink({
        staffId: "staff-tz",
        businessId: "biz-chicago",
        workStart: "09:00",
        workEnd: "11:00",
        dayOfWeek: THURSDAY,
      }),
    ]);
    // Appointment at 10:00 CST = 16:00 UTC (UTC-6 in January).
    mockAppointment.mockResolvedValue([
      {
        staffId: "staff-tz",
        startAt: localToUtc(WINTER_DATE, "10:00", "America/Chicago"),
        endAt: localToUtc(WINTER_DATE, "11:00", "America/Chicago"),
      },
    ]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: WINTER_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    expect(times).toContain("09:00");     // available
    expect(times).not.toContain("10:00"); // booked in CST
    expect(times).toHaveLength(1);
  });

  it("generates slots in business-local time for a UTC+5:30 business (no DST)", async () => {
    // Asia/Kolkata never observes DST. Staff works 09:00–11:00 IST.
    // The engine must use IST boundaries (not UTC) — expect 2 one-hour slots.
    const IST_DATE = "2026-03-23"; // Monday
    const business = makeBusiness({
      id: "biz-ist",
      timezone: "Asia/Kolkata",
      slotIntervalMin: 60,
    });

    mockService.mockResolvedValue(makeService({ businessId: "biz-ist" }));
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([
      makeStaffLink({
        staffId: "staff-ist",
        businessId: "biz-ist",
        workStart: "09:00",
        workEnd: "11:00",
        dayOfWeek: 1,
      }),
    ]);
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: IST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    // 09:00 IST and 10:00 IST — exactly 2 slots in a 2-hour window.
    expect(times).toContain("09:00");
    expect(times).toContain("10:00");
    expect(times).toHaveLength(2);
  });

  it("correctly computes day-of-week from the calendar date, not the server timezone", async () => {
    // getDayOfWeek uses Date.UTC arithmetic pinned to noon — the result must be
    // the same regardless of what TZ the Node.js process is running in.
    // 2026-03-23 is a Monday (1) everywhere on Earth.
    // We configure working hours for dayOfWeek=1 and verify slots are generated.
    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink({ dayOfWeek: 1 })]);
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business: makeBusiness(),
      serviceId: "svc-1",
      date: "2026-03-23", // Monday
    } as AvailabilityOptions);

    expect(slots.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Buffer time enforcement
// ─────────────────────────────────────────────────────────────────────────────

describe("buffer time enforcement", () => {
  it("blocks intermediate slots when they would overlap with a booking's buffer window", async () => {
    // Service: 30 min + 15 before + 15 after = 60 min total.
    // Slot interval: 15 min. Staff works 09:00–12:00.
    // Existing appointment occupies 09:00–10:00 (full 60-min total incl. buffers).
    // Any slot starting from 09:01 through 09:59 needs to reach past 10:00
    // and therefore overlaps. First safe slot is 10:00.
    const business = makeBusiness({ slotIntervalMin: 15 });
    const service = makeService({ durationMin: 30, bufferBeforeMin: 15, bufferAfterMin: 15 });

    mockService.mockResolvedValue(service);
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([
      makeStaffLink({ workStart: "09:00", workEnd: "12:00" }),
    ]);
    // Appointment occupies 09:00–10:00 (total 60 min, including buffers).
    mockAppointment.mockResolvedValue([
      { staffId: "staff-1", startAt: utcAt("09:00"), endAt: utcAt("10:00") },
    ]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    // All slots overlapping with the 09:00–10:00 buffer window are blocked.
    expect(times).not.toContain("09:00");
    expect(times).not.toContain("09:15");
    expect(times).not.toContain("09:30");
    expect(times).not.toContain("09:45");
    // 10:00 starts at exactly where the buffer ends — no overlap (half-open interval).
    expect(times).toContain("10:00");
    expect(times).toContain("10:15");
    expect(times).toContain("10:30");
    expect(times).toContain("10:45");
  });

  it("allows the slot that starts at exactly the end of a buffer (half-open interval)", async () => {
    // Slot {600, 660} vs appointment {540, 600}: rangesOverlap = 600 < 600 → false.
    // The half-open interval means the boundary minute belongs to the next slot.
    const business = makeBusiness({ slotIntervalMin: 60 });
    const service = makeService({ durationMin: 60 });

    mockService.mockResolvedValue(service);
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    // Appointment ends at exactly 10:00.
    mockAppointment.mockResolvedValue([
      { staffId: "staff-1", startAt: utcAt("09:00"), endAt: utcAt("10:00") },
    ]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    expect(times).not.toContain("09:00"); // booked
    expect(times).toContain("10:00");     // immediately adjacent — must be available
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Blackout handling
// ─────────────────────────────────────────────────────────────────────────────

describe("blackout handling", () => {
  it("blocks all slots that overlap with a business blackout window", async () => {
    // Blackout 11:00–14:00 UTC. Slot interval 30 min, service 60 min.
    // Expected: slots ending exactly at 11:00 are safe; slots starting < 14:00
    // and ending > 11:00 are blocked.
    const business = makeBusiness({ slotIntervalMin: 30 });
    const service = makeService({ durationMin: 60 });

    mockService.mockResolvedValue(service);
    mockBlackout.mockResolvedValue([
      {
        id: "bo-1",
        businessId: "biz-a",
        startAt: utcAt("11:00"),
        endAt: utcAt("14:00"),
        reason: "Maintenance",
        createdAt: new Date(),
      },
    ]);
    mockStaffService.mockResolvedValue([
      makeStaffLink({ workStart: "09:00", workEnd: "17:00" }),
    ]);
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    // Before blackout — available.
    expect(times).toContain("09:00");
    expect(times).toContain("09:30");
    // 10:00 slot spans 10:00–11:00; ends exactly at blackout start — no overlap.
    expect(times).toContain("10:00");
    // 10:30 slot spans 10:30–11:30; overlaps blackout (11:00–14:00).
    expect(times).not.toContain("10:30");
    // Slots inside the blackout.
    expect(times).not.toContain("11:00");
    expect(times).not.toContain("12:00");
    expect(times).not.toContain("13:00");
    // 14:00 slot spans 14:00–15:00; starts exactly at blackout end — no overlap.
    expect(times).toContain("14:00");
    expect(times).toContain("15:00");
  });

  it("returns no slots when a full-day blackout triggers the early-exit path", async () => {
    // A blackout spanning 00:00–23:59 local has r.start=0, r.end=1439.
    // The engine early-exits before even querying staff.
    const business = makeBusiness({ slotIntervalMin: 60 });

    mockService.mockResolvedValue(makeService());
    // Blackout covers the entire local day (UTC for this UTC-timezone business).
    mockBlackout.mockResolvedValue([
      {
        id: "bo-full",
        businessId: "biz-a",
        startAt: new Date("2026-03-23T00:00:00Z"), // local midnight
        endAt: new Date("2026-03-23T23:59:00Z"),   // 23:59 local
        reason: "Holiday",
        createdAt: new Date(),
      },
    ]);
    // These should not be called due to early exit.
    mockStaffService.mockResolvedValue([]);
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    expect(slots).toHaveLength(0);
  });

  it("applies staff time-off as a blocked range alongside blackouts", async () => {
    // Staff is on time-off 12:00–13:00 and there is a blackout 15:00–16:00.
    // Both windows must be blocked independently.
    const business = makeBusiness({ slotIntervalMin: 60 });

    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([
      {
        id: "bo-2",
        businessId: "biz-a",
        startAt: utcAt("15:00"),
        endAt: utcAt("16:00"),
        reason: "",
        createdAt: new Date(),
      },
    ]);
    mockStaffService.mockResolvedValue([
      makeStaffLink({
        timeOffs: [{ startAt: utcAt("12:00"), endAt: utcAt("13:00") }],
      }),
    ]);
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    expect(times).toContain("09:00");
    expect(times).toContain("11:00");
    expect(times).not.toContain("12:00"); // time-off
    expect(times).toContain("13:00");
    expect(times).toContain("14:00");
    expect(times).not.toContain("15:00"); // blackout
    expect(times).toContain("16:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Cancelled-appointment slot recovery
// ─────────────────────────────────────────────────────────────────────────────

describe("cancelled-appointment slot recovery", () => {
  it("makes a slot available after its appointment is cancelled", async () => {
    // After cancellation, the DB returns [] for status=BOOKED in that window.
    // The slot must therefore show as free.
    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    // Simulates DB returning no BOOKED appointments (cancelled one is excluded).
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business: makeBusiness(),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    const times = slots.map((s) => s.startTime);
    expect(times).toContain("10:00"); // slot recovered after cancellation
  });

  it("queries the database for BOOKED status only, not CANCELLED or COMPLETED", async () => {
    // Verifies the engine doesn't consider cancelled/completed appointments
    // as blockers — they must be filtered out at the DB query level.
    mockService.mockResolvedValue(makeService());
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    mockAppointment.mockResolvedValue([]);

    await computeAvailability({
      business: makeBusiness(),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    expect(mockAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: AppointmentStatus.BOOKED,
        }),
      })
    );
  });

  it("contrast: shows slot as blocked before cancellation, free after", async () => {
    const business = makeBusiness();
    const service = makeService();
    const staffLink = makeStaffLink();
    const appointment = { staffId: "staff-1", startAt: utcAt("10:00"), endAt: utcAt("11:00") };

    // Before cancellation: appointment is BOOKED → slot blocked.
    mockService.mockResolvedValue(service);
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([staffLink]);
    mockAppointment.mockResolvedValue([appointment]);

    const slotsBefore = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);
    expect(slotsBefore.map((s) => s.startTime)).not.toContain("10:00");

    // After cancellation: appointment is CANCELLED → DB returns [] for BOOKED.
    jest.clearAllMocks();
    mockService.mockResolvedValue(service);
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([staffLink]);
    mockAppointment.mockResolvedValue([]); // no BOOKED appointments

    const slotsAfter = await computeAvailability({
      business,
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);
    expect(slotsAfter.map((s) => s.startTime)).toContain("10:00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Multi-tenant isolation
// ─────────────────────────────────────────────────────────────────────────────

describe("multi-tenant isolation", () => {
  it("returns no slots when the service does not belong to the requesting business", async () => {
    // The service query includes businessId in the where clause. If it returns
    // null (service belongs to another tenant), the engine returns [].
    mockService.mockResolvedValue(null); // foreign serviceId → not found for this tenant
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([]);
    mockAppointment.mockResolvedValue([]);

    const slots = await computeAvailability({
      business: makeBusiness({ id: "biz-a" }),
      serviceId: "svc-foreign",
      date: TEST_DATE,
    } as AvailabilityOptions);

    expect(slots).toHaveLength(0);
  });

  it("passes businessId in the service lookup query", async () => {
    mockService.mockResolvedValue(null);
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([]);
    mockAppointment.mockResolvedValue([]);

    await computeAvailability({
      business: makeBusiness({ id: "biz-a" }),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    // The engine must scope the service lookup to the tenant's businessId.
    expect(mockService).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: "biz-a" }),
      })
    );
  });

  it("passes businessId in the staff lookup query to prevent cross-tenant staff leaks", async () => {
    mockService.mockResolvedValue(makeService({ businessId: "biz-a" }));
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([]);
    mockAppointment.mockResolvedValue([]);

    await computeAvailability({
      business: makeBusiness({ id: "biz-a" }),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    // Staff lookup must be constrained to this business — prevents Business B's
    // staff from appearing in Business A's availability.
    expect(mockStaffService).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          staff: expect.objectContaining({ businessId: "biz-a" }),
        }),
      })
    );
  });

  it("passes businessId in the blackout query to prevent cross-tenant blackout leaks", async () => {
    mockService.mockResolvedValue(makeService({ businessId: "biz-a" }));
    mockBlackout.mockResolvedValue([]);
    mockStaffService.mockResolvedValue([makeStaffLink()]);
    mockAppointment.mockResolvedValue([]);

    await computeAvailability({
      business: makeBusiness({ id: "biz-a" }),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    expect(mockBlackout).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: "biz-a" }),
      })
    );
  });

  it("produces independent results for two businesses sharing the same service ID", async () => {
    // Business A has normal availability; Business B has a full-day blackout.
    // Neither business's data should bleed into the other's result.
    const serviceA = makeService({ businessId: "biz-a" });
    const serviceB = makeService({ businessId: "biz-b" });
    const staffA = makeStaffLink({ staffId: "alice", staffName: "Alice", businessId: "biz-a" });
    const staffB = makeStaffLink({ staffId: "bob", staffName: "Bob", businessId: "biz-b" });

    // Call for Business A — no blackout.
    mockService.mockResolvedValueOnce(serviceA);
    mockBlackout.mockResolvedValueOnce([]);
    mockStaffService.mockResolvedValueOnce([staffA]);
    mockAppointment.mockResolvedValueOnce([]);

    const slotsA = await computeAvailability({
      business: makeBusiness({ id: "biz-a" }),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    // Call for Business B — full-day blackout.
    mockService.mockResolvedValueOnce(serviceB);
    mockBlackout.mockResolvedValueOnce([
      {
        id: "bo-b",
        businessId: "biz-b",
        startAt: new Date("2026-03-23T00:00:00Z"),
        endAt: new Date("2026-03-23T23:59:00Z"),
        reason: "Closed",
        createdAt: new Date(),
      },
    ]);
    mockStaffService.mockResolvedValueOnce([staffB]);
    mockAppointment.mockResolvedValueOnce([]);

    const slotsB = await computeAvailability({
      business: makeBusiness({ id: "biz-b" }),
      serviceId: "svc-1",
      date: TEST_DATE,
    } as AvailabilityOptions);

    // Business A has slots; Business B is fully blacked out.
    expect(slotsA.length).toBeGreaterThan(0);
    expect(slotsB).toHaveLength(0);

    // Business A's slots only reference Business A's staff.
    expect(slotsA.every((s) => s.staffId === "alice")).toBe(true);
  });
});
