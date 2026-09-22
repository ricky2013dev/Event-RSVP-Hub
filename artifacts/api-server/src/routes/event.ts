import { and, desc, eq, sql } from "drizzle-orm";
import type { Rsvp, RsvpChild } from "@workspace/db";
import { Router, type IRouter } from "express";
import {
  AssignRsvpTableBody,
  AssignRsvpTableParams,
  AssignRsvpTableResponse,
  CreateRsvpBody,
  DeleteRsvpParams,
  CreateRsvpResponse,
  GetEventResponse,
  GetRsvpSummaryResponse,
  ListPublicRsvpsResponse,
  ListRsvpsResponse,
  GetRsvpConfirmationParams,
  GetRsvpConfirmationResponse,
  LookupRsvpsBody,
  LookupRsvpsResponse,
  UpdateEventBody,
  UpdateEventResponse,
  UpdateRsvpBody,
  UpdateRsvpParams,
  UpdateRsvpResponse,
  type RsvpInput,
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
  cardStyle: "classic",
  themeColor: "#d6848d",
  themeAccent: "#c9a24a",
  isFamilyType: true,
  belongTeamLabel: "소속 팀",
  belongDeptLabel: "소속 부서",
  belongDeptOptions: [] as { value: string; label: string }[],
  tableCount: 20,
  messageLabel: "축하 메시지",
  messagePlaceholder: "따뜻한 한마디를 남겨주세요.",
  showSummary: true,
  showAllRsvp: false,
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
    belongDept: rsvp.belongDept,
    phoneNumberMasked: digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "",
    children: rsvp.children,
    adultCount: rsvp.adultCount,
    childCount: rsvp.childCount,
    totalMembers: rsvp.guestCount,
    tableNumber: rsvp.tableNumber,
    message: rsvp.message,
    createdAt: rsvp.createdAt,
  };
}

// Whole-name match ignoring case and spaces, so typing "김" cannot list every guest.
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "");
}

// A digits-only term (spaces, dashes and parentheses allowed) is read as a phone number.
const PHONE_TERM = /^[\d\s()+-]+$/;
const PHONE_MIN_DIGITS = 4;

// The browser filters the published list, so it has to arrive whole; this only keeps a
// runaway guest list from being sent in one response.
const PUBLIC_LIST_LIMIT = 500;

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

// Only published while the admin has the switch on; otherwise the names stay behind the lookup.
router.get("/rsvps/all", async (_req, res): Promise<void> => {
  const event = await loadEvent();
  if (!event.showAllRsvp) {
    res.status(404).json({ error: "RSVP list is not published" });
    return;
  }

  const rsvps = await db
    .select()
    .from(rsvpsTable)
    .where(eq(rsvpsTable.eventId, EVENT_ID))
    .orderBy(desc(rsvpsTable.createdAt))
    .limit(PUBLIC_LIST_LIMIT);

  res.json(ListPublicRsvpsResponse.parse(rsvps.map(toPublic)));
});

router.post("/rsvps/lookup", async (req, res): Promise<void> => {
  if (lookupThrottled(req.ip ?? "unknown")) {
    res.status(429).json({ error: "Too many lookups" });
    return;
  }
  const parsed = LookupRsvpsBody.safeParse(req.body);
  const term = parsed.success ? parsed.data.query.trim() : "";
  if (!term) {
    res.status(400).json({ error: "A name or phone number is required" });
    return;
  }

  // The last few digits are enough to find a family, but fewer than four would list too many.
  const isPhoneTerm = PHONE_TERM.test(term);
  const digits = isPhoneTerm ? term.replace(/\D/g, "") : "";
  if (isPhoneTerm && digits.length < PHONE_MIN_DIGITS) {
    res.status(400).json({ error: `At least ${PHONE_MIN_DIGITS} phone digits are required` });
    return;
  }

  const normalized = (column: unknown) => sql`lower(regexp_replace(${column}, '\\s', '', 'g'))`;
  const name = normalizeName(term);
  const match = digits
    ? sql`regexp_replace(coalesce(${rsvpsTable.phoneNumber}, ''), '\\D', '', 'g') like ${"%" + digits}`
    : sql`(${normalized(rsvpsTable.fatherName)} = ${name}
          or ${normalized(rsvpsTable.motherName)} = ${name}
          or exists (
            select 1 from jsonb_array_elements(${rsvpsTable.children}) as child
            where ${normalized(sql`child->>'name'`)} = ${name}
          ))`;

  const rsvps = await db
    .select()
    .from(rsvpsTable)
    .where(and(eq(rsvpsTable.eventId, EVENT_ID), match))
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

// Shared by guest submissions and admin edits: trims the input, checks it, and derives the head counts.
type RsvpValues = {
  name: string;
  fatherName: string;
  motherName: string;
  phoneNumber: string | null;
  belongTeam: string | null;
  belongDept: string | null;
  children: RsvpChild[];
  message: string | null;
  adultCount: number;
  childCount: number;
  guestCount: number;
};

async function rsvpValues(data: RsvpInput): Promise<{ error: string } | { values: RsvpValues }> {
  const event = await loadEvent();

  // Outside a family event one person registers alone, so a spouse or children in the
  // body are dropped rather than stored behind the admin's back.
  const fatherName = data.fatherName.trim();
  const motherName = event.isFamilyType ? data.motherName.trim() : "";
  const children = event.isFamilyType ? data.children.map((child) => ({ name: child.name.trim(), age: child.age })) : [];
  if (!fatherName && !motherName) return { error: event.isFamilyType ? "At least one parent name is required" : "A name is required" };
  if (children.some((child) => !child.name)) return { error: "Every child needs a name" };

  // When the admin has set choices, only those values are accepted for the department.
  const belongDept = data.belongDept?.trim() || null;
  if (belongDept && event.belongDeptOptions.length > 0 && !event.belongDeptOptions.some((option) => option.value === belongDept)) {
    return { error: "Unknown department choice" };
  }

  // Each named adult counts as one, so a single-parent family and a lone guest are both correct.
  const adultCount = (fatherName ? 1 : 0) + (motherName ? 1 : 0);
  return {
    values: {
      name: [fatherName, motherName].filter(Boolean).join(" · "),
      fatherName,
      motherName,
      phoneNumber: data.phoneNumber?.trim() || null,
      belongTeam: data.belongTeam?.trim() || null,
      belongDept,
      children,
      message: data.message?.trim() || null,
      adultCount,
      childCount: children.length,
      guestCount: adultCount + children.length,
    },
  };
}

router.post("/rsvps", async (req, res): Promise<void> => {
  const parsed = CreateRsvpBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.flatten() }, "Invalid RSVP submission");
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const result = await rsvpValues(parsed.data);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const [rsvp] = await db
    .insert(rsvpsTable)
    .values({ eventId: EVENT_ID, attendance: "attending", ...result.values })
    .returning();

  res.status(201).json(CreateRsvpResponse.parse(toPublic(rsvp!)));
});

router.put("/rsvps/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdateRsvpParams.safeParse(req.params);
  const parsed = UpdateRsvpBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? parsed.error!.message : params.error.message });
    return;
  }

  const result = await rsvpValues(parsed.data);
  if ("error" in result) {
    res.status(400).json({ error: result.error });
    return;
  }

  const [rsvp] = await db
    .update(rsvpsTable)
    .set(result.values)
    .where(and(eq(rsvpsTable.eventId, EVENT_ID), eq(rsvpsTable.id, params.data.id)))
    .returning();

  if (!rsvp) {
    res.status(404).json({ error: "RSVP not found" });
    return;
  }
  res.json(UpdateRsvpResponse.parse(rsvp));
});

// Seating is admin-only, so it lives apart from the RSVP body the guests submit.
router.put("/rsvps/:id/table", requireAdmin, async (req, res): Promise<void> => {
  const params = AssignRsvpTableParams.safeParse(req.params);
  const parsed = AssignRsvpTableBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? parsed.error!.message : params.error.message });
    return;
  }

  const [rsvp] = await db
    .update(rsvpsTable)
    .set({ tableNumber: parsed.data.tableNumber })
    .where(and(eq(rsvpsTable.eventId, EVENT_ID), eq(rsvpsTable.id, params.data.id)))
    .returning();

  if (!rsvp) {
    res.status(404).json({ error: "RSVP not found" });
    return;
  }
  res.json(AssignRsvpTableResponse.parse(rsvp));
});

router.delete("/rsvps/:id", requireAdmin, async (req, res): Promise<void> => {
  const params = DeleteRsvpParams.safeParse(req.params);
  if (!params.success) {
    res.status(404).json({ error: "RSVP not found" });
    return;
  }

  const [deleted] = await db
    .delete(rsvpsTable)
    .where(and(eq(rsvpsTable.eventId, EVENT_ID), eq(rsvpsTable.id, params.data.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "RSVP not found" });
    return;
  }
  res.status(204).end();
});

export default router;