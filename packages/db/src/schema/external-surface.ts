import { sql } from "drizzle-orm";
import {
  boolean,
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
  /** Link Sharing only: the shared main record; null for other surfaces. */
  rootId: text("root_id"),
  rootKind: text("root_kind"),
  /** Link Sharing only: `Link-limited share`; null for other surfaces. */
  surfaceKind: text("surface_kind"),
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
    /** Link Sharing idempotency: one approval attempt writes one revision. */
    approvalFingerprint: text("approval_fingerprint"),
    approvalId: text("approval_id"),
    /** Link Sharing: the separate `Publish/share anyway` confirmation. */
    placeholdersAcknowledged: boolean("placeholders_acknowledged")
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("external_surface_snapshot_revision_approval_uidx").on(
      table.approvalId,
    ),
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
