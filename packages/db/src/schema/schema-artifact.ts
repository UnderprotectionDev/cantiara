import { sql } from "drizzle-orm";
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { diagramVersion, technicalDiagram } from "./technical-diagram";

/**
 * Immutable Migration Artifact owned by one Data Model diagram. It is written
 * once and never updated; it deliberately has no applied, status or checkbox
 * column. A correction is a new row whose `supersedes_artifact_id` points here.
 */
export const migrationArtifact = pgTable(
  "migration_artifact",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    diagramId: text("diagram_id")
      .notNull()
      .references(() => technicalDiagram.id, { onDelete: "cascade" }),
    sourceVersionId: text("source_version_id")
      .notNull()
      .references(() => diagramVersion.id, { onDelete: "cascade" }),
    targetVersionId: text("target_version_id")
      .notNull()
      .references(() => diagramVersion.id, { onDelete: "cascade" }),
    sourceModelHash: text("source_model_hash").notNull(),
    targetModelHash: text("target_model_hash").notNull(),
    generatorVersion: text("generator_version").notNull(),
    upSql: text("up_sql").notNull(),
    downSql: text("down_sql"),
    staticValidation: jsonb("static_validation").notNull(),
    editDiff: jsonb("edit_diff").notNull(),
    operations: jsonb("operations").notNull(),
    warningManifest: jsonb("warning_manifest").notNull(),
    digest: text("digest").notNull(),
    supersedesArtifactId: text("supersedes_artifact_id"),
    clientIdempotencyKey: uuid("client_idempotency_key").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique("migration_artifact_key_unique").on(
      table.accountId,
      table.clientIdempotencyKey,
    ),
    index("migration_artifact_diagram_idx").on(table.diagramId),
    index("migration_artifact_supersedes_idx").on(table.supersedesArtifactId),
    check(
      "migration_artifact_digest_check",
      sql`${table.digest} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
