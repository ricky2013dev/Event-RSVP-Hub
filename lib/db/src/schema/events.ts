import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type ChoiceOption = { value: string; label: string };

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
  // Card shape and ornaments, picked from the kind of event (dinner, birthday, …).
  cardStyle: text("card_style").notNull().default("classic"),
  // The two colours the "custom" theme derives its whole palette from.
  themeColor: text("theme_color").notNull().default("#d6848d"),
  themeAccent: text("theme_accent").notNull().default("#c9a24a"),
  // Language the guest pages are shown in ("ko" or "en"); only the admin can change it.
  language: text("language").notNull().default("ko"),
  // Family events ask for two parents and their children; otherwise one person registers alone.
  isFamilyType: boolean("is_family_type").notNull().default(true),
  // Label for the RSVP form's team field; empty hides the field.
  belongTeamLabel: text("belong_team_label").notNull().default("소속 팀"),
  // Label for the RSVP form's department field; empty hides the field.
  belongDeptLabel: text("belong_dept_label").notNull().default("소속 부서"),
  // Choices for the department field; empty leaves it a free-text box.
  belongDeptOptions: jsonb("belong_dept_options").$type<ChoiceOption[]>().notNull().default([]),
  // How many tables the seating board shows; the admin adds them one at a time.
  tableCount: integer("table_count").notNull().default(20),
  // Heading and placeholder for the RSVP form's message box; an empty label hides it.
  messageLabel: text("message_label").notNull().default("축하 메시지"),
  messagePlaceholder: text("message_placeholder").notNull().default("따뜻한 한마디를 남겨주세요."),
  // Whether the invitation shows guests the running attendance totals.
  showSummary: boolean("show_summary").notNull().default(true),
  // Whether the lookup page lists every RSVP for guests to filter, instead of searching one name at a time.
  showAllRsvp: boolean("show_all_rsvp").notNull().default(false),
  // Whether RSVPs are closed; guests then see only a closed notice and no RSVP data.
  rsvpClosed: boolean("rsvp_closed").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Event = typeof eventsTable.$inferSelect;
