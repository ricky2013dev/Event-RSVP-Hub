import { and, desc, eq, sql } from "drizzle-orm";
import type { Rsvp } from "@workspace/db";
import { Router, type IRouter } from "express";
import {
  CreateRsvpBody,
  CreateRsvpResponse,
  GetEventResponse,
  GetRsvpSummaryResponse,
  ListRsvpsResponse,
  GetRsvpConfirmationParams,
  GetRsvpConfirmationResponse,
  LookupRsvpsBody,
  LookupRsvpsResponse,
  UpdateEventBody,
  UpdateEventResponse,
} from "@workspace/api-zod";
import { db, eventsTable, rsvpsTable } from "@workspace/db";
import { requireAdmin } from "../lib/admin-auth";

const router: IRouter = Router();
const EVENT_ID = 1;

// Seeded into the events table the first time the event is read; admins edit it from /admin.
const defaultEvent = {
  title: "하선이 돌 잔치",
  subtitle: "FIRST BIRTHDAY",
  description: "감사의 예배, 함께오셔서 축복해 주세요!",
  date: "2026-09-19",
  startTime: "17:00",
  endTime: "",
  timezone: "America/Chicago",
  venue: "세미한 노스캠퍼스 카페테리아",
  address: "9750 John W. Elliott Dr, Frisco, TX",
  dressCode: "",
  hostName: "하선이네",
  capacity: 200,
  imageUrl: "/baby.jpg",
  featuredNote: "",
  theme: "rose",
  belongTeamLabel: "소속 팀",
  messageLabel: "축하 메시지",
  messagePlaceholder: "따뜻한 한마디를 남겨주세요.",
};

async function loadEvent() {
  const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, EVENT_ID)).limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(eventsTable)
    .values({ id: EVENT_ID, ...defaultEvent })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(eventsTable).where(eq(eventsTable.id, EVENT_ID)))[0]!;
}

router.get("/event", async (_req, res): Promise<void> => {
  res.json(GetEventResponse.parse(await loadEvent()));
});

router.put("/event", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  await loadEvent();
  const [updated] = await db
    .update(eventsTable)
    .set({ ...parsed.data, date: parsed.data.date.toISOString().slice(0, 10) })
    .where(eq(eventsTable.id, EVENT_ID))
    .returning();

  res.json(UpdateEventResponse.parse(updated));
});

router.get("/rsvps", requireAdmin, async (_req, res): Promise<void> => {
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
      totalAdults: sql<number>`coalesce(sum(case when ${rsvpsTable.attendance} = 'attending' then ${rsvpsTable.adultCount} else 0 end), 0)::int`,
      totalChildren: sql<number>`coalesce(sum(case when ${rsvpsTable.attendance} = 'attending' then ${rsvpsTable.childCount} else 0 end), 0)::int`,
    })
    .from(rsvpsTable)
    .where(eq(rsvpsTable.eventId, EVENT_ID));

  const { capacity } = await loadEvent();
  const totalGuests = totals?.totalGuests ?? 0;
  res.json(
    GetRsvpSummaryResponse.parse({
      totalResponses: totals?.totalResponses ?? 0,
      attendingResponses: totals?.attendingResponses ?? 0,
      declinedResponses: totals?.declinedResponses ?? 0,
      totalGuests,
      totalAdults: totals?.totalAdults ?? 0,
      totalChildren: totals?.totalChildren ?? 0,
      capacity,
      spotsRemaining: Math.max(0, capacity - totalGuests),
    }),
  );
});

// A family sees its own details, but never the full phone number of anyone.
function toPublic(rsvp: Rsvp) {
  const digits = (rsvp.phoneNumber ?? "").replace(/\D/g, "");
  return {
    confirmToken: rsvp.confirmToken,
    fatherName: rsvp.fatherName,
    motherName: rsvp.motherName,
    belongTeam: rsvp.belongTeam,
    phoneNumberMasked: digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "",
    children: rsvp.children,
    adultCount: rsvp.adultCount,
    childCount: rsvp.childCount,
    totalMembers: rsvp.guestCount,
    message: rsvp.message,
    createdAt: rsvp.createdAt,
  };
}

// Whole-name match ignoring case and spaces, so typing "김" cannot list every guest.
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

const LOOKUP_WINDOW_MS = 60_000;
const LOOKUP_LIMIT = 10;
const lookupHits = new Map<string, number[]>();

function lookupThrottled(ip: string): boolean {
  const now = Date.now();
  const recent = (lookupHits.get(ip) ?? []).filter((time) => now - time < LOOKUP_WINDOW_MS);
  recent.push(now);
  lookupHits.set(ip, recent);
  return recent.length > LOOKUP_LIMIT;
}

router.post("/rsvps/lookup", async (req, res): Promise<void> => {
  if (lookupThrottled(req.ip ?? "unknown")) {
    res.status(429).json({ error: "Too many lookups" });
    return;
  }
  const parsed = LookupRsvpsBody.safeParse(req.body);
  const name = parsed.success ? normalizeName(parsed.data.name) : "";
  if (!name) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  const normalized = (column: unknown) => sql`lower(regexp_replace(${column}, '\\s', '', 'g'))`;
  const rsvps = await db
    .select()
    .from(rsvpsTable)
    .where(
      and(
        eq(rsvpsTable.eventId, EVENT_ID),
        sql`(${normalized(rsvpsTable.fatherName)} = ${name}
          or ${normalized(rsvpsTable.motherName)} = ${name}
          or exists (
            select 1 from jsonb_array_elements(${rsvpsTable.children}) as child
            where ${normalized(sql`child->>'name'`)} = ${name}
          ))`,
      ),
    )
    .orderBy(desc(rsvpsTable.createdAt))
    .limit(20);

  res.json(LookupRsvpsResponse.parse(rsvps.map(toPublic)));
});

router.get("/rsvps/confirmation/:token", async (req, res): Promise<void> => {
  const parsed = GetRsvpConfirmationParams.safeParse(req.params);
  const [rsvp] = parsed.success
    ? await db
        .select()
        .from(rsvpsTable)
        .where(and(eq(rsvpsTable.eventId, EVENT_ID), eq(rsvpsTable.confirmToken, parsed.data.token)))
        .limit(1)
    : [];

  if (!rsvp) {
    res.status(404).json({ error: "RSVP not found" });
    return;
  }
  res.json(GetRsvpConfirmationResponse.parse(toPublic(rsvp)));
});

router.post("/rsvps", async (req, res): Promise<void> => {
  const parsed = CreateRsvpBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid RSVP submission");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const fatherName = parsed.data.fatherName.trim();
  const motherName = parsed.data.motherName.trim();
  const children = parsed.data.children.map((child) => ({ name: child.name.trim(), age: child.age }));
  if (!fatherName && !motherName) {
    res.status(400).json({ error: "At least one parent name is required" });
    return;
  }
  if (children.some((child) => !child.name)) {
    res.status(400).json({ error: "Every child needs a name" });
    return;
  }

  // Each named parent is one adult, so a single-parent family is counted correctly.
  const adultCount = (fatherName ? 1 : 0) + (motherName ? 1 : 0);
  const [rsvp] = await db
    .insert(rsvpsTable)
    .values({
      eventId: EVENT_ID,
      name: [fatherName, motherName].filter(Boolean).join(" · "),
      fatherName,
      motherName,
      phoneNumber: parsed.data.phoneNumber?.trim() || null,
      belongTeam: parsed.data.belongTeam?.trim() || null,
      children,
      message: parsed.data.message?.trim() || null,
      attendance: "attending",
      adultCount,
      childCount: children.length,
      guestCount: adultCount + children.length,
    })
    .returning();

  res.status(201).json(CreateRsvpResponse.parse(toPublic(rsvp!)));
});

export default router;