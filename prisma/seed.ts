import { PrismaClient, AppointmentStatus } from "@prisma/client";

const prisma = new PrismaClient();

function getNextMonday(): Date {
  const now = new Date();
  const day = now.getDay();
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + daysUntilMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function localToUtc(
  seedDate: Date,
  dayOffset: number,
  hours: number,
  minutes: number
): Date {
  // Business timezone is America/Chicago (UTC-5 or UTC-6 depending on DST)
  // For seed data, we calculate UTC from local Chicago time
  const date = new Date(seedDate);
  date.setDate(date.getDate() + dayOffset);

  // Create a date string in Chicago time, then convert to UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const h = String(hours).padStart(2, "0");
  const m = String(minutes).padStart(2, "0");

  // Use Intl to find the offset for Chicago on this date
  const localStr = `${year}-${month}-${day}T${h}:${m}:00`;
  const chicagoDate = new Date(
    new Date(localStr).toLocaleString("en-US", { timeZone: "America/Chicago" })
  );
  const utcDate = new Date(localStr);
  const offset = chicagoDate.getTime() - utcDate.getTime();
  return new Date(new Date(localStr).getTime() - offset);
}

async function main() {
  console.log("🌱 Seeding StyleHub Hair Salon data...\n");

  // Clean existing data
  await prisma.notificationJob.deleteMany();
  await prisma.eventLog.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.timeOff.deleteMany();
  await prisma.blackout.deleteMany();
  await prisma.workingHours.deleteMany();
  await prisma.staffService.deleteMany();
  await prisma.staff.deleteMany();
  await prisma.service.deleteMany();
  await prisma.business.deleteMany();

  // ═══════════════════════════════════════════
  // BUSINESS
  // ═══════════════════════════════════════════
  const business = await prisma.business.create({
    data: {
      name: "StyleHub Hair Salon",
      timezone: "America/Chicago",
      slotIntervalMin: 15,
    },
  });
  console.log(`✅ Business: ${business.name} (${business.id})`);

  // ═══════════════════════════════════════════
  // SERVICES
  // ═══════════════════════════════════════════
  const servicesData = [
    { name: "Men's Haircut", durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 5, priceCents: 3500 },
    { name: "Women's Haircut", durationMin: 45, bufferBeforeMin: 0, bufferAfterMin: 5, priceCents: 5500 },
    { name: "Hair Coloring", durationMin: 90, bufferBeforeMin: 5, bufferAfterMin: 10, priceCents: 12000 },
    { name: "Blowout & Style", durationMin: 30, bufferBeforeMin: 0, bufferAfterMin: 5, priceCents: 4500 },
    { name: "Deep Conditioning", durationMin: 45, bufferBeforeMin: 0, bufferAfterMin: 5, priceCents: 6500 },
    { name: "Beard Trim", durationMin: 15, bufferBeforeMin: 0, bufferAfterMin: 5, priceCents: 2000 },
  ];

  const services: Record<string, string> = {};
  for (const s of servicesData) {
    const service = await prisma.service.create({
      data: { ...s, businessId: business.id },
    });
    services[s.name] = service.id;
    console.log(`  📋 Service: ${s.name} (${s.durationMin}min, $${(s.priceCents / 100).toFixed(2)})`);
  }

  // ═══════════════════════════════════════════
  // STAFF
  // ═══════════════════════════════════════════
  const staffData = [
    { name: "Alex Rivera" },
    { name: "Jordan Lee" },
    { name: "Taylor Kim" },
    { name: "Morgan Chen" },
  ];

  const staffMembers: Record<string, string> = {};
  for (const s of staffData) {
    const staff = await prisma.staff.create({
      data: { ...s, businessId: business.id },
    });
    staffMembers[s.name] = staff.id;
    console.log(`  👤 Staff: ${s.name}`);
  }

  // ═══════════════════════════════════════════
  // STAFF-SERVICE MAPPING
  // ═══════════════════════════════════════════
  const skillMap: Record<string, string[]> = {
    "Alex Rivera": ["Men's Haircut", "Women's Haircut", "Hair Coloring", "Blowout & Style", "Deep Conditioning", "Beard Trim"],
    "Jordan Lee": ["Men's Haircut", "Beard Trim", "Blowout & Style"],
    "Taylor Kim": ["Women's Haircut", "Hair Coloring", "Blowout & Style", "Deep Conditioning"],
    "Morgan Chen": ["Men's Haircut", "Women's Haircut", "Blowout & Style", "Beard Trim"],
  };

  for (const [staffName, serviceNames] of Object.entries(skillMap)) {
    for (const serviceName of serviceNames) {
      await prisma.staffService.create({
        data: {
          staffId: staffMembers[staffName],
          serviceId: services[serviceName],
        },
      });
    }
    console.log(`  🔗 ${staffName} → ${serviceNames.join(", ")}`);
  }

  // ═══════════════════════════════════════════
  // WORKING HOURS
  // ═══════════════════════════════════════════
  // Alex: Mon-Fri 9:00-17:00
  for (let day = 1; day <= 5; day++) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Alex Rivera"],
        dayOfWeek: day,
        startTimeLocal: "09:00",
        endTimeLocal: "17:00",
      },
    });
  }
  // Alex: Sat/Sun closed
  for (const day of [0, 6]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Alex Rivera"],
        dayOfWeek: day,
        startTimeLocal: "09:00",
        endTimeLocal: "17:00",
        isClosed: true,
      },
    });
  }
  console.log("  📅 Alex Rivera: Mon-Fri 9-5, lunch 12-1");

  // Jordan: Mon,Tue,Thu,Fri 10:00-18:00; Wed OFF
  for (const day of [1, 2, 4, 5]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Jordan Lee"],
        dayOfWeek: day,
        startTimeLocal: "10:00",
        endTimeLocal: "18:00",
      },
    });
  }
  for (const day of [0, 3, 6]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Jordan Lee"],
        dayOfWeek: day,
        startTimeLocal: "10:00",
        endTimeLocal: "18:00",
        isClosed: true,
      },
    });
  }
  console.log("  📅 Jordan Lee: Mon,Tue,Thu,Fri 10-6; Wed OFF");

  // Taylor: Tue-Sat 9:00-17:00; Mon OFF
  for (const day of [2, 3, 4, 5, 6]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Taylor Kim"],
        dayOfWeek: day,
        startTimeLocal: "09:00",
        endTimeLocal: "17:00",
      },
    });
  }
  for (const day of [0, 1]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Taylor Kim"],
        dayOfWeek: day,
        startTimeLocal: "09:00",
        endTimeLocal: "17:00",
        isClosed: true,
      },
    });
  }
  console.log("  📅 Taylor Kim: Tue-Sat 9-5; Mon OFF");

  // Morgan: Mon,Wed,Fri 11:00-17:00 (part-time)
  for (const day of [1, 3, 5]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Morgan Chen"],
        dayOfWeek: day,
        startTimeLocal: "11:00",
        endTimeLocal: "17:00",
      },
    });
  }
  for (const day of [0, 2, 4, 6]) {
    await prisma.workingHours.create({
      data: {
        staffId: staffMembers["Morgan Chen"],
        dayOfWeek: day,
        startTimeLocal: "11:00",
        endTimeLocal: "17:00",
        isClosed: true,
      },
    });
  }
  console.log("  📅 Morgan Chen: Mon,Wed,Fri 11-5 (part-time)");

  // ═══════════════════════════════════════════
  // TIME-OFF (represented as breaks too, since we use same model)
  // ═══════════════════════════════════════════
  const seedDate = getNextMonday();

  // Alex: lunch break Mon-Fri 12:00-13:00 (create for seed week days)
  for (let dayOff = 0; dayOff < 5; dayOff++) {
    await prisma.timeOff.create({
      data: {
        staffId: staffMembers["Alex Rivera"],
        startAt: localToUtc(seedDate, dayOff, 12, 0),
        endAt: localToUtc(seedDate, dayOff, 13, 0),
        reason: "Lunch break",
      },
    });
  }

  // Jordan: lunch break 13:00-14:00
  for (const dayOff of [0, 1, 3, 4]) {
    await prisma.timeOff.create({
      data: {
        staffId: staffMembers["Jordan Lee"],
        startAt: localToUtc(seedDate, dayOff, 13, 0),
        endAt: localToUtc(seedDate, dayOff, 14, 0),
        reason: "Lunch break",
      },
    });
  }

  // Taylor: lunch break 12:00-12:30
  for (const dayOff of [1, 2, 3, 4, 5]) {
    await prisma.timeOff.create({
      data: {
        staffId: staffMembers["Taylor Kim"],
        startAt: localToUtc(seedDate, dayOff, 12, 0),
        endAt: localToUtc(seedDate, dayOff, 12, 30),
        reason: "Lunch break",
      },
    });
  }

  // Taylor: Full day off on seed_date+2 (Wednesday)
  await prisma.timeOff.create({
    data: {
      staffId: staffMembers["Taylor Kim"],
      startAt: localToUtc(seedDate, 2, 0, 0),
      endAt: localToUtc(seedDate, 2, 23, 59),
      reason: "Personal day",
    },
  });
  console.log("  🏖️  Taylor Kim: Day off on Wednesday");

  // Alex: Time off seed_date+5 afternoon (Saturday? No, +5 from Monday = Saturday, but Alex is off Sat)
  // Let's make it seed_date+4 (Friday) afternoon
  await prisma.timeOff.create({
    data: {
      staffId: staffMembers["Alex Rivera"],
      startAt: localToUtc(seedDate, 4, 13, 0),
      endAt: localToUtc(seedDate, 4, 17, 0),
      reason: "Doctor appointment",
    },
  });
  console.log("  🏖️  Alex Rivera: Friday afternoon off (doctor)");

  // ═══════════════════════════════════════════
  // BLACKOUT DATE
  // ═══════════════════════════════════════════
  // Business closed seed_date+6 (Sunday)
  await prisma.blackout.create({
    data: {
      businessId: business.id,
      startAt: localToUtc(seedDate, 6, 0, 0),
      endAt: localToUtc(seedDate, 6, 23, 59),
      reason: "Holiday closure",
    },
  });
  console.log("  🚫 Business blackout: Sunday (Holiday closure)");

  // ═══════════════════════════════════════════
  // APPOINTMENTS (pre-booked for conflict demo)
  // ═══════════════════════════════════════════
  const appointments = [
    // Day 0 (Monday)
    { day: 0, startH: 9, startM: 0, staff: "Alex Rivera", service: "Men's Haircut", customer: "John Smith", email: "john@example.com" },
    { day: 0, startH: 10, startM: 0, staff: "Alex Rivera", service: "Women's Haircut", customer: "Sarah Johnson", email: "sarah@example.com" },
    { day: 0, startH: 14, startM: 0, staff: "Alex Rivera", service: "Hair Coloring", customer: "Emily Davis", email: "emily@example.com" },
    { day: 0, startH: 10, startM: 0, staff: "Jordan Lee", service: "Men's Haircut", customer: "Mike Wilson", email: "mike@example.com" },
    { day: 0, startH: 11, startM: 0, staff: "Jordan Lee", service: "Blowout & Style", customer: "Lisa Brown", email: "lisa@example.com" },
    // Day 1 (Tuesday)
    { day: 1, startH: 9, startM: 0, staff: "Taylor Kim", service: "Women's Haircut", customer: "Amy White", email: "amy@example.com" },
    { day: 1, startH: 10, startM: 0, staff: "Taylor Kim", service: "Hair Coloring", customer: "Rachel Green", email: "rachel@example.com" },
    { day: 1, startH: 13, startM: 0, staff: "Taylor Kim", service: "Deep Conditioning", customer: "Monica Geller", email: "monica@example.com" },
    { day: 1, startH: 14, startM: 0, staff: "Alex Rivera", service: "Men's Haircut", customer: "Ross Geller", email: "ross@example.com" },
    // Day 2 (Wednesday) — Morgan works
    { day: 2, startH: 11, startM: 0, staff: "Morgan Chen", service: "Men's Haircut", customer: "Joey Tribbiani", email: "joey@example.com" },
    { day: 2, startH: 15, startM: 0, staff: "Morgan Chen", service: "Blowout & Style", customer: "Phoebe Buffay", email: "phoebe@example.com" },
    // Day 3 (Thursday) — cancelled appointment
    { day: 3, startH: 9, startM: 0, staff: "Alex Rivera", service: "Women's Haircut", customer: "Chandler Bing", email: "chandler@example.com", status: "CANCELLED" as const },
    { day: 3, startH: 10, startM: 0, staff: "Jordan Lee", service: "Beard Trim", customer: "Janice Litman", email: "janice@example.com" },
    // Day 4 (Friday)
    { day: 4, startH: 9, startM: 0, staff: "Alex Rivera", service: "Men's Haircut", customer: "Gunther Central", email: "gunther@example.com" },
    { day: 4, startH: 11, startM: 0, staff: "Morgan Chen", service: "Beard Trim", customer: "Richard Burke", email: "richard@example.com" },
  ];

  for (const appt of appointments) {
    const serviceName = appt.service;
    const serviceEntry = servicesData.find((s) => s.name === serviceName)!;
    const totalMin = serviceEntry.bufferBeforeMin + serviceEntry.durationMin + serviceEntry.bufferAfterMin;

    const startAt = localToUtc(seedDate, appt.day, appt.startH, appt.startM);
    const endAt = new Date(startAt.getTime() + totalMin * 60 * 1000);

    await prisma.appointment.create({
      data: {
        businessId: business.id,
        serviceId: services[serviceName],
        staffId: staffMembers[appt.staff],
        customerName: appt.customer,
        customerEmail: appt.email,
        startAt,
        endAt,
        status: (appt as any).status === "CANCELLED" ? AppointmentStatus.CANCELLED : AppointmentStatus.BOOKED,
        notes: "",
      },
    });
    console.log(
      `  📌 Appt: ${appt.customer} → ${appt.service} with ${appt.staff} (Day+${appt.day} ${appt.startH}:${String(appt.startM).padStart(2, "0")})${(appt as any).status === "CANCELLED" ? " [CANCELLED]" : ""}`
    );
  }

  console.log("\n✅ Seed complete!");
  console.log(`   Business: ${business.name} (ID: ${business.id})`);
  console.log(`   Services: ${Object.keys(services).length}`);
  console.log(`   Staff: ${Object.keys(staffMembers).length}`);
  console.log(`   Appointments: ${appointments.length}`);
  console.log(`   Seed week starts: ${seedDate.toISOString().split("T")[0]} (next Monday)`);
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
