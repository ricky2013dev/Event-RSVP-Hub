import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle").notNull().default(""),
  description: text("description").notNull().default(""),
  date: text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  timezone: text("timezone").notNull(),
  venue: text("venue").notNull().default(""),
  address: text("address").notNull().default(""),
  dressCode: text("dress_code").notNull().default(""),
  hostName: text("host_name").notNull().default(""),
  capacity: integer("capacity").notNull().default(0),
  imageUrl: text("image_url").notNull().default(""),
  featuredNote: text("featured_note").notNull().default(""),
  theme: text("theme").notNull().default("rose"),
  // Label for the RSVP form's team field; empty hides the field.
  belongTeamLabel: text("belong_team_label").notNull().default("소속 팀"),
  // Heading and placeholder for the RSVP form's message box; an empty label hides it.
  messageLabel: text("message_label").notNull().default("축하 메시지"),
  messagePlaceholder: text("message_placeholder").notNull().default("따뜻한 한마디를 남겨주세요."),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Event = typeof eventsTable.$inferSelect;
