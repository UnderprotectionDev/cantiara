import { sql } from "drizzle-orm";
import {
  check,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user, workspace } from "./auth";

/** Personal references deliberately survive source deletion. */
export const favoriteMembership = pgTable(
  "favorite_membership",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    sourceRecordId: text("source_record_id").notNull(),
    sourceRecordType: text("source_record_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("favorite_membership_source_uidx").on(
      table.accountId,
      table.workspaceId,
      table.sourceRecordType,
      table.sourceRecordId,
    ),
    check(
      "favorite_membership_source_type_check",
      sql`${table.sourceRecordType} in ('Project', 'Document', 'Work', 'Decision', 'Smart Collection')`,
    ),
  ],
);
