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

import { workspaceCompany, workspaceContact } from "./contact";
import { document } from "./document";
import { githubRepositoryLink } from "./github-integration";
import { project } from "./project";
import { projectRelease } from "./project-release";
import { work } from "./work";

/**
 * Project Release Planning scope: the Work the founder explicitly gathered as
 * the publishable scope of one Project Release. The composite Work key keeps
 * every member inside the release's Project; removal keeps the row with
 * `removed_at` so the membership history and revision survive.
 */
export const projectReleaseScope = pgTable(
  "project_release_scope",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    removedAt: timestamp("removed_at"),
    revision: integer("revision").default(0).notNull(),
    workId: text("work_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.projectId, table.workId],
      foreignColumns: [work.projectId, work.id],
      name: "project_release_scope_work_fk",
    }).onDelete("cascade"),
    uniqueIndex("project_release_scope_release_work_uidx").on(
      table.releaseId,
      table.workId,
    ),
    index("project_release_scope_project_work_idx").on(
      table.projectId,
      table.workId,
    ),
    check("project_release_scope_revision_check", sql`${table.revision} >= 0`),
  ],
);

/**
 * Cantiara-owned references from one Project Release to a tag, a GitHub
 * Release or an environment of the same Project's linked repositories. A
 * reference never writes the release status; GitHub's own release time stays
 * on the GitHub record.
 */
export const projectReleaseLink = pgTable(
  "project_release_link",
  {
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    label: text("label").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    removedAt: timestamp("removed_at"),
    repositoryLinkId: text("repository_link_id").references(
      () => githubRepositoryLink.id,
      { onDelete: "cascade" },
    ),
    revision: integer("revision").default(0).notNull(),
    url: text("url"),
  },
  (table) => [
    index("project_release_link_release_idx").on(
      table.projectId,
      table.releaseId,
    ),
    check(
      "project_release_link_kind_check",
      sql`${table.kind} in ('Tag', 'Release', 'Environment link')`,
    ),
    check(
      "project_release_link_repository_check",
      sql`${table.kind} = 'Environment link' or ${table.repositoryLinkId} is not null`,
    ),
    check(
      "project_release_link_label_check",
      sql`length(btrim(${table.label})) between 1 and 255`,
    ),
    check(
      "project_release_link_url_check",
      sql`${table.url} is null or length(${table.url}) between 1 and 2048`,
    ),
    check("project_release_link_revision_check", sql`${table.revision} >= 0`),
  ],
);

/**
 * Optional Persona Document, Contact or Company named in the hypothesis
 * audience. Exactly one target column matches `target_type`.
 */
export const projectReleaseAudience = pgTable(
  "project_release_audience",
  {
    companyId: text("company_id").references(() => workspaceCompany.id, {
      onDelete: "cascade",
    }),
    contactId: text("contact_id").references(() => workspaceContact.id, {
      onDelete: "cascade",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    personaDocumentId: text("persona_document_id").references(
      () => document.id,
      { onDelete: "cascade" },
    ),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    releaseId: text("release_id")
      .notNull()
      .references(() => projectRelease.id, { onDelete: "cascade" }),
    removedAt: timestamp("removed_at"),
    revision: integer("revision").default(0).notNull(),
    targetType: text("target_type").notNull(),
  },
  (table) => [
    index("project_release_audience_release_idx").on(
      table.projectId,
      table.releaseId,
    ),
    check(
      "project_release_audience_target_type_check",
      sql`${table.targetType} in ('Persona', 'Contact', 'Company')`,
    ),
    check(
      "project_release_audience_target_check",
      sql`(${table.targetType} = 'Persona' and ${table.personaDocumentId} is not null and ${table.contactId} is null and ${table.companyId} is null) or (${table.targetType} = 'Contact' and ${table.contactId} is not null and ${table.personaDocumentId} is null and ${table.companyId} is null) or (${table.targetType} = 'Company' and ${table.companyId} is not null and ${table.personaDocumentId} is null and ${table.contactId} is null)`,
    ),
    check(
      "project_release_audience_revision_check",
      sql`${table.revision} >= 0`,
    ),
  ],
);
