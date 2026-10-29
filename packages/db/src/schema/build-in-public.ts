import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { workspace } from "./auth";
import { project } from "./project";
import { work } from "./work";

/**
 * Build in Public, per Project and optional. Holds only publication
 * settings: the Project's Public Status Label map overrides and the metadata
 * draft. It never stores or rewrites an internal Work status.
 */
export const buildInPublicSetting = pgTable(
  "build_in_public_setting",
  {
    enabled: boolean("enabled").notNull().default(false),
    projectId: text("project_id")
      .primaryKey()
      .references(() => project.id, { onDelete: "cascade" }),
    /** Overrides of the default map, keyed by internal status key; values are Public Status Labels. */
    statusMap: jsonb("status_map")
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "build_in_public_setting_status_map_check",
      sql`jsonb_typeof(${table.statusMap}) = 'object'`,
    ),
  ],
);

/**
 * Optional publication fields of one Roadmap Work: its `Public title`,
 * `Public summary` and an explicit Public Status Label. Separate from the
 * Work row, so they never follow an internal edit and never form a second
 * public Work.
 */
export const buildInPublicWorkCopy = pgTable(
  "build_in_public_work_copy",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    publicStatusLabel: text("public_status_label"),
    publicSummary: text("public_summary"),
    publicTitle: text("public_title"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    workId: text("work_id")
      .primaryKey()
      .references(() => work.id, { onDelete: "cascade" }),
  },
  (table) => [
    check(
      "build_in_public_work_copy_title_check",
      sql`${table.publicTitle} is null or length(btrim(${table.publicTitle})) between 1 and 120`,
    ),
    check(
      "build_in_public_work_copy_summary_check",
      sql`${table.publicSummary} is null or length(btrim(${table.publicSummary})) between 1 and 300`,
    ),
    check(
      "build_in_public_work_copy_label_check",
      sql`${table.publicStatusLabel} is null or length(btrim(${table.publicStatusLabel})) between 1 and 40`,
    ),
  ],
);
