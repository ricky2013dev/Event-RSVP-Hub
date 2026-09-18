import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const rsvpsTable = pgTable(
  "rsvps",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull().default(1),
    name: text("name").notNull(),
    email: text("email").notNull(),
    attendance: text("attendance").notNull(),
    guestCount: integer("guest_count").notNull().default(0),
    mealPreference: text("meal_preference").notNull().default("noPreference"),
    dietaryNotes: text("dietary_notes"),
    message: text("message"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    emailEventUnique: unique("rsvps_event_email_unique").on(table.eventId, table.email),
  }),
);

export const insertRsvpSchema = createInsertSchema(rsvpsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertRsvp = z.infer<typeof insertRsvpSchema>;
export type Rsvp = typeof rsvpsTable.$inferSelect;