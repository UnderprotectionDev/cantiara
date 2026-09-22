import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";
import { work } from "./work";

export const PRIORITY_METRIC_RANKS = [
  "Very low",
  "Low",
  "Medium",
  "High",
  "Very high",
] as const;

export type PriorityMetricRank = (typeof PRIORITY_METRIC_RANKS)[number];

export type PriorityMetricRankDescriptions = Record<PriorityMetricRank, string>;

export const priorityMetricDefinition = pgTable(
  "priority_metric_definition",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    enabled: boolean("enabled").default(true).notNull(),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    nameKey: text("name_key").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    rankDescriptions: jsonb("rank_descriptions")
      .$type<PriorityMetricRankDescriptions>()
      .notNull(),
    revision: integer("revision").default(0).notNull(),
    shortDescription: text("short_description").notNull(),
    trashedAt: timestamp("trashed_at"),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("priority_metric_definition_project_idx").on(table.projectId),
    uniqueIndex("priority_metric_definition_project_name_uidx").on(
      table.projectId,
      table.nameKey,
    ),
    unique("priority_metric_definition_project_id_uidx").on(
      table.projectId,
      table.id,
    ),
    check(
      "priority_metric_definition_name_check",
      sql`length(btrim(${table.name})) between 1 and 200`,
    ),
    check(
      "priority_metric_definition_short_description_check",
      sql`length(btrim(${table.shortDescription})) between 1 and 500`,
    ),
    check(
      "priority_metric_definition_rank_descriptions_check",
      sql`jsonb_typeof(${table.rankDescriptions}) = 'object'
        and ${table.rankDescriptions} ?& array['Very low', 'Low', 'Medium', 'High', 'Very high']
        and ${table.rankDescriptions} - array['Very low', 'Low', 'Medium', 'High', 'Very high'] = '{}'::jsonb`,
    ),
    check(
      "priority_metric_definition_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);

export const workPriorityMetricValue = pgTable(
  "work_priority_metric_value",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    metricId: text("metric_id").notNull(),
    projectId: text("project_id").notNull(),
    rank: text("rank").notNull(),
    revision: integer("revision").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    workId: text("work_id").notNull(),
  },
  (table) => [
    index("work_priority_metric_value_project_work_idx").on(
      table.projectId,
      table.workId,
    ),
    uniqueIndex("work_priority_metric_value_work_metric_uidx").on(
      table.workId,
      table.metricId,
    ),
    foreignKey({
      columns: [table.projectId, table.metricId],
      foreignColumns: [
        priorityMetricDefinition.projectId,
        priorityMetricDefinition.id,
      ],
      name: "work_priority_metric_value_project_metric_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.projectId, table.workId],
      foreignColumns: [work.projectId, work.id],
      name: "work_priority_metric_value_project_work_fk",
    }).onDelete("cascade"),
    check(
      "work_priority_metric_value_rank_check",
      sql`${table.rank} in ('Very low', 'Low', 'Medium', 'High', 'Very high')`,
    ),
    check(
      "work_priority_metric_value_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);
