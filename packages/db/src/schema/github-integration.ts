import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { project } from "./project";

/**
 * GitHub App installation claimed for one Project. The installation, not the
 * Better Auth login, is the repository authority: no column here refers to a
 * login account, session or OAuth token. `removed_at` records that GitHub
 * reported the App uninstalled; it never touches identity or sessions.
 */
export const githubInstallation = pgTable(
  "project_github_installation",
  {
    accountLogin: text("account_login").notNull(),
    connectedByAccountId: text("connected_by_account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    id: text("id").primaryKey(),
    installationId: bigint("installation_id", { mode: "number" }).notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    removedAt: timestamp("removed_at"),
  },
  (table) => [
    uniqueIndex("project_github_installation_project_installation_idx").on(
      table.projectId,
      table.installationId,
    ),
    index("project_github_installation_installation_idx").on(
      table.installationId,
    ),
  ],
);

/**
 * Envelope-encrypted installation access token: AES-256-GCM ciphertext under a
 * per-row data key, which is itself wrapped by a versioned key. Plaintext is
 * never stored, logged or exported.
 */
export const githubInstallationCredential = pgTable(
  "project_github_installation_credential",
  {
    ciphertext: text("ciphertext").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    installationRowId: text("installation_row_id")
      .primaryKey()
      .references(() => githubInstallation.id, { onDelete: "cascade" }),
    keyVersion: integer("key_version").notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    wrappedDataKey: text("wrapped_data_key").notNull(),
  },
);

/**
 * GitHub bağlantısı: identity is GitHub's stable numeric `repository_id`;
 * `owner` and `name` are only the latest observed labels.
 */
export const githubRepositoryLink = pgTable(
  "project_github_repository_link",
  {
    disconnectedAt: timestamp("disconnected_at"),
    htmlUrl: text("html_url").notNull(),
    id: text("id").primaryKey(),
    installationRowId: text("installation_row_id")
      .notNull()
      .references(() => githubInstallation.id, { onDelete: "cascade" }),
    linkedAt: timestamp("linked_at").defaultNow().notNull(),
    name: text("name").notNull(),
    owner: text("owner").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    repositoryId: bigint("repository_id", { mode: "number" }).notNull(),
    stopReason: text("stop_reason"),
    triageState: text("triage_state").default("Pending").notNull(),
  },
  (table) => [
    uniqueIndex("project_github_repository_link_project_repository_idx").on(
      table.projectId,
      table.repositoryId,
    ),
    check(
      "project_github_repository_link_stop_reason_check",
      sql`${table.stopReason} is null or ${table.stopReason} in ('App uninstalled', 'Access revoked', 'Repository not found')`,
    ),
    check(
      "project_github_repository_link_triage_state_check",
      sql`${table.triageState} in ('Pending', 'Skipped')`,
    ),
  ],
);

/** Earlier owner and name labels of the same stable repository id. */
export const githubRepositoryLinkName = pgTable(
  "project_github_repository_link_name",
  {
    linkId: text("link_id")
      .notNull()
      .references(() => githubRepositoryLink.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    observedAt: timestamp("observed_at").notNull(),
    owner: text("owner").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.linkId, table.observedAt],
      name: "project_github_repository_link_name_pk",
    }),
  ],
);

/**
 * GitHub dış kaydı: a read-only source snapshot with its own product identity.
 * Only the PRD 12 allow-listed fields exist here: no body, file tree, blob,
 * diff, full check log or free webhook payload.
 */
export const githubExternalRecord = pgTable(
  "project_github_external_record",
  {
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    githubId: bigint("github_id", { mode: "number" }).notNull(),
    htmlUrl: text("html_url").notNull(),
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    labels: text("labels").array().notNull().default(sql`'{}'::text[]`),
    linkId: text("link_id")
      .notNull()
      .references(() => githubRepositoryLink.id, { onDelete: "cascade" }),
    milestone: text("milestone"),
    number: integer("number").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    sourceState: text("source_state").notNull(),
    sourceUpdatedAt: timestamp("source_updated_at").notNull(),
    title: text("title").notNull(),
  },
  (table) => [
    uniqueIndex("project_github_external_record_source_idx").on(
      table.linkId,
      table.kind,
      table.githubId,
    ),
    index("project_github_external_record_project_idx").on(
      table.projectId,
      table.sourceUpdatedAt,
    ),
    check(
      "project_github_external_record_kind_check",
      sql`${table.kind} in ('Issue', 'Pull request')`,
    ),
    check(
      "project_github_external_record_state_check",
      sql`${table.sourceState} in ('open', 'closed', 'merged')`,
    ),
  ],
);
