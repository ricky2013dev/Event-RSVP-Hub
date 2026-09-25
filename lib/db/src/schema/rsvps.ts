import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

// group is the name of the child group the guest picked. Children saved before the form
// asked for a group have an age instead.
export type RsvpChild = { name: string; group?: string; age?: number };

export const rsvpsTable = pgTable("rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().default(1),
  // Display name for the family, derived from the parents' names.
  name: text("name").notNull(),
  fatherName: text("father_name").notNull().default(""),
  motherName: text("mother_name").notNull().default(""),
  phoneNumber: text("phone_number"),
  // Team/group the family belongs to; the label is set per event (events.belong_team_label).
  belongTeam: text("belong_team"),
  // Department the family belongs to; the label is set per event (events.belong_dept_label).
  belongDept: text("belong_dept"),
  children: jsonb("children").$type<RsvpChild[]>().notNull().default([]),
  // Legacy columns from the email-based form; kept so older rows still load.
  email: text("email"),
  attendance: text("attendance").notNull().default("attending"),
  guestCount: integer("guest_count").notNull().default(0),
  adultCount: integer("adult_count").notNull().default(0),
  childCount: integer("child_count").notNull().default(0),
  mealPreference: text("meal_preference").notNull().default("noPreference"),
  dietaryNotes: text("dietary_notes"),
  message: text("message"),
  // Seating assignment, set by the admin only; guests never submit it.
  tableNumber: integer("table_number"),
  // Private link token so a family can re-open their confirmation later.
  confirmToken: text("confirm_token")
    .notNull()
    .unique()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertRsvpSchema = createInsertSchema(rsvpsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRsvp = z.infer<typeof insertRsvpSchema>;
export type Rsvp = typeof rsvpsTable.$inferSelect;
