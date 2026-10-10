import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
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
