# Demo Script

## Prerequisites
- Docker running
- App started (`npm run dev`)
- Database seeded (`npx prisma db seed`)

## Demo Flow

### Part 1: Provider Journey (10 min)
1. **Login** → Navigate to `/provider`
2. **Services** → Show service list with durations, buffers, pricing
3. **Staff** → Show staff roster with skill assignments
4. **Schedules** → Show weekly schedule editor, breaks, time-off
5. **Calendar** → Show day/week view with existing appointments
6. **Manage** → Cancel an appointment, show slot becomes available

### Part 2: Customer Journey (10 min)
1. **Browse** → Navigate to `/book`, see service catalog
2. **Pick service** → Select a service, see details
3. **Pick date** → Choose a date with known conflicts
4. **See slots** → Demonstrate that conflicted slots are filtered out
5. **Book** → Fill in details, submit booking
6. **Confirmation** → Show confirmation page + notification logged

### Part 3: System Robustness (5 min)
1. **Double booking prevention** → Try to book same slot twice
2. **Schedule changes** → Modify staff hours, show availability updates
3. **Cancellation** → Cancel appointment, show slot freed up

## Key Talking Points
- UTC storage + timezone-aware display
- Transactional booking with conflict checks
- Real-time availability computation
- Redis caching with proper invalidation
- Production-grade data model
