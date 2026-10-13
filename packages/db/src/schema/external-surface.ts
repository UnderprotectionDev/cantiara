import { sql } from "drizzle-orm";
import {
  check,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspace } from "./auth";
import { document } from "./document";
import { project } from "./project";

export const externalSurface = pgTable("external_surface", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => project.id, {
    onDelete: "cascade",
  }),
  documentId: text("document_id").references(() => document.id, {
    onDelete: "set null",
  }),
  cancelledAt: timestamp("cancelled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const externalSurfaceSnapshotRevision = pgTable(
  "external_surface_snapshot_revision",
  {
    id: text("id").primaryKey(),
    surfaceId: text("surface_id")
      .notNull()
      .references(() => externalSurface.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("external_surface_snapshot_revision_uidx").on(
      table.surfaceId,
      table.revision,
    ),
    check(
      "external_surface_snapshot_revision_check",
      sql`${table.revision} > 0`,
    ),
  ],
);
