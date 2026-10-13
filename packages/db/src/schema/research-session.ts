import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { project } from "./project";

export const researchSession = pgTable(
  "project_research_session",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    data: jsonb("data").notNull(),
  },
  (table) => [
    index("project_research_session_project_idx").on(table.projectId),
    check(
      "project_research_session_revision_check",
      sql`${table.revision} > 0`,
    ),
    check(
      "project_research_session_identity_check",
      sql`${table.data}->>'sourceType' = 'Research Session' and ${table.data}->>'id' = ${table.id} and ${table.data}->>'projectId' = ${table.projectId} and (${table.data}->>'revision')::integer = ${table.revision}`,
    ),
  ],
);

/** Isolated preview; never a target master record or a public sharing snapshot. */
export const researchSessionBindingPreview = pgTable(
  "research_session_binding_preview",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => researchSession.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    plan: jsonb("plan").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    confirmedBindingId: text("confirmed_binding_id"),
  },
  (table) => [index("research_binding_preview_expiry_idx").on(table.expiresAt)],
);
