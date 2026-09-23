import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const prioritizationSession = pgTable(
  "prioritization_session",
  {
    closedAt: timestamp("closed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(0).notNull(),
    trashedAt: timestamp("trashed_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("prioritization_session_project_idx").on(table.projectId),
    unique("prioritization_session_project_id_uidx").on(
      table.projectId,
      table.id,
    ),
    check(
      "prioritization_session_name_check",
      sql`length(btrim(${table.name})) between 1 and 200`,
    ),
    check("prioritization_session_revision_check", sql`${table.revision} >= 0`),
  ],
);

export const prioritizationSessionWork = pgTable(
  "prioritization_session_work",
  {
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    projectId: text("project_id").notNull(),
    sessionId: text("session_id").notNull(),
    workId: text("work_id").notNull(),
  },
  (table) => [
    index("prioritization_session_work_project_session_idx").on(
      table.projectId,
      table.sessionId,
    ),
    uniqueIndex("prioritization_session_work_session_position_uidx").on(
      table.sessionId,
      table.position,
    ),
    uniqueIndex("prioritization_session_work_session_work_uidx").on(
      table.sessionId,
      table.workId,
    ),
    foreignKey({
      columns: [table.projectId, table.sessionId],
      foreignColumns: [
        prioritizationSession.projectId,
        prioritizationSession.id,
      ],
      name: "prioritization_session_work_project_session_fk",
    }).onDelete("cascade"),
    check(
      "prioritization_session_work_position_check",
      sql`${table.position} >= 0`,
    ),
  ],
);
