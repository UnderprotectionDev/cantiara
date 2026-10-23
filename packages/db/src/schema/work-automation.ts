import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

export const workAutomationRule = pgTable(
  "work_automation_rule",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    definition: jsonb("definition").$type<unknown>().notNull(),
    enabled: boolean("enabled").default(false).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    revision: integer("revision").default(1).notNull(),
    trashedAt: timestamp("trashed_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => [
    index("work_automation_rule_project_idx").on(table.projectId),
    uniqueIndex("work_automation_rule_project_name_uidx").on(
      table.projectId,
      table.nameKey,
    ),
    check(
      "work_automation_rule_name_check",
      sql`length(btrim(${table.name})) > 0`,
    ),
    check("work_automation_rule_revision_check", sql`${table.revision} >= 1`),
    check("work_automation_rule_version_check", sql`${table.version} >= 1`),
  ],
);

export const workAutomationRuleVersion = pgTable(
  "work_automation_rule_version",
  {
    definition: jsonb("definition").$type<unknown>().notNull(),
    name: text("name").notNull(),
    ruleId: text("rule_id")
      .notNull()
      .references(() => workAutomationRule.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at").defaultNow().notNull(),
    version: integer("version").notNull(),
  },
  (table) => [primaryKey({ columns: [table.ruleId, table.version] })],
);

export const workAutomationApplication = pgTable(
  "work_automation_application",
  {
    appliedAt: timestamp("applied_at").notNull(),
    changes: jsonb("changes").$type<unknown[]>().notNull(),
    id: text("id").primaryKey(),
    idempotencyKey: text("idempotency_key").notNull(),
    previousValues: jsonb("previous_values").$type<unknown>().notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    undoUntil: timestamp("undo_until").notNull(),
    undoneAt: timestamp("undone_at"),
  },
  (table) => [
    uniqueIndex("work_automation_application_key_uidx").on(
      table.projectId,
      table.idempotencyKey,
    ),
  ],
);

export const workAutomationSignal = pgTable(
  "work_automation_signal",
  {
    failedStep: text("failed_step").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    reason: text("reason").notNull(),
    ruleId: text("rule_id").notNull(),
    ruleName: text("rule_name").notNull(),
    ruleVersion: integer("rule_version").notNull(),
    trigger: jsonb("trigger").$type<unknown>().notNull(),
    triggerEventId: text("trigger_event_id").notNull(),
  },
  (table) => [
    index("work_automation_signal_project_idx").on(
      table.projectId,
      table.occurredAt,
    ),
    check(
      "work_automation_signal_kind_check",
      sql`${table.kind} in ('automation-failed', 'automation-conflict')`,
    ),
  ],
);
