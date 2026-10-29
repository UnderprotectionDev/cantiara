import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspace } from "./auth";
import { externalSurface } from "./external-surface";
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
    /** `Full date`, `Month`, `Quarter` or `Hidden`; derived from the Work's one internal date. */
    dueDatePresentation: text("due_date_presentation")
      .notNull()
      .default("Hidden"),
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
      "build_in_public_work_copy_due_date_check",
      sql`${table.dueDatePresentation} in ('Full date', 'Month', 'Quarter', 'Hidden')`,
    ),
    check(
      "build_in_public_work_copy_label_check",
      sql`${table.publicStatusLabel} is null or length(btrim(${table.publicStatusLabel})) between 1 and 40`,
    ),
  ],
);

/**
 * Public addresses of one Build in Public surface. The `canonical` slug names
 * the surface; any other row is an earlier slug that redirects to it. A slug is
 * unique in the Workspace. Unpublishing deletes every row, so a redirect never
 * outlives the surface and no address is reused.
 */
export const buildInPublicSlug = pgTable(
  "build_in_public_slug",
  {
    canonical: boolean("canonical").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    slug: text("slug").notNull(),
    surfaceId: text("surface_id")
      .notNull()
      .references(() => externalSurface.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({
      columns: [table.workspaceId, table.slug],
      name: "build_in_public_slug_pk",
    }),
    uniqueIndex("build_in_public_slug_canonical_uidx")
      .on(table.surfaceId)
      .where(sql`${table.canonical}`),
    check(
      "build_in_public_slug_check",
      sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${table.slug}) <= 80`,
    ),
  ],
);
