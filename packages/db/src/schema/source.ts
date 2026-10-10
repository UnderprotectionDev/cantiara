import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { project } from "./project";

export const source = pgTable(
  "source",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("source_project_idx").on(table.projectId),
    check("source_revision_check", sql`${table.revision} > 0`),
  ],
);

// Version rows are only inserted by Source saves. No update/delete API rewrites captures.
export const sourceVersion = pgTable(
  "source_version",
  {
    sourceId: text("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    accessedAt: timestamp("accessed_at", { withTimezone: true }).notNull(),
    capturedContent: text("captured_content").notNull(),
    provider: text("provider"),
    externalRecordType: text("external_record_type"),
    externalId: text("external_id"),
    savedAt: timestamp("saved_at").notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceId, table.revision] }),
    check("source_version_revision_check", sql`${table.revision} > 0`),
    check(
      "source_version_url_check",
      sql`length(${table.url}) between 1 and 8192 and ${table.url} ~ '^https?://'`,
    ),
    check(
      "source_version_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "source_version_content_check",
      sql`length(${table.capturedContent}) <= 100000`,
    ),
    check(
      "source_version_provider_check",
      sql`${table.provider} is null or length(btrim(${table.provider})) between 1 and 255`,
    ),
    check(
      "source_version_external_type_check",
      sql`${table.externalRecordType} is null or length(btrim(${table.externalRecordType})) between 1 and 255`,
    ),
    check(
      "source_version_external_id_check",
      sql`${table.externalId} is null or length(btrim(${table.externalId})) between 1 and 255`,
    ),
  ],
);
