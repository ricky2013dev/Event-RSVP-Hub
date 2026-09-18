import { and, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateRsvpBody,
  CreateRsvpResponse,
  GetEventResponse,
  GetRsvpSummaryResponse,
  ListRsvpsResponse,
} from "@workspace/api-zod";
import { db, rsvpsTable } from "@workspace/db";

const router: IRouter = Router();
const EVENT_ID = 1;
const EVENT_CAPACITY = 80;

const eventDetails = {
  id: EVENT_ID,
  title: "The Night Garden",
  subtitle: "An evening under the stars",
  description:
    "Join us for a candlelit evening of good food, music, and the people we love most. Come as you are and stay awhile.",
  date: "2026-10-24",
  startTime: "18:30",
  endTime: "22:30",
  timezone: "America/Chicago",
  venue: "The Conservatory",
  address: "1180 W. Fulton Market, Chicago, IL",
  dressCode: "Garden formal",
  hostName: "Riley & Morgan",
  capacity: EVENT_CAPACITY,
  imageUrl:
    "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1800&q=85",
  featuredNote: "Dinner, dancing, and a little bit of magic.",
};

router.get("/event", (_req, res): void => {
  res.json(GetEventResponse.parse(eventDetails));
});

router.get("/rsvps", async (_req, res): Promise<void> => {
  const rsvps = await db
    .select()
    .from(rsvpsTable)
    .where(eq(rsvpsTable.eventId, EVENT_ID))
    .orderBy(desc(rsvpsTable.createdAt));

  res.json(ListRsvpsResponse.parse(rsvps));
});

router.get("/rsvps/summary", async (_req, res): Promise<void> => {
  const [totals] = await db
    .select({
      totalResponses: sql<number>`count(*)::int`,
      attendingResponses: sql<number>`count(*) filter (where ${rsvpsTable.attendance} = 'attending')::int`,
      declinedResponses: sql<number>`count(*) filter (where ${rsvpsTable.attendance} = 'declined')::int`,
      totalGuests: sql<number>`coalesce(sum(case when ${rsvpsTable.attendance} = 'attending' then ${rsvpsTable.guestCount} else 0 end), 0)::int`,
    })
    .from(rsvpsTable)
    .where(eq(rsvpsTable.eventId, EVENT_ID));

  const totalGuests = totals?.totalGuests ?? 0;
  res.json(
    GetRsvpSummaryResponse.parse({
      totalResponses: totals?.totalResponses ?? 0,
      attendingResponses: totals?.attendingResponses ?? 0,
      declinedResponses: totals?.declinedResponses ?? 0,
      totalGuests,
      capacity: EVENT_CAPACITY,
      spotsRemaining: Math.max(0, EVENT_CAPACITY - totalGuests),
    }),
  );
});

router.post("/rsvps", async (req, res): Promise<void> => {
  const parsed = CreateRsvpBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid RSVP submission");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const existing = await db
    .select({ id: rsvpsTable.id })
    .from(rsvpsTable)
    .where(
      and(
        eq(rsvpsTable.eventId, EVENT_ID),
        eq(rsvpsTable.email, parsed.data.email),
      ),
    )
    .limit(1);

  const [rsvp] =
    existing.length > 0
      ? await db
          .update(rsvpsTable)
          .set({
            ...parsed.data,
            eventId: EVENT_ID,
            updatedAt: new Date(),
          })
          .where(eq(rsvpsTable.id, existing[0].id))
          .returning()
      : await db
          .insert(rsvpsTable)
          .values({
            ...parsed.data,
            eventId: EVENT_ID,
          })
          .returning();

  res.status(201).json(CreateRsvpResponse.parse(rsvp));
});

export default router;