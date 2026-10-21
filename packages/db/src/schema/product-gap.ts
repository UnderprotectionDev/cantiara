import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";

/**
 * Product Gap (Ürün Boşluğu) master record, spec 58. Workspace-scoped and
 * written only by the founder: nothing inserts a row from an app-usage signal,
 * a browser, a similar title or a count. There is deliberately no priority,
 * score, repeat count, severity or Work column: a Gap is a named unmet need,
 * never a Work, a feature request or a ranking. The repeat count of a later
 * ticket is derived from Tool Escape rows that reference this id.
 */
export const productGap = pgTable(
  "workspace_product_gap",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    scope: text("scope"),
    status: text("status").default("Open").notNull(),
    statusChangedAt: timestamp("status_changed_at").defaultNow().notNull(),
    title: text("title").notNull(),
    unmetNeed: text("unmet_need").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_product_gap_workspace_idx").on(table.workspaceId),
    check(
      "workspace_product_gap_status_check",
      sql`${table.status} in ('Open', 'Evaluating', 'Met', 'Conscious boundary')`,
    ),
    check(
      "workspace_product_gap_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
    check(
      "workspace_product_gap_unmet_need_check",
      sql`length(btrim(${table.unmetNeed})) >= 1`,
    ),
  ],
);

/**
 * Related Project, Work, Feature and Decision of a Gap. `target_id` is
 * polymorphic with no foreign key: the owner's live resolver reads it at view
 * time and reports a gone target as broken, never as another record. `kind`
 * says whether the founder related the record by hand (`Related`) or through
 * the previewed follow-up (`Follow-up`). Binding or changing a Gap never writes
 * the target's lifecycle.
 */
export const productGapLink = pgTable(
  "workspace_product_gap_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    gapId: text("gap_id").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").default("Related").notNull(),
    position: integer("position").notNull(),
    targetId: text("target_id").notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.gapId],
      foreignColumns: [productGap.id],
      name: "workspace_product_gap_link_gap_fk",
    }).onDelete("cascade"),
    index("workspace_product_gap_link_gap_idx").on(table.gapId),
    uniqueIndex("workspace_product_gap_link_target_unique").on(
      table.gapId,
      table.targetType,
      table.targetId,
    ),
    check(
      "workspace_product_gap_link_type_check",
      sql`${table.targetType} in ('Project', 'Work', 'Feature', 'Decision')`,
    ),
    check(
      "workspace_product_gap_link_kind_check",
      sql`${table.kind} in ('Related', 'Follow-up')`,
    ),
  ],
);
