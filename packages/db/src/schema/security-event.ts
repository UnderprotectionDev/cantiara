import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const securityEvent = pgTable(
  "security_event",
  {
    id: text("id").primaryKey(),
    version: integer("version").notNull(),
    type: text("type").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    actorAlias: text("actor_alias").notNull(),
    targetSessionAlias: text("target_session_alias").notNull(),
  },
  (table) => [
    index("security_event_occurredAt_idx").on(table.occurredAt),
    index("security_event_targetSessionAlias_type_idx").on(
      table.targetSessionAlias,
      table.type,
    ),
  ],
);
