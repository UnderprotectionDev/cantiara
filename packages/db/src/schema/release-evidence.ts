import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { project } from "./project";
import { projectRelease } from "./project-release";

/**
 * Release checklist (Sürüm kontrol listesi) of the Release Evidence Pack: the
 * founder's own optional lines for one Project Release. A line is text and a
 * checked mark only. There is deliberately no status, gate, score or publish
 * column, and no link to a domain record: checking a line writes nothing else.
 */
export const projectReleaseChecklistItem = pgTable(
  "project_release_checklist_item",
  {
    checked: boolean("checked").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    position: integer("position").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
  },
  (table) => [
    index("project_release_checklist_item_release_idx").on(
      table.releaseId,
      table.position,
    ),
    check(
      "project_release_checklist_item_text_check",
      sql`length(btrim(${table.text})) between 1 and 500`,
    ),
  ],
);

/**
 * The founder closed the deduped `published-release-open-scope` signal of a
 * Project Release. Closing hides the signal only; it never touches a status.
 */
export const projectReleaseSignalClose = pgTable(
  "project_release_signal_close",
  {
    closedAt: timestamp("closed_at").defaultNow().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    signalId: text("signal_id").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.releaseId, table.signalId],
      name: "project_release_signal_close_pk",
    }),
  ],
);
