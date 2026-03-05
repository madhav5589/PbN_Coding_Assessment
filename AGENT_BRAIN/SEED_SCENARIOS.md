# Seed Scenarios

## Business
- **StyleHub Hair Salon** — timezone: America/Chicago, 15-min slot intervals

## Services (6)
| Service | Duration | Buffer Before | Buffer After | Price |
|---------|----------|---------------|--------------|-------|
| Men's Haircut | 30 min | 0 | 5 min | $35 |
| Women's Haircut | 45 min | 0 | 5 min | $55 |
| Hair Coloring | 90 min | 5 min | 10 min | $120 |
| Blowout & Style | 30 min | 0 | 5 min | $45 |
| Deep Conditioning | 45 min | 0 | 5 min | $65 |
| Beard Trim | 15 min | 0 | 5 min | $20 |

## Staff (4)
| Staff | Skills | Notes |
|-------|--------|-------|
| Alex Rivera | All services | Senior stylist, full schedule |
| Jordan Lee | Men's Haircut, Beard Trim, Blowout | Barber specialist |
| Taylor Kim | Women's Haircut, Hair Coloring, Blowout, Deep Conditioning | Color specialist |
| Morgan Chen | Men's Haircut, Women's Haircut, Blowout, Beard Trim | Junior stylist, limited hours |

## Schedules
- **Alex**: Mon–Fri 9:00–17:00, lunch 12:00–13:00
- **Jordan**: Mon/Tue/Thu/Fri 10:00–18:00, lunch 13:00–14:00; Wed OFF
- **Taylor**: Tue–Sat 9:00–17:00, lunch 12:00–12:30; Mon OFF
- **Morgan**: Mon/Wed/Fri 11:00–17:00 (part-time)

## Time Off
- **Taylor**: Off on seed_date+2 (full day) — "Personal day"
- **Alex**: Off seed_date+5 afternoon (13:00–17:00) — "Doctor appointment"

## Blackout
- Business closed on seed_date+7 (Sunday) — "Holiday closure"

## Pre-Existing Appointments (15)
These create conflicts for demo purposes:

| # | Date | Time | Staff | Service | Customer | Status |
|---|------|------|-------|---------|----------|--------|
| 1 | seed_date | 09:00–09:35 | Alex | Men's Haircut | John Smith | BOOKED |
| 2 | seed_date | 10:00–10:50 | Alex | Women's Haircut | Sarah Johnson | BOOKED |
| 3 | seed_date | 14:00–15:45 | Alex | Hair Coloring | Emily Davis | BOOKED |
| 4 | seed_date | 10:00–10:35 | Jordan | Men's Haircut | Mike Wilson | BOOKED |
| 5 | seed_date | 11:00–11:35 | Jordan | Blowout & Style | Lisa Brown | BOOKED |
| 6 | seed_date+1 | 09:00–09:50 | Taylor | Women's Haircut | Amy White | BOOKED |
| 7 | seed_date+1 | 10:00–11:45 | Taylor | Hair Coloring | Rachel Green | BOOKED |
| 8 | seed_date+1 | 13:00–13:50 | Taylor | Deep Conditioning | Monica Geller | BOOKED |
| 9 | seed_date+1 | 14:00–14:35 | Alex | Men's Haircut | Ross Geller | BOOKED |
| 10 | seed_date+3 | 11:00–11:35 | Morgan | Men's Haircut | Joey Tribbiani | BOOKED |
| 11 | seed_date+3 | 15:00–15:35 | Morgan | Blowout & Style | Phoebe Buffay | BOOKED |
| 12 | seed_date+4 | 09:00–09:50 | Alex | Women's Haircut | Chandler Bing | CANCELLED |
| 13 | seed_date+4 | 10:00–10:20 | Jordan | Beard Trim | Janice Litman | BOOKED |
| 14 | seed_date+5 | 09:00–09:35 | Alex | Men's Haircut | Gunther Central | BOOKED |
| 15 | seed_date+5 | 11:00–11:35 | Morgan | Beard Trim | Richard Burke | BOOKED |

**seed_date** = next Monday from today's date (so slots are always in the future).

## Demo Conflict Scenarios
1. **Alex on seed_date at 09:00**: Already booked → slot should NOT appear for any service Alex handles
2. **Taylor on seed_date+2**: Full day off → no slots for Taylor that day
3. **Alex on seed_date+5 PM**: Time off 13:00–17:00 → only morning slots available for Alex
4. **Business blackout seed_date+7**: No slots for any staff
5. **Cancelled appointment (#12)**: Slot SHOULD be available again (Alex, seed_date+4, 09:00)
6. **Jordan on Wednesday**: Day off → no Jordan slots on any Wednesday
7. **Morgan part-time**: Slots only 11:00–17:00 on Mon/Wed/Fri
