import { relations, sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { focusPeriod } from "./focus-period";
import { project } from "./project";
import { projectRelease } from "./project-release";

export const risk = pgTable(
  "project_risk",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    description: text("description"),
    id: text("id").primaryKey(),
    impact: text("impact"),
    life: text("life").default("Open").notNull(),
    probability: text("probability"),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rationale: text("rationale"),
    response: text("response"),
    revision: integer("revision").default(0).notNull(),
    title: text("title").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("project_risk_project_life_title_idx").on(
      table.projectId,
      table.life,
      table.title,
    ),
    check(
      "project_risk_life_check",
      sql`${table.life} in ('Open', 'Mitigating', 'Occurred', 'Resolved', 'Accepted')`,
    ),
    check("project_risk_revision_check", sql`${table.revision} >= 0`),
    check(
      "project_risk_title_check",
      sql`length(btrim(${table.title})) between 1 and 255`,
    ),
  ],
);

export const riskRelations = relations(risk, ({ one }) => ({
  project: one(project, {
    fields: [risk.projectId],
    references: [project.id],
  }),
}));

export const riskAttentionSignal = pgTable(
  "risk_attention_signal",
  {
    signalId: text("signal_id").primaryKey(),
    sourceRiskId: text("source_risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    signalType: text("signal_type").default("open-risk").notNull(),
    presentation: text("presentation").default("Action Required").notNull(),
    sourceEvent: jsonb("source_event")
      .$type<
        | { type: "entered-open"; id: string }
        | {
            type: "related-context";
            id: string;
            targetType: "Project Release" | "Focus Period";
            targetId: string;
          }
      >()
      .notNull(),
    impact: text("impact"),
    probability: text("probability"),
    sourcePath: text("source_path").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
  },
  (table) => [
    index("risk_attention_signal_project_idx").on(
      table.projectId,
      table.occurredAt,
    ),
    check(
      "risk_attention_signal_type_check",
      sql`${table.signalType} = 'open-risk'`,
    ),
    check(
      "risk_attention_signal_presentation_check",
      sql`${table.presentation} = 'Action Required'`,
    ),
    check(
      "risk_attention_signal_event_check",
      sql`${table.sourceEvent}->>'type' in ('entered-open', 'related-context')`,
    ),
  ],
);

export const riskContextRelation = pgTable(
  "risk_context_relation",
  {
    id: text("id").primaryKey(),
    riskId: text("risk_id")
      .notNull()
      .references(() => risk.id, { onDelete: "cascade" }),
    projectReleaseId: text("project_release_id").references(
      () => projectRelease.id,
      { onDelete: "cascade" },
    ),
    focusPeriodId: text("focus_period_id").references(() => focusPeriod.id, {
      onDelete: "cascade",
    }),
    revision: integer("revision").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("risk_context_relation_release_uidx").on(
      table.riskId,
      table.projectReleaseId,
    ),
    uniqueIndex("risk_context_relation_period_uidx").on(
      table.riskId,
      table.focusPeriodId,
    ),
    check(
      "risk_context_relation_target_check",
      sql`num_nonnulls(${table.projectReleaseId}, ${table.focusPeriodId}) = 1`,
    ),
    check("risk_context_relation_revision_check", sql`${table.revision} >= 1`),
  ],
);
