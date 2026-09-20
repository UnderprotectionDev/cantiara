import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { workspace } from "./auth";

export const workspaceTag = pgTable(
  "workspace_tag",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_tag_workspace_idx").on(table.workspaceId),
    uniqueIndex("workspace_tag_workspace_name_uidx").on(
      table.workspaceId,
      table.nameKey,
    ),
    check("workspace_tag_name_check", sql`length(btrim(${table.name})) > 0`),
  ],
);

export const workspaceTagAssignment = pgTable(
  "workspace_tag_assignment",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    recordId: text("record_id").notNull(),
    recordType: text("record_type").notNull(),
    tagId: text("tag_id")
      .notNull()
      .references(() => workspaceTag.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("workspace_tag_assignment_record_idx").on(
      table.recordType,
      table.recordId,
    ),
    index("workspace_tag_assignment_tag_idx").on(table.tagId),
    uniqueIndex("workspace_tag_assignment_tag_record_uidx").on(
      table.tagId,
      table.recordType,
      table.recordId,
    ),
    check(
      "workspace_tag_assignment_record_type_check",
      sql`${table.recordType} in ('Work')`,
    ),
  ],
);

export const workspaceTagRelations = relations(
  workspaceTag,
  ({ many, one }) => ({
    assignments: many(workspaceTagAssignment),
    workspace: one(workspace, {
      fields: [workspaceTag.workspaceId],
      references: [workspace.id],
    }),
  }),
);

export const workspaceTagAssignmentRelations = relations(
  workspaceTagAssignment,
  ({ one }) => ({
    tag: one(workspaceTag, {
      fields: [workspaceTagAssignment.tagId],
      references: [workspaceTag.id],
    }),
  }),
);
