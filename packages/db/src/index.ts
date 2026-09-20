import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import "./local-postgres";

import type { DatabaseConfig } from "./config";
import {
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  project,
  projectRelations,
  projectShortCode,
  projectShortCodeRelations,
  rateLimit,
  session,
  sessionRelations,
  usageLink,
  usageLinkRelations,
  user,
  userRelations,
  verification,
  work,
  workDraft,
  workKeyAllocation,
  workKeyAllocationRelations,
  workRelation,
  workRelationRelations,
  workRelations,
  workspace,
  workspaceRelations,
} from "./schema";
import {
  captureExtensionLink,
  captureExtensionPairingCode,
  captureInboxBulkView,
  captureInboxItem,
  captureInboxOperation,
} from "./schema/capture-triage";
import {
  customFieldDefinition,
  customFieldValue,
} from "./schema/custom-fields";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "./schema/mutation";
import {
  workspaceTag,
  workspaceTagAssignment,
  workspaceTagAssignmentRelations,
  workspaceTagRelations,
} from "./schema/tags";

const schema = {
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  captureInboxBulkView,
  captureInboxItem,
  captureInboxOperation,
  captureExtensionLink,
  captureExtensionPairingCode,
  customFieldDefinition,
  customFieldValue,
  workspaceTag,
  workspaceTagAssignment,
  workspaceTagAssignmentRelations,
  workspaceTagRelations,
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
  project,
  projectRelations,
  projectShortCode,
  projectShortCodeRelations,
  rateLimit,
  session,
  sessionRelations,
  user,
  userRelations,
  usageLink,
  usageLinkRelations,
  verification,
  workRelation,
  workRelationRelations,
  workspace,
  workspaceRelations,
  work,
  workDraft,
  workKeyAllocation,
  workKeyAllocationRelations,
  workRelations,
};

export function createDb(env: DatabaseConfig) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDb>;
