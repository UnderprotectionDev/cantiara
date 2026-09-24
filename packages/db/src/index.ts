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
  completionEffectPreferences,
  dailyFocusMembership,
  fileAttachment,
  fileAttachmentMarking,
  fileAttachmentMarkingRelations,
  fileAttachmentRelations,
  fileAttachmentUpload,
  fileAttachmentVersion,
  fileAttachmentVersionRelations,
  project,
  projectRelations,
  projectShortCode,
  projectShortCodeRelations,
  rateLimit,
  recordAction,
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
import { projectBacklogOrder } from "./schema/backlog";
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
  prioritizationSession,
  prioritizationSessionWork,
} from "./schema/prioritization-session";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "./schema/priority-metrics";
import {
  workspaceTag,
  workspaceTagAssignment,
  workspaceTagAssignmentRelations,
  workspaceTagRelations,
} from "./schema/tags";
import {
  workExternalExecutionHandoff,
  workExternalExecutionHandoffAttentionSignal,
} from "./schema/work-external-handoff";

const schema = {
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  completionEffectPreferences,
  projectBacklogOrder,
  fileAttachment,
  fileAttachmentMarking,
  fileAttachmentMarkingRelations,
  fileAttachmentRelations,
  fileAttachmentUpload,
  fileAttachmentVersion,
  fileAttachmentVersionRelations,
  captureInboxBulkView,
  captureInboxItem,
  captureInboxOperation,
  captureExtensionLink,
  captureExtensionPairingCode,
  dailyFocusMembership,
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
  priorityMetricDefinition,
  prioritizationSession,
  prioritizationSessionWork,
  rateLimit,
  recordAction,
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
  workPriorityMetricValue,
  workDraft,
  workKeyAllocation,
  workKeyAllocationRelations,
  workRelations,
  workExternalExecutionHandoff,
  workExternalExecutionHandoffAttentionSignal,
};

export function createDb(env: DatabaseConfig) {
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDb>;
