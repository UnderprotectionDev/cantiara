import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

import "./local-postgres";

import type { DatabaseConfig } from "./config";
import { reportIdleClientError } from "./pool-error";
import {
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  completionEffectPreferences,
  dailyFocusMembership,
  decision,
  decisionRelations,
  document,
  favoriteMembership,
  fileAttachment,
  fileAttachmentMarking,
  fileAttachmentMarkingRelations,
  fileAttachmentRelations,
  fileAttachmentUpload,
  fileAttachmentVersion,
  fileAttachmentVersionRelations,
  productionIncident,
  productionIncidentRelations,
  project,
  projectGoal,
  projectGoalRelations,
  projectLastVisit,
  projectMilestone,
  projectMilestoneRelations,
  projectRelations,
  projectRelease,
  projectReleaseRelations,
  projectShortCode,
  projectShortCodeRelations,
  projectUpdate,
  projectUpdateLink,
  projectUpdateLinkRelations,
  projectUpdateRelations,
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
  workLastVisit,
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
import { evidenceBinding, recordOrigin } from "./schema/evidence";
import { feedback } from "./schema/feedback";
import {
  mutationHistory,
  mutationReceipt,
  mutationStaging,
  mutationTarget,
} from "./schema/mutation";
import {
  personalReminder,
  personalReminderAttentionSignal,
} from "./schema/personal-reminders";
import {
  prioritizationSession,
  prioritizationSessionWork,
} from "./schema/prioritization-session";
import {
  priorityMetricDefinition,
  workPriorityMetricValue,
} from "./schema/priority-metrics";
import {
  researchSession,
  researchSessionBindingPreview,
} from "./schema/research-session";
import { roadmapView } from "./schema/roadmap-horizon";
import {
  smartCollection,
  smartCollectionAttentionSignal,
  smartCollectionSubscription,
  smartCollectionSubscriptionMembership,
  smartCollectionView,
} from "./schema/smart-collection";
import { source, sourceVersion } from "./schema/source";
import {
  workspaceTag,
  workspaceTagAssignment,
  workspaceTagAssignmentRelations,
  workspaceTagRelations,
} from "./schema/tags";
import { trashEntry } from "./schema/trash";
import {
  workExternalExecutionHandoff,
  workExternalExecutionHandoffAttentionSignal,
} from "./schema/work-external-handoff";

const schema = {
  trashEntry,
  source,
  sourceVersion,
  account,
  accountPreferences,
  accountPreferencesRelations,
  accountRelations,
  auditRecord,
  completionEffectPreferences,
  projectBacklogOrder,
  roadmapView,
  researchSession,
  researchSessionBindingPreview,
  evidenceBinding,
  recordOrigin,
  feedback,
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
  favoriteMembership,
  decision,
  decisionRelations,
  document,
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
  projectGoal,
  projectGoalRelations,
  projectMilestone,
  projectMilestoneRelations,
  projectRelease,
  projectReleaseRelations,
  projectRelations,
  projectShortCode,
  projectLastVisit,
  workLastVisit,
  projectShortCodeRelations,
  priorityMetricDefinition,
  personalReminder,
  personalReminderAttentionSignal,
  prioritizationSession,
  prioritizationSessionWork,
  smartCollection,
  smartCollectionView,
  smartCollectionSubscription,
  smartCollectionSubscriptionMembership,
  smartCollectionAttentionSignal,
  productionIncident,
  productionIncidentRelations,
  projectUpdate,
  projectUpdateLink,
  projectUpdateLinkRelations,
  projectUpdateRelations,
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
  pool.on("error", reportIdleClientError);
  return drizzle({ client: pool, schema });
}

export type Database = ReturnType<typeof createDb>;
