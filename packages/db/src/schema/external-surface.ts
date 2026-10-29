import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { workspace } from "./auth";
import { document } from "./document";
import { project } from "./project";

export const externalSurface = pgTable(
  "external_surface",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    documentId: text("document_id").references(() => document.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** Link Sharing only: the shared main record; null for other surfaces. */
    rootId: text("root_id"),
    rootKind: text("root_kind"),
    /** Link Sharing only: `Link-limited share`; null for other surfaces. */
    surfaceKind: text("surface_kind"),
    /**
     * Link Sharing only: bumped by every password or token change; a visitor
     * session minted under an older value is no longer valid.
     */
    accessEpoch: integer("access_epoch").notNull().default(0),
    /** Link Sharing only: scrypt hash of the optional link password (Secret). */
    passwordHash: text("password_hash"),
    /** Link Sharing only: SHA-256 of the share token (Secret); never the token. */
    tokenHash: text("token_hash"),
  },
  (table) => [
    uniqueIndex("external_surface_token_hash_uidx").on(table.tokenHash),
  ],
);

/** Link Sharing: a visitor's `Paylaşım erişim oturumu`; never a Better Auth session. */
export const linkShareVisitorSession = pgTable(
  "link_share_visitor_session",
  {
    id: text("id").primaryKey(),
    surfaceId: text("surface_id")
      .notNull()
      .references(() => externalSurface.id, { onDelete: "cascade" }),
    /** SHA-256 of the cookie secret; the secret itself is never stored. */
    secretHash: text("secret_hash").notNull(),
    accessEpoch: integer("access_epoch").notNull(),
    createdAt: timestamp("created_at").notNull(),
    /** Fixed at creation + 12 hours; activity never moves it. */
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    index("link_share_visitor_session_surface_idx").on(table.surfaceId),
    index("link_share_visitor_session_expires_idx").on(table.expiresAt),
  ],
);

/**
 * Link Sharing gate attempts, keyed by a keyed hash that rotates daily. There
 * is no raw IP or device value; rows are deleted 24 hours after the last
 * attempt.
 */
export const linkShareGateAttempt = pgTable(
  "link_share_gate_attempt",
  {
    key: text("key").primaryKey(),
    failures: integer("failures").notNull(),
    lastAttemptAt: timestamp("last_attempt_at").notNull(),
    lockedUntil: timestamp("locked_until"),
  },
  (table) => [
    index("link_share_gate_attempt_last_attempt_idx").on(table.lastAttemptAt),
  ],
);

export const externalSurfaceSnapshotRevision = pgTable(
  "external_surface_snapshot_revision",
  {
    id: text("id").primaryKey(),
    surfaceId: text("surface_id")
      .notNull()
      .references(() => externalSurface.id, { onDelete: "cascade" }),
    revision: integer("revision").notNull(),
    snapshot: jsonb("snapshot").$type<unknown>().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    /** Link Sharing idempotency: one approval attempt writes one revision. */
    approvalFingerprint: text("approval_fingerprint"),
    approvalId: text("approval_id"),
    /** Link Sharing: the separate `Publish/share anyway` confirmation. */
    placeholdersAcknowledged: boolean("placeholders_acknowledged")
      .notNull()
      .default(false),
  },
  (table) => [
    uniqueIndex("external_surface_snapshot_revision_approval_uidx").on(
      table.approvalId,
    ),
    uniqueIndex("external_surface_snapshot_revision_uidx").on(
      table.surfaceId,
      table.revision,
    ),
    check(
      "external_surface_snapshot_revision_check",
      sql`${table.revision} > 0`,
    ),
  ],
);
