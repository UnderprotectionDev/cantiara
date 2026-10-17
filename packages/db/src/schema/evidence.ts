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
import { workspace } from "./auth";
import { project } from "./project";

/** Semantic evidence and origin relations are distinct from derived usage_link rows. */
export const evidenceBinding = pgTable(
  "evidence_binding",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    // A deleted Project leaves a tombstone; the surviving end keeps its history.
    sourceProjectId: text("source_project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    sourceRecordId: text("source_record_id").notNull(),
    targetProjectId: text("target_project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    targetRecordId: text("target_record_id").notNull(),
    targetRecordType: text("target_record_type").notNull(),
    pin: jsonb("pin").notNull(),
    revision: integer("revision").default(1).notNull(),
    reviewedSourceRevision: integer("reviewed_source_revision"),
    reviewedAt: timestamp("reviewed_at"),
    reviewedBy: text("reviewed_by"),
    role: text("role").default("Unspecified").notNull(),
    // Founder interpretation is separate from role and from the pinned source text.
    interpretation: text("interpretation"),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("evidence_binding_source_idx").on(
      table.sourceProjectId,
      table.sourceRecordId,
    ),
    index("evidence_binding_target_idx").on(
      table.targetProjectId,
      table.targetRecordId,
    ),
    check(
      "evidence_binding_role_check",
      sql`${table.role} in ('Supporting', 'Contradicting', 'Provides context', 'Inconclusive', 'Unspecified')`,
    ),
  ],
);
export const recordOrigin = pgTable("record_origin", {
  id: text("id").primaryKey(),
  evidenceBindingId: text("evidence_binding_id")
    .notNull()
    .references(() => evidenceBinding.id, { onDelete: "cascade" }),
  sourceRecordId: text("source_record_id").notNull(),
  targetRecordId: text("target_record_id").notNull(),
  location: jsonb("location").notNull(),
});

/** Each role or Founder interpretation change keeps the previous values with actor and time. */
export const evidenceBindingHistory = pgTable(
  "evidence_binding_history",
  {
    id: text("id").primaryKey(),
    evidenceBindingId: text("evidence_binding_id")
      .notNull()
      .references(() => evidenceBinding.id, { onDelete: "cascade" }),
    bindingRevision: integer("binding_revision").notNull(),
    previousRole: text("previous_role").notNull(),
    previousInterpretation: text("previous_interpretation"),
    role: text("role").notNull(),
    interpretation: text("interpretation"),
    actorId: text("actor_id").notNull(),
    changedAt: timestamp("changed_at").notNull(),
  },
  (table) => [
    index("evidence_binding_history_binding_idx").on(
      table.evidenceBindingId,
      table.bindingRevision,
    ),
  ],
);
