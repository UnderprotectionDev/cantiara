import { ORPCError, type RouterClient } from "@orpc/server";
import { z } from "zod";
import {
  type AccountPreferences,
  type AccountPreferencesSnapshot,
  accountPreferencesSchema,
  appearanceSchema,
} from "../account-preferences";
import {
  projectBacklogInputSchema,
  saveBacklogPresentationInputSchema,
  saveBacklogPresentationMutationInputSchema,
  updateBacklogOrderInputSchema,
  updateBacklogOrderMutationInputSchema,
} from "../backlog";
import {
  type CaptureInboxAccess,
  type CaptureInboxTriageAccess,
  captureAttachInputSchema,
  captureAttachPreviewInputSchema,
  captureBulkSenseMakingInputSchema,
  captureConvertInputSchema,
  captureConvertPreviewInputSchema,
  captureDeleteInputSchema,
  captureInputSchema,
  captureSuggestionsInputSchema,
  captureUndoMergeInputSchema,
  captureUndoMergePreviewInputSchema,
} from "../capture-triage";
import {
  type CompletionEffectsPreferences,
  type CompletionEffectsPreferencesSnapshot,
  completionEffectsPreferencesSchema,
} from "../completion-effects";
import {
  CONFIRM_GITHUB_IDENTITY_OPERATION_IDS,
  type Context,
} from "../context";
import {
  type CustomFieldMutationValue,
  type CustomFieldValueMutationValue,
  clearCustomFieldValueInputSchema,
  clearCustomFieldValueMutationInputSchema,
  copyCustomFieldDefinitionsInputSchema,
  createCustomFieldInputSchema,
  createCustomFieldMutationInputSchema,
  customFieldProjectValuesInputSchema,
  customFieldSearchFieldsInputSchema,
  customFieldValuesInputSchema,
  deleteCustomFieldMutationInputSchema,
  previewCustomFieldOptionDeletionInputSchema,
  restoreCustomFieldMutationInputSchema,
  setCustomFieldValueInputSchema,
  setCustomFieldValueMutationInputSchema,
  trashCustomFieldMutationInputSchema,
  updateCustomFieldInputSchema,
  updateCustomFieldMutationInputSchema,
} from "../custom-fields";
import {
  DailyFocusWorkUnavailableError,
  dailyFocusDayInputSchema,
  dailyFocusMembershipInputSchema,
} from "../daily-focus";
import {
  decisionSupersessionCommandSchema,
  decisionSupersessionSelectionSchema,
} from "../decision-supersession";
import {
  createDocumentFromTemplateInputSchema,
  createDocumentTemplateInputSchema,
  documentTemplateDefinitionSchema,
  documentTemplateSchema,
  documentTemplateScopeSchema,
  documentTemplateSkeleton,
  personalReviewTemplate,
  renderDocumentTemplate,
  updateDocumentTemplateInputSchema,
} from "../document-templates";
import {
  DocumentTransferError,
  documentTransferInputSchema,
  documentTransferMutationInputSchema,
} from "../document-transfer";
import {
  transferDocumentMutationInputSchema,
  type DocumentTransferInput as WikiDocumentTransferInput,
  documentTransferInputSchema as wikiDocumentTransferInputSchema,
} from "../document-transfers";
import {
  createDocumentMutationInputSchema,
  DocumentConflictDraftError,
  DocumentHierarchyError,
  type DocumentMutationValue,
  DocumentSectionCycleError,
  DocumentUnavailableError,
  discardDocumentConflictDraftInputSchema,
  documentBodySchema,
  documentCreationFields,
  documentCreationInputSchema,
  documentIdSchema,
  documentLiveDirectives,
  documentLiveWorkIds,
  documentOrganizationInputSchema,
  documentSchema,
  documentVersionInputSchema,
  organizeDocumentMutationInputSchema,
  documentRecordReferences as parseDocumentRecordReferences,
  pinDocumentEvidenceInputSchema,
  projectIdSchema,
  restoreDocumentVersionInputSchema,
  updateDocumentInputSchema,
  updateDocumentMutationInputSchema,
} from "../documents";
import {
  cancelExternalExecutionHandoffInputSchema,
  confirmExternalExecutionHandoffReconcileInputSchema,
  listExternalExecutionHandoffHistoryInputSchema,
  listExternalExecutionHandoffRelatedWorksInputSchema,
  listExternalExecutionHandoffsInputSchema,
  previewExternalExecutionHandoffReconcileInputSchema,
  recordExternalExecutionHandoffPackageExportInputSchema,
  recordExternalExecutionHandoffReturnInputSchema,
  startExternalExecutionHandoffMutationInputSchema,
} from "../external-handoffs";
import {
  FavoriteSourceUnavailableError,
  favoriteSourceSchema,
} from "../favorites";
import {
  fileAttachmentFinalizeInputSchema,
  fileAttachmentListInputSchema,
  fileAttachmentLocationBindInputSchema,
  fileAttachmentLocationBindPreviewInputSchema,
  fileAttachmentMarkingInputSchema,
  fileAttachmentMarkingsInputSchema,
  fileAttachmentPreviewInputSchema,
  fileAttachmentUndoMarkingInputSchema,
} from "../file-attachments";
import {
  createFocusPeriodInputSchema,
  FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE,
  FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE,
  FocusPeriodConflictError,
  FocusPeriodUnavailableError,
  focusPeriodDecisionInputSchema,
  focusPeriodEvaluationInputSchema,
  focusPeriodFollowUpWorkInputSchema,
  focusPeriodIdInputSchema,
  focusPeriodMembershipInputSchema,
} from "../focus-period";
import { protectedProcedure, publicProcedure } from "../index";
import {
  humanMutationEnvelopeSchema,
  MUTATION_UI_LABELS,
  type MutationApply,
  type MutationCommand,
  type MutationPayload,
  type MutationReceipt,
} from "../mutation-and-undo";
import {
  cancelPersonalReminderInputSchema,
  cancelWorkReviewLaterInputSchema,
  createPersonalReminderInputSchema,
  createWorkReviewLaterInputSchema,
  personalReminderSignalInputSchema,
  personalRemindersInputSchema,
  reschedulePersonalReminderSignalInputSchema,
  workReviewLaterInputSchema,
} from "../personal-reminders";
import {
  closePrioritizationSessionInputSchema,
  closePrioritizationSessionMutationInputSchema,
  createPrioritizationSessionInputSchema,
  createPrioritizationSessionMutationInputSchema,
  type PrioritizationSessionMutationValue,
  prioritizationSessionsProjectInputSchema,
  restorePrioritizationSessionInputSchema,
  restorePrioritizationSessionMutationInputSchema,
  trashPrioritizationSessionInputSchema,
  trashPrioritizationSessionMutationInputSchema,
  updatePrioritizationSessionOrderInputSchema,
  updatePrioritizationSessionOrderMutationInputSchema,
} from "../prioritization-sessions";
import {
  clearPriorityMetricValueInputSchema,
  clearPriorityMetricValueMutationInputSchema,
  copyPriorityMetricDefinitionsInputSchema,
  createPriorityMetricInputSchema,
  createPriorityMetricMutationInputSchema,
  deletePriorityMetricMutationInputSchema,
  type PriorityMetricDefinitionsCopyMutationValue,
  type PriorityMetricMutationContracts,
  type PriorityMetricMutationValue,
  type PriorityMetricsAccess,
  type PriorityMetricValueMutationValue,
  priorityMetricProjectValuesInputSchema,
  priorityMetricTrashImpactPreviewInputSchema,
  priorityMetricValuesInputSchema,
  restorePriorityMetricMutationInputSchema,
  setPriorityMetricValueInputSchema,
  setPriorityMetricValueMutationInputSchema,
  trashPriorityMetricMutationInputSchema,
  updatePriorityMetricInputSchema,
  updatePriorityMetricMutationInputSchema,
} from "../priority-metrics";
import {
  createProjectGoalInputSchema,
  ProjectGoalConflictError,
  projectGoalInputSchema,
  projectGoalRelationInputSchema,
  projectGoalsProjectInputSchema,
  updateProjectGoalInputSchema,
} from "../project-goals";
import {
  applyProjectShellConfigurationChange,
  createProjectInputSchema,
  createProjectMutationInputSchema,
  enableProjectArea,
  enableProjectAreaInputSchema,
  getProjectShellConfiguration,
  type ProjectShellMutationValue,
  previewWorkContextLayoutInputSchema,
  shortCodeSchema,
  suggestProjectShortCode,
  undoWorkContextLayoutInputSchema,
  updateProjectConfigurationInputSchema,
  updateProjectShortCodeInputSchema,
  type WorkContextLayoutMutationResult,
} from "../project-shell";
import {
  createProjectSourceRecordInputSchema,
  ProjectSourceRecordConflictError,
  type ProjectSourceType,
  projectSourceRecordInputSchema,
  projectSourceRecordsProjectInputSchema,
  transitionProjectSourceRecordInputSchema,
  updateProjectSourceRecordInputSchema,
} from "../project-source-records";
import type { RecordActionsAccess } from "../record-actions";
import {
  applyRecordActionInputSchema,
  createRecordActionInputSchema,
  createRecordActionMutationInputSchema,
  previewRecordActionInputSchema,
  recordActionsInputSchema,
  trashRecordActionMutationInputSchema,
  undoRecordActionInputSchema,
  updateRecordActionInputSchema,
  updateRecordActionMutationInputSchema,
} from "../record-actions";
import {
  documentDiscoveryInputSchema,
  recordTableCellUpdateInputSchema,
  recordTableInputSchema,
  recordTablePasteInputSchema,
  universalSearchInputSchema,
} from "../record-discovery";
import {
  createUsageLinkMutationInputSchema,
  listUsageLinksInputSchema,
  reactivateBlockerInputSchema,
  relationCreateInputSchema,
  relationCreatePreviewInputSchema,
  relationsInputSchema,
  removeRelationInputSchema,
  resolveBlockerInputSchema,
  type UsageLinkMutationValue,
  undoRelationInputSchema,
  unlinkUsageLinkInputSchema,
  usageLinkPayloadSchema,
  usageLinkSchema,
} from "../relations";
import {
  returnContextInputSchema,
  saveNextConcreteStepInputSchema,
} from "../return-to-work";
import {
  createMilestoneInputSchema,
  projectRoadmapInputSchema,
  saveRoadmapViewInputSchema,
  updateMilestoneInputSchema,
  updateMilestoneStatusInputSchema,
  updateResearchDirectionInputSchema,
  updateWorkHorizonInputSchema,
} from "../roadmap-horizon";
import {
  createSmartCollectionInputSchema,
  SmartCollectionConflictError,
  SmartCollectionUnavailableError,
  setSmartCollectionSubscriptionInputSchema,
} from "../smart-collections";
import {
  applyTagInputSchema,
  createTagInputSchema,
  removeTagInputSchema,
  renameTagCommandSchema,
  renameTagMutationInputSchema,
  type TagMutationValue,
  tagRecordsInputSchema,
  tagsInputSchema,
  undoTagRenameInputSchema,
} from "../tags";
import {
  confirmMermaidConversionInputSchema,
  createDiagramViewInputSchema,
  mermaidConversionInputSchema,
} from "../technical-diagrams";
import type { WebCaptureAccess } from "../web-capture";
import {
  previewWorkContextLayout,
  type WorkContextAccess,
  workContextInputSchema,
} from "../work-context";
import {
  deleteWorkDraftInputSchema,
  finalizeWorkDraftInputSchema,
  saveWorkDraftInputSchema,
  type WorkDraftsAccess,
  workDraftInputSchema,
  workDraftsInputSchema,
} from "../work-drafts";
import {
  closeWorkInputSchema,
  convertWorkChecklistItemInputSchema,
  createDocumentWorkBatchInputSchema,
  createWorkRpcMutationInputSchema,
  detachFeatureHealthHistoryInputSchema,
  detachIncludedWorkInputSchema,
  includeWorkInputSchema,
  mergeWorkInputSchema,
  recordFeatureHealthInputSchema,
  recreateWorkInputSchema,
  reopenWorkInputSchema,
  undoWorkDateInputSchema,
  undoWorkMergeInputSchema,
  undoWorkStatusInputSchema,
  updateFeaturePrimarySpecInputSchema,
  updateWorkChecklistInputSchema,
  updateWorkDateInputSchema,
  updateWorkPlannedDateInputSchema,
  updateWorkReappearDateInputSchema,
  updateWorkStatusInputSchema,
  updateWorkTypeInputSchema,
  workArchiveMutationInputSchema,
  workChecklistConversionPreviewInputSchema,
  workClosePreviewInputSchema,
  workIdentityInputSchema,
  workMergePreviewInputSchema,
  workRecreatePreviewInputSchema,
  workTypeChangePreviewInputSchema,
  workTypeSchema,
} from "../work-lifecycle";
import {
  reconsiderWorkNotNowInputSchema,
  recordWorkNotNowInputSchema,
  workNotNowHistoryInputSchema,
} from "../work-not-now";
import {
  createWorkTemplateInputSchema,
  createWorkTemplateMutationInputSchema,
  duplicateWorkMutationInputSchema,
  instantiateWorkTemplateMutationInputSchema,
  previewDuplicateWorkInputSchema,
  trashWorkTemplateMutationInputSchema,
  updateWorkTemplateInputSchema,
  updateWorkTemplateMutationInputSchema,
  workTemplatesInputSchema,
} from "../work-templates";
import {
  type WorkspaceOverviewAccess,
  workspaceOverviewPresentationSchema,
} from "../workspace-overview";

function sessionPrincipal(session: NonNullable<Context["session"]>) {
  return {
    accountId: session.user.id,
    sessionId: session.session.id,
  };
}

const WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX =
  "project.configuration.workContextLayouts.";

function workContextLayoutTypeFromUndoScope(scope: string | undefined) {
  if (!scope?.startsWith(WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX)) {
    return null;
  }
  const parsed = workTypeSchema.safeParse(
    scope.slice(WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX.length),
  );
  return parsed.success ? parsed.data : null;
}

const saveAccountPreferencesInputSchema = humanMutationEnvelopeSchema.extend({
  preferences: accountPreferencesSchema,
});
const legacySaveAccountPreferencesInputSchema = accountPreferencesSchema;
const saveAccountPreferencesProcedureInputSchema = z.union([
  saveAccountPreferencesInputSchema,
  legacySaveAccountPreferencesInputSchema,
]);

const saveAccountAppearanceInputSchema = humanMutationEnvelopeSchema.extend({
  appearance: appearanceSchema,
});
const legacySaveAccountAppearanceInputSchema = z
  .object({ appearance: appearanceSchema })
  .strict();
const saveAccountAppearanceProcedureInputSchema = z.union([
  saveAccountAppearanceInputSchema,
  legacySaveAccountAppearanceInputSchema,
]);

const saveCompletionEffectsPreferencesInputSchema =
  humanMutationEnvelopeSchema.extend({
    preferences: completionEffectsPreferencesSchema,
  });

const revokeWebCaptureLinkInputSchema = z
  .object({ linkId: z.string().trim().min(1).max(255) })
  .strict();

function requireAccountPreferencesMutationContract(context: Context) {
  if (!context.accountPreferencesMutationContract) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.accountPreferencesMutationContract;
}

function requireCompletionEffectsPreferencesAccess(context: Context) {
  if (!context.completionEffectsPreferences) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.completionEffectsPreferences;
}

function requireCompletionEffectsPreferencesMutationContract(context: Context) {
  if (!context.completionEffectsPreferencesMutationContract) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.completionEffectsPreferencesMutationContract;
}

function requireAccountPreferencesCompatibility(context: Context) {
  if (
    context.clientPlatform !== "tauri" ||
    !context.desktopApiContract ||
    !context.accountPreferencesCompatibility
  ) {
    throw new ORPCError("BAD_REQUEST");
  }
  return context.accountPreferencesCompatibility;
}

function requireProjectShell(context: Context) {
  if (!context.projectShell) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectShell;
}

function requireWorkspaceOverview(context: Context): WorkspaceOverviewAccess {
  if (!context.workspaceOverview) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workspaceOverview;
}

function requireWorkspaceOverviewWriter(context: Context) {
  const overview = requireWorkspaceOverview(context);
  if (!overview.savePresentation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return overview.savePresentation.bind(overview);
}

function requireUsageLinks(context: Context) {
  if (!context.usageLinks) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.usageLinks;
}

function requireUsageLinkMutationContracts(context: Context) {
  if (!context.usageLinkMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.usageLinkMutationContracts;
}

function requireDocumentMutationContracts(context: Context) {
  if (!context.documentMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.documentMutationContracts;
}

function requireBacklog(context: Context) {
  if (!context.backlog) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.backlog;
}

function requireReturnToWork(context: Context) {
  if (!context.returnToWork) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.returnToWork;
}

function requireFavorites(context: Context) {
  if (!context.favorites) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.favorites;
}

function requireDailyFocus(context: Context) {
  if (!context.dailyFocus) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.dailyFocus;
}

function requireFocusPeriod(context: Context) {
  if (!context.focusPeriod) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.focusPeriod;
}

function rethrowFocusPeriodError(error: unknown): never {
  if (error instanceof FocusPeriodUnavailableError) {
    throw new ORPCError("NOT_FOUND", { cause: error });
  }
  if (error instanceof FocusPeriodConflictError) {
    if (
      error.message === FOCUS_PERIOD_ACTIVE_MEMBERSHIP_CONFLICT_MESSAGE ||
      error.message === FOCUS_PERIOD_OVERLAPPING_MEMBERSHIP_CONFLICT_MESSAGE
    ) {
      throw new ORPCError("CONFLICT", {
        cause: error,
        message: error.message,
      });
    }
    throw new ORPCError("CONFLICT", { cause: error });
  }
  throw error;
}

function requireProjectSourceRecords(context: Context) {
  if (!context.projectSourceRecords) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectSourceRecords;
}

function rethrowProjectSourceRecordError(error: unknown): never {
  if (error instanceof ProjectSourceRecordConflictError) {
    throw new ORPCError("CONFLICT", { cause: error });
  }
  throw error;
}

function requireRoadmapHorizon(context: Context) {
  if (!context.roadmapHorizon) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.roadmapHorizon;
}

function requirePersonalReminders(context: Context) {
  if (!context.personalReminders) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.personalReminders;
}

function requireBacklogMutationContracts(context: Context) {
  if (!context.backlogMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.backlogMutationContracts;
}

function requireCustomFields(context: Context) {
  if (!context.customFields) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.customFields;
}

function requirePriorityMetrics(context: Context): PriorityMetricsAccess {
  if (!context.priorityMetrics) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.priorityMetrics;
}

function requirePriorityMetricMutationContracts(
  context: Context,
): PriorityMetricMutationContracts {
  if (!context.priorityMetricMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.priorityMetricMutationContracts;
}

function requirePrioritizationSessions(context: Context) {
  if (!context.prioritizationSessions) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.prioritizationSessions;
}

function requirePrioritizationSessionMutationContracts(context: Context) {
  if (!context.prioritizationSessionMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.prioritizationSessionMutationContracts;
}

function requireWorkTemplates(context: Context) {
  if (!context.workTemplates) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workTemplates;
}

function requireExternalExecutionHandoffs(context: Context) {
  if (!context.workHandoffs) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workHandoffs;
}

function rethrowExternalExecutionHandoffError(error: unknown): never {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EXTERNAL_HANDOFF_STALE_WORK" ||
      error.code === "EXTERNAL_HANDOFF_IDEMPOTENCY_CONFLICT" ||
      error.code === "EXTERNAL_HANDOFF_TERMINAL" ||
      error.code === "EXTERNAL_HANDOFF_RETURN_UNAVAILABLE" ||
      error.code === "EXTERNAL_HANDOFF_RECONCILE_PREVIEW_REQUIRED" ||
      error.code === "EXTERNAL_HANDOFF_RECONCILE_UNAVAILABLE")
  ) {
    throw new ORPCError("CONFLICT", {
      defined: true,
      message: "This handoff could not be written.",
    });
  }
  throw error;
}

function requireRecordActions(context: Context): RecordActionsAccess {
  if (!context.recordActions) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.recordActions;
}

function rethrowRecordActionError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "RECORD_ACTION_PROJECT_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }

  if (error.code === "RECORD_ACTION_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Record Action with this name already exists in this Project.",
    });
  }

  if (error.code === "RECORD_ACTION_STALE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Record Action changed. Reload and try again.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message: "Conflict",
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Work changed. Start the Record Action again to review it.",
    });
  }

  if (error.code === "UNDO_NOT_SUPPORTED") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Record Action could not be undone safely.",
    });
  }

  if (
    error.code === "RECORD_ACTION_STEP_UNAVAILABLE" ||
    error.code === "CUSTOM_FIELD_TRASHED" ||
    error.code === "CUSTOM_FIELD_NOT_FOUND" ||
    error.code === "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" ||
    error.code === "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" ||
    error.code === "CUSTOM_FIELD_OPTION_INVALID"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The Record Action was rejected.",
    });
  }

  throw error;
}

function rethrowWorkTemplateError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowWorkTemplateError(error.cause);
  }

  if (error.code === "WORK_TEMPLATE_PROJECT_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }

  if (error.code === "WORK_TEMPLATE_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Work Template with this name already exists in this Project.",
    });
  }

  if (error.code === "WORK_TEMPLATE_STALE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Work Template changed. Reload and try again.",
    });
  }

  if (
    error.code === "WORK_TEMPLATE_CUSTOM_FIELD_UNAVAILABLE" ||
    error.code === "CUSTOM_FIELD_TRASHED" ||
    error.code === "CUSTOM_FIELD_NOT_FOUND" ||
    error.code === "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" ||
    error.code === "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" ||
    error.code === "CUSTOM_FIELD_OPTION_INVALID"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The Work Template was rejected.",
    });
  }

  if (error.code === "WORK_DUPLICATE_SOURCE_STALE") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Work changed. Reload and try again.",
    });
  }

  const lifecycleError = mapWorkLifecycleError(error);
  if (lifecycleError) {
    throw lifecycleError;
  }

  throw error;
}

function requireCustomFieldMutationContracts(context: Context) {
  if (!context.customFieldMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.customFieldMutationContracts;
}

function requireTags(context: Context) {
  if (!context.tags) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.tags;
}

function requireTagMutationContracts(context: Context) {
  if (!context.tagMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.tagMutationContracts;
}

function requireProjectShellMutationContract(
  context: Context,
  operation: "create" | "update",
  accountId: string,
) {
  const contracts = context.projectShellMutationContracts;
  if (!contracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return contracts[operation](accountId);
}

function requireWorkLifecycle(context: Context) {
  if (!context.workLifecycle) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workLifecycle;
}

function requireRelations(context: Context) {
  if (!context.relations) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.relations;
}

function requireWorkContext(context: Context): WorkContextAccess {
  if (!context.workContext) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workContext;
}

function requireWorkDrafts(context: Context): WorkDraftsAccess {
  if (!context.workDrafts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.workDrafts;
}

function requireCaptureInbox(context: Context): CaptureInboxAccess {
  if (!context.captureInbox) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.captureInbox;
}

function requireWebCapture(context: Context): WebCaptureAccess {
  if (!context.webCapture) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.webCapture;
}

function requireFileAttachments(context: Context) {
  if (!context.fileAttachments) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.fileAttachments;
}

type DocumentReference = ReturnType<
  typeof parseDocumentRecordReferences
>[number];
type DocumentLiveDirective = ReturnType<typeof documentLiveDirectives>[number];
type PinnedEvidenceRecordType = z.infer<
  typeof pinDocumentEvidenceInputSchema
>["targetRecordType"];

async function pinnedEvidenceTargetProjectId(
  context: Context,
  accountId: string,
  recordType: PinnedEvidenceRecordType,
  recordId: string,
) {
  switch (recordType) {
    case "Work":
      return (await context.workLifecycle?.find(accountId, recordId))
        ?.projectId;
    case "Document":
      return (await context.documents?.get(accountId, recordId))?.projectId;
    case "Technical Diagram":
      return (await context.technicalDiagrams?.get(accountId, recordId))
        ?.projectId;
    default:
      return (
        await context.projectSourceRecords?.find(
          accountId,
          recordType as ProjectSourceType,
          recordId,
        )
      )?.projectId;
  }
}

async function documentReferenceSource(
  context: Context,
  accountId: string,
  reference: DocumentReference,
) {
  switch (reference.recordType) {
    case "Work": {
      const record = await context.workLifecycle?.find(
        accountId,
        reference.recordId,
      );
      return record
        ? {
            id: record.id,
            projectId: record.projectId,
            title: `${record.key} · ${record.title}`,
          }
        : null;
    }
    case "Document": {
      const record = await context.documents?.get(
        accountId,
        reference.recordId,
      );
      return record
        ? {
            id: record.id,
            projectId: record.projectId,
            title: record.title,
          }
        : null;
    }
    case "Technical Diagram": {
      const record = await context.technicalDiagrams?.get(
        accountId,
        reference.recordId,
      );
      return record
        ? { id: record.id, projectId: record.projectId, title: record.title }
        : null;
    }
    default: {
      const record = await context.projectSourceRecords?.find(
        accountId,
        reference.recordType as ProjectSourceType,
        reference.recordId,
      );
      if (!record) {
        return null;
      }
      return {
        id: record.id,
        projectId: record.projectId,
        title: "name" in record ? record.name : record.title,
      };
    }
  }
}

async function liveDocumentBlockSource(
  context: Context,
  accountId: string,
  directive: DocumentLiveDirective,
) {
  if (directive.kind === "Work") {
    return null;
  }
  if (directive.kind === "Document section") {
    if (!directive.sectionId) {
      return null;
    }
    return (
      (await context.documents?.getLiveSection?.(
        accountId,
        directive.id,
        directive.sectionId,
      )) ?? null
    );
  }
  if (directive.kind === "Smart Collection") {
    return (
      (await context.smartCollections?.getView(accountId, directive.id)) ?? null
    );
  }
  return (
    (await context.technicalDiagrams?.get(
      accountId,
      directive.id,
      directive.viewId,
    )) ?? null
  );
}

function rethrowFileAttachmentError(error: unknown): never {
  if (!isRecord(error) || typeof error.code !== "string") {
    throw error;
  }
  const message =
    typeof error.message === "string"
      ? error.message
      : "File Attachment request was rejected.";
  switch (error.code) {
    case "FILE_ATTACHMENT_IDEMPOTENCY_CONFLICT":
    case "FILE_ATTACHMENT_REVISION_CONFLICT":
      throw new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message,
      });
    case "FILE_ATTACHMENT_ACCOUNT_NOT_FOUND":
    case "FILE_ATTACHMENT_TARGET_NOT_FOUND":
    case "FILE_ATTACHMENT_UPLOAD_NOT_FOUND":
      throw new ORPCError("NOT_FOUND", {
        data: { code: error.code },
        defined: true,
        message,
      });
    case "FILE_ATTACHMENT_PREVIEW_UNAVAILABLE":
      throw new ORPCError("SERVICE_UNAVAILABLE", {
        data: { code: error.code },
        defined: true,
        message,
      });
    case "FILE_ATTACHMENT_QUOTA_EXCEEDED":
      throw new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message,
      });
    default:
      if (error.code.startsWith("FILE_ATTACHMENT_")) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          data: { code: error.code },
          defined: true,
          message,
        });
      }
      throw error;
  }
}

function rethrowFileAttachmentWorkError(error: unknown): never {
  if (
    isRecord(error) &&
    typeof error.code === "string" &&
    error.code.startsWith("FILE_ATTACHMENT_")
  ) {
    rethrowFileAttachmentError(error);
  }
  rethrowWorkLifecycleError(error);
}

function requireCaptureInboxTriage(context: Context): CaptureInboxTriageAccess {
  const captureInbox = requireCaptureInbox(context);
  if (!isCaptureInboxTriage(captureInbox)) {
    throw new ORPCError("NOT_IMPLEMENTED", {
      data: { code: "CAPTURE_TRIAGE_UNAVAILABLE" },
      defined: true,
      message: "Capture triage is not available yet.",
    });
  }
  return captureInbox;
}

function isCaptureInboxTriage(
  captureInbox: CaptureInboxAccess,
): captureInbox is CaptureInboxTriageAccess {
  return (
    "attachToExisting" in captureInbox &&
    typeof captureInbox.attachToExisting === "function" &&
    "convert" in captureInbox &&
    typeof captureInbox.convert === "function" &&
    "delete" in captureInbox &&
    typeof captureInbox.delete === "function" &&
    "previewAttachToExisting" in captureInbox &&
    typeof captureInbox.previewAttachToExisting === "function" &&
    "previewConvert" in captureInbox &&
    typeof captureInbox.previewConvert === "function" &&
    "previewUndoMerge" in captureInbox &&
    typeof captureInbox.previewUndoMerge === "function" &&
    "suggestions" in captureInbox &&
    typeof captureInbox.suggestions === "function" &&
    "undoMerge" in captureInbox &&
    typeof captureInbox.undoMerge === "function"
  );
}

function rethrowUnavailableCaptureWorkCreate(
  error: Record<string, unknown>,
): void {
  if (
    error.code === "CAPTURE_WORK_CREATE_UNAVAILABLE" ||
    error.code === "CAPTURE_TRIAGE_UNAVAILABLE"
  ) {
    let message = "Work creation is not available yet.";
    if (error.code === "CAPTURE_TRIAGE_UNAVAILABLE") {
      message = "Capture triage is not available yet.";
    }
    const { message: errorMessage } = error;
    if (typeof errorMessage === "string") {
      message = errorMessage;
    }
    throw new ORPCError("NOT_IMPLEMENTED", {
      data: { code: error.code },
      defined: true,
      message,
    });
  }
}

function rethrowCaptureConflict(error: Record<string, unknown>): void {
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        ...(typeof error.targetId === "string"
          ? { targetId: error.targetId }
          : {}),
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
}

function rethrowCaptureInboxError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  rethrowUnavailableCaptureWorkCreate(error);
  rethrowCaptureConflict(error);

  if (
    typeof error.code === "string" &&
    (error.code.startsWith("CAPTURE_") ||
      error.code === "UNKNOWN_CAPTURE_FIELD")
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Capture Inbox request was rejected.",
    });
  }

  if (
    error.code === "PROJECT_REQUIRED_FOR_CREATE_BUG" ||
    error.code === "PROJECT_REQUIRED_FOR_WORK_CONVERSION" ||
    error.code === "CREATE_BUG_TEMPLATE_UNSUPPORTED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        "message" in error && typeof error.message === "string"
          ? error.message
          : "Create Bug is unavailable in this context.",
    });
  }

  if (error.code === "WORK_PROJECT_NOT_FOUND") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message: "Choose an available Project.",
    });
  }

  const workLifecycleError = mapWorkLifecycleError(error);
  if (workLifecycleError) {
    throw workLifecycleError;
  }

  throw error;
}

function mapWorkLifecycleFeatureError(error: Record<string, unknown>) {
  if (error.code === "WORK_FEATURE_EXIT_BLOCKED") {
    return new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(isRecord(error.blockers) ? { blockers: error.blockers } : {}),
      },
      defined: true,
      message:
        "Detach included Work, Feature health history, and Primary spec before leaving Feature.",
    });
  }

  return null;
}

function mapWorkLifecycleError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> | null {
  if (error.code === "APPLY_FAILED") {
    return isRecord(error.cause) ? mapWorkLifecycleError(error.cause) : null;
  }

  switch (error.code) {
    case "WORK_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Work is unavailable.",
      });
    case "RESEARCH_DIRECTION_UNAVAILABLE":
      return new ORPCError("BAD_REQUEST", {
        defined: true,
        message: "Research direction belongs to Research Work.",
      });
    case "WORK_PROJECT_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Project is unavailable.",
      });
    case "WORK_CREATION_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "Work could not be created. Try again.",
      });
    case "WORK_PRIMARY_SPEC_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        data: { code: error.code },
        defined: true,
        message: "Primary spec is unavailable.",
      });
    case "WORK_PRIMARY_SPEC_UNAVAILABLE":
      return new ORPCError("NOT_IMPLEMENTED", {
        data: { code: error.code },
        defined: true,
        message: "Primary spec is not available yet.",
      });
    case "WORK_TYPE_IMPACT_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: error.code,
          ...(typeof error.previewId === "string"
            ? { previewId: error.previewId }
            : {}),
        },
        defined: true,
        message:
          "Impact preview is required before changing to or from Feature.",
      });
    case "WORK_RECREATE_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Review the current recreate preview before confirming.",
      });
    case "WORK_CHECKLIST_CONVERT_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message:
          "Review the current checklist conversion preview before confirming.",
      });
    case "WORK_CHECKLIST_CONVERSION_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          "Converted checklist Work links can only be changed through conversion.",
      });
    case "WORK_CHECKLIST_ITEM_TITLE_TOO_LONG":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          "Checklist item text is too long to become a Work title. Shorten the item text before converting.",
      });
    case "WORK_MERGE_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Review the current Merge Preview before confirming.",
      });
    case "WORK_MERGE_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "The selected Work merge is no longer available.",
      });
    case "WORK_MERGE_RESOLUTION_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: {
          code: error.code,
          ...(Array.isArray(error.fields) ? { fields: error.fields } : {}),
        },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "Resolve every Field conflict before confirming the merge.",
      });
    case "WORK_MERGE_UNSUPPORTED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "This Work merge is not supported.",
      });
    case "WORK_MERGE_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Work merge is no longer available for Undo.",
      });
    case "WORK_STATUS_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Work status change is no longer available for Undo.",
      });
    case "WORK_DATE_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Work date change is no longer available for Undo.",
      });
    case "WORK_RELATION_NOT_PORTABLE":
    case "WORK_RECREATE_FIELD_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "The recreate selection is unavailable.",
      });
    case "WORK_CLOSURE_RESULT_REQUIRED":
    case "WORK_CLOSURE_CHECK_REQUIRED":
    case "WORK_REOPEN_CONFIRMATION_REQUIRED":
    case "WORK_ALREADY_CLOSED":
    case "WORK_NOT_CLOSED":
    case "WORK_VISIBLE_USER_INITIATOR_REQUIRED":
      return mapWorkLifecyclePreconditionError(error);
    case "WORK_FEATURE_EXIT_BLOCKED":
      return mapWorkLifecycleFeatureError(error);
    case "WORK_INCLUSION_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "Work inclusion could not be changed.",
      });
    case "WORK_FEATURE_REQUIRED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message: "This action is available only for Feature Work.",
      });
    case "CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "Work could not be changed. Try again.",
      });
    case "STALE_BASE_REVISION":
      return mapWorkLifecycleStaleRevisionError(error);
    case "TARGET_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Work is unavailable.",
      });
    default:
      return null;
  }
}

function mapWorkLifecycleStaleRevisionError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> {
  return new ORPCError("PRECONDITION_FAILED", {
    data: {
      code: error.code,
      ...(typeof error.currentRevision === "number"
        ? { currentRevision: error.currentRevision }
        : {}),
      ...(typeof error.currentValue === "object" && error.currentValue !== null
        ? { currentValue: error.currentValue }
        : {}),
    },
    defined: true,
    message: "Work has changed. Reload and try again.",
  });
}

function mapWorkLifecyclePreconditionError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> {
  return new ORPCError("PRECONDITION_FAILED", {
    data: { code: error.code },
    defined: true,
    message:
      typeof error.message === "string"
        ? error.message
        : "The Work lifecycle precondition was not met.",
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function rethrowPreferenceMutationError<T>(
  error: unknown,
  targetId: string,
  schema: z.ZodType<T>,
): never {
  if (!isRecord(error)) {
    throw error;
  }

  const { code, currentRevision, currentValue: rawCurrentValue } = error;
  if (code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (code === "STALE_BASE_REVISION") {
    const currentValue = schema.safeParse(rawCurrentValue);
    if (
      typeof currentRevision === "number" &&
      Number.isSafeInteger(currentRevision) &&
      currentRevision >= 0 &&
      currentValue.success
    ) {
      throw new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: "STALE_BASE_REVISION",
          currentRevision,
          currentValue: currentValue.data,
          label: MUTATION_UI_LABELS.currentValue,
          targetId,
        },
        defined: true,
        message: MUTATION_UI_LABELS.currentValue,
      });
    }
  }

  throw error;
}

async function mutateAccountPreferences<TPayload extends MutationPayload>(
  context: Context,
  command: MutationCommand<TPayload>,
  apply: MutationApply<AccountPreferences, TPayload>,
): Promise<MutationReceipt<AccountPreferences>> {
  try {
    return await requireAccountPreferencesMutationContract(context).mutate(
      command,
      apply,
    );
  } catch (error) {
    rethrowPreferenceMutationError(
      error,
      command.targetId,
      accountPreferencesSchema,
    );
  }
}

function preferencesSnapshotFromReceipt(
  receipt: MutationReceipt<AccountPreferences>,
): AccountPreferencesSnapshot {
  return {
    ...receipt.nextValue,
    isSaved: true,
    revision: receipt.revision,
    savedAt: receipt.committedAt,
  };
}

async function mutateCompletionEffectsPreferences<
  TPayload extends MutationPayload,
>(
  context: Context,
  command: MutationCommand<TPayload>,
  apply: MutationApply<CompletionEffectsPreferences, TPayload>,
): Promise<MutationReceipt<CompletionEffectsPreferences>> {
  try {
    return await requireCompletionEffectsPreferencesMutationContract(
      context,
    ).mutate(command, apply);
  } catch (error) {
    rethrowPreferenceMutationError(
      error,
      command.targetId,
      completionEffectsPreferencesSchema,
    );
  }
}

function completionEffectsPreferencesSnapshotFromReceipt(
  receipt: MutationReceipt<CompletionEffectsPreferences>,
): CompletionEffectsPreferencesSnapshot {
  return {
    ...receipt.nextValue,
    isSaved: true,
    revision: receipt.revision,
    savedAt: receipt.committedAt,
  };
}

function rethrowProjectShellError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "SHORT_CODE_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "SHORT_CODE_CONFLICT",
        label: "Short code is already used in this Workspace.",
      },
      defined: true,
      message: "Short code is already used in this Workspace.",
    });
  }

  if (error.code === "SHORT_CODE_LOCKED") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: "SHORT_CODE_LOCKED",
        label: "Short code is locked after the first Work.",
      },
      defined: true,
      message: "Short code is locked after the first Work.",
    });
  }

  if (error.code === "WORKSPACE_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Workspace is unavailable.",
    });
  }

  if (error.code === "PROJECT_CONFIGURATION_CHANGE_REJECTED") {
    throw new ORPCError("BAD_REQUEST", {
      data: {
        code: error.code,
      },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "Project configuration change was rejected.",
    });
  }

  throw error;
}

function rethrowWorkLifecycleError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  const workLifecycleError = mapWorkLifecycleError(error);
  if (workLifecycleError) {
    throw workLifecycleError;
  }

  throw error;
}

function mapWorkDraftError(
  error: Record<string, unknown>,
): ORPCError<string, unknown> | null {
  switch (error.code) {
    case "WORK_DRAFT_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Draft is unavailable.",
      });
    case "WORK_DRAFT_PROJECT_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Project is unavailable.",
      });
    case "WORK_DRAFT_CONSUMED":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Draft has already been created.",
      });
    case "WORK_DRAFT_FINALIZING":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This Draft is already being created.",
      });
    case "STALE_BASE_REVISION":
      return new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: error.code,
          ...(typeof error.currentRevision === "number"
            ? { currentRevision: error.currentRevision }
            : {}),
          ...(isRecord(error.currentValue)
            ? { currentValue: error.currentValue }
            : {}),
        },
        defined: true,
        message: "Draft has changed. Reload and try again.",
      });
    case "TARGET_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "Draft is unavailable.",
      });
    default:
      return mapWorkLifecycleError(error);
  }
}

function rethrowWorkDraftError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }

  const workDraftError = mapWorkDraftError(error);
  if (workDraftError) {
    throw workDraftError;
  }

  throw error;
}

async function runWorkDraftOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowWorkDraftError(error);
  }
}

async function runWorkLifecycleOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowWorkLifecycleError(error);
  }
}

function rethrowWorkNotNowError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  switch (error.code) {
    case "WORK_NOT_NOW_CONFLICT":
      throw new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message:
          typeof error.message === "string"
            ? error.message
            : "Not now has changed. Reload and try again.",
      });
    case "WORK_NOT_NOW_GROUND_UNAVAILABLE":
      throw new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "A selected supporting record is no longer available.",
      });
    default:
      throw error;
  }
}

async function runWorkNotNowOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowWorkNotNowError(error);
  }
}

async function runPersonalReminderOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (isRecord(error)) {
      if (
        error.code === "PERSONAL_REMINDER_FIRE_AT_MUST_BE_FUTURE" ||
        error.code === "WORK_REVIEW_LATER_FIRE_AT_MUST_BE_FUTURE"
      ) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          data: { code: error.code },
          defined: true,
          message: "Reminder must be scheduled for a future time.",
        });
      }
      if (
        error.code === "PERSONAL_REMINDER_IDEMPOTENCY_CONFLICT" ||
        error.code === "WORK_REVIEW_LATER_IDEMPOTENCY_CONFLICT"
      ) {
        throw new ORPCError("CONFLICT", {
          cause: error,
          data: { code: error.code },
          defined: true,
          message: "This reminder request key was already used.",
        });
      }
    }
    throw error;
  }
}

function mapRelationsError(error: Record<string, unknown>) {
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    return mapRelationsError(error.cause);
  }

  switch (error.code) {
    case "RELATION_ENDPOINT_NOT_ALLOWED":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message: "The selected relation endpoints are not allowed.",
      });
    case "RELATION_RECORD_UNAVAILABLE":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "The selected record is unavailable.",
      });
    case "RELATION_DUPLICATE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This relation already exists.",
      });
    case "BLOCKING_RELATION_STATE_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "The blocker has changed. Reload and try again.",
      });
    case "RELATION_CYCLE":
      return new ORPCError("BAD_REQUEST", {
        data: { code: error.code },
        defined: true,
        message: "This relation would create a cycle in the catalog.",
      });
    case "RELATION_PREVIEW_REQUIRED":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Review the current relation preview before confirming.",
      });
    case "RELATION_NOT_FOUND":
      return new ORPCError("NOT_FOUND", {
        defined: true,
        message: "The relation is unavailable.",
      });
    case "RELATION_UNDO_UNAVAILABLE":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "This relation is no longer available for Undo.",
      });
    case "STALE_BASE_REVISION":
      return new ORPCError("PRECONDITION_FAILED", {
        data: { code: error.code },
        defined: true,
        message: "Relation has changed. Reload and try again.",
      });
    case "CONFLICT":
    case "MUTATION_CONFLICT":
      return new ORPCError("CONFLICT", {
        data: { code: error.code },
        defined: true,
        message: "The relation change could not be applied. Try again.",
      });
    default:
      return null;
  }
}

function rethrowRelationsError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  const mapped = mapRelationsError(error);
  if (mapped) {
    throw mapped;
  }
  throw error;
}

async function runRelationsOperation<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    rethrowRelationsError(error);
  }
}

function rethrowProjectShellMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }

  const { code, currentRevision, currentValue: rawCurrentValue } = error;

  if (code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: {
        code: "CONFLICT",
        label: MUTATION_UI_LABELS.conflict,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (code === "STALE_BASE_REVISION") {
    const currentValue =
      isRecord(rawCurrentValue) && "project" in rawCurrentValue
        ? rawCurrentValue.project
        : undefined;
    if (
      typeof currentRevision === "number" &&
      Number.isSafeInteger(currentRevision) &&
      currentRevision >= 0
    ) {
      throw new ORPCError("PRECONDITION_FAILED", {
        data: {
          code: "STALE_BASE_REVISION",
          currentRevision,
          ...(currentValue ? { currentValue } : {}),
          label: MUTATION_UI_LABELS.currentValue,
          targetId,
        },
        defined: true,
        message: MUTATION_UI_LABELS.currentValue,
      });
    }
  }

  if (code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Project is unavailable.",
    });
  }

  if (code === "UNDO_NOT_SUPPORTED") {
    throw new ORPCError("BAD_REQUEST", {
      data: {
        code,
        targetId,
      },
      defined: true,
      message: "Work Context Card layout undo is not available.",
    });
  }

  rethrowProjectShellError(error);
}

function rethrowCustomFieldMutationError(
  error: unknown,
  targetId: string,
  {
    targetNotFoundMessage = "Custom field is unavailable.",
  }: { targetNotFoundMessage?: string } = {},
): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowCustomFieldMutationError(error.cause, targetId, {
      targetNotFoundMessage,
    });
  }

  if (
    error.code === "CUSTOM_FIELD_PROJECT_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: targetNotFoundMessage,
    });
  }

  if (error.code === "CUSTOM_FIELD_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Custom field is unavailable.",
    });
  }

  if (
    error.code === "CUSTOM_FIELD_TRASHED" ||
    error.code === "CUSTOM_FIELD_NOT_TRASHED" ||
    error.code === "CUSTOM_FIELD_RECORD_TYPE_NOT_BOUND" ||
    error.code === "CUSTOM_FIELD_VALUE_TYPE_MISMATCH" ||
    error.code === "CUSTOM_FIELD_OPTION_INVALID" ||
    error.code === "CUSTOM_FIELD_OPTIONS_NOT_SUPPORTED" ||
    error.code === "CUSTOM_FIELD_OPTIONS_REQUIRED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The request was rejected.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (error.code === "CUSTOM_FIELD_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Custom field with this name already exists in this Project.",
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }

  throw error;
}

function rethrowPriorityMetricMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowPriorityMetricMutationError(error.cause, targetId);
  }
  if (
    error.code === "PRIORITY_METRIC_PROJECT_NOT_FOUND" ||
    error.code === "PRIORITY_METRIC_NOT_FOUND" ||
    error.code === "PRIORITY_METRIC_WORK_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Priority metric or Work is unavailable.",
    });
  }
  if (error.code === "PRIORITY_METRIC_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message:
        "A Priority metric with this name already exists in this Project.",
    });
  }
  if (error.code === "PRIORITY_METRIC_NOT_TRASHED") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message: "Only a Priority metric in Trash can be restored or deleted.",
    });
  }
  if (
    error.code === "23505" &&
    (error.constraint === "priority_metric_definition_project_name_uidx" ||
      error.constraint_name === "priority_metric_definition_project_name_uidx")
  ) {
    throw new ORPCError("CONFLICT", {
      data: { targetId },
      defined: true,
      message:
        "A Priority metric with this name already exists in this Project.",
    });
  }
  if (error.code === "23505") {
    throw new ORPCError("CONFLICT", {
      data: { targetId },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }
  if (
    error.code === "PRIORITY_METRIC_TRASHED" ||
    error.code === "PRIORITY_METRIC_PROJECT_MISMATCH" ||
    error.code === "PRIORITY_METRIC_DISABLED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message: "This Priority metric is unavailable for Work values.",
    });
  }
  if (error.code === "CONFLICT" || error.code === "REVISION_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { targetId },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }
  throw error;
}

function rethrowBacklogMutationError(error: unknown, targetId: string): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowBacklogMutationError(error.cause, targetId);
  }
  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "The Project Backlog is unavailable.",
    });
  }
  if (error.code === "BACKLOG_ORDER_MISMATCH") {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message: "The Backlog changed. Reload it before reordering Work.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  throw error;
}

function rethrowPrioritizationSessionMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowPrioritizationSessionMutationError(error.cause, targetId);
  }
  if (
    error.code === "PRIORITIZATION_SESSION_PROJECT_NOT_FOUND" ||
    error.code === "PRIORITIZATION_SESSION_WORK_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "The Prioritization session or its Work is unavailable.",
    });
  }
  if (
    error.code === "PRIORITIZATION_SESSION_CLOSED" ||
    error.code === "PRIORITIZATION_SESSION_TRASHED" ||
    error.code === "PRIORITIZATION_SESSION_NOT_TRASHED"
  ) {
    throw new ORPCError("BAD_REQUEST", {
      data: { code: error.code, targetId },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "The Prioritization session cannot be changed in its current state.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  throw error;
}

function rethrowTagError(error: unknown): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "TAG_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Tag with this name already exists in this Workspace.",
    });
  }

  if (error.code === "TAG_REVISION_CONFLICT") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: { code: error.code },
      defined: true,
      message: "Tag changed since it was loaded. Reload before renaming it.",
    });
  }

  if (
    error.code === "TAG_NOT_FOUND" ||
    error.code === "TAG_PROJECT_NOT_FOUND" ||
    error.code === "TAG_RECORD_NOT_FOUND" ||
    error.code === "TAG_WORKSPACE_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      data: { code: error.code },
      defined: true,
      message: tagUnavailableMessage(error.code),
    });
  }

  throw error;
}

function rethrowTagMutationError(error: unknown, targetId: string): never {
  if (!isRecord(error)) {
    throw error;
  }
  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowTagMutationError(error.cause, targetId);
  }
  if (error.code === "TAG_NAME_CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code },
      defined: true,
      message:
        typeof error.message === "string"
          ? error.message
          : "A Tag with this name already exists in this Workspace.",
    });
  }
  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }
  if (
    error.code === "TAG_NOT_FOUND" ||
    error.code === "TAG_WORKSPACE_NOT_FOUND" ||
    error.code === "TARGET_NOT_FOUND"
  ) {
    throw new ORPCError("NOT_FOUND", {
      data: { code: error.code },
      defined: true,
      message: "Tag is unavailable.",
    });
  }
  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId, label: MUTATION_UI_LABELS.conflict },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }
  if (error.code === "UNDO_NOT_SUPPORTED") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: "Tag rename could not be undone safely.",
    });
  }
  throw error;
}

function rethrowUsageLinkMutationError(
  error: unknown,
  targetId: string,
): never {
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowUsageLinkMutationError(error.cause, targetId);
  }

  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Usage link is unavailable.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(isRecord(error.currentValue)
          ? { currentValue: error.currentValue }
          : {}),
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }

  throw error;
}

function rethrowDocumentMutationError(error: unknown, targetId: string): never {
  if (error instanceof DocumentTransferError) {
    throw new ORPCError("BAD_REQUEST", {
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof DocumentConflictDraftError) {
    throw new ORPCError("CONFLICT", { defined: true, message: error.message });
  }
  if (error instanceof DocumentUnavailableError) {
    throw new ORPCError("NOT_FOUND", { cause: error });
  }
  if (error instanceof DocumentHierarchyError) {
    throw new ORPCError("BAD_REQUEST", {
      message: error.message,
      cause: error,
    });
  }
  if (error instanceof DocumentSectionCycleError) {
    throw new ORPCError("CONFLICT", {
      defined: true,
      message: error.message,
    });
  }
  if (!isRecord(error)) {
    throw error;
  }

  if (error.code === "APPLY_FAILED" && isRecord(error.cause)) {
    rethrowDocumentMutationError(error.cause, targetId);
  }

  if (error.code === "TARGET_NOT_FOUND") {
    throw new ORPCError("NOT_FOUND", {
      defined: true,
      message: "Document or Project is unavailable.",
    });
  }

  if (error.code === "CONFLICT") {
    throw new ORPCError("CONFLICT", {
      data: { code: error.code, targetId, label: MUTATION_UI_LABELS.conflict },
      defined: true,
      message: MUTATION_UI_LABELS.conflict,
    });
  }

  if (error.code === "STALE_BASE_REVISION") {
    throw new ORPCError("PRECONDITION_FAILED", {
      data: {
        code: error.code,
        ...(isRecord(error.currentValue)
          ? { currentValue: error.currentValue }
          : {}),
        ...(typeof error.currentRevision === "number"
          ? { currentRevision: error.currentRevision }
          : {}),
        label: MUTATION_UI_LABELS.currentValue,
        targetId,
      },
      defined: true,
      message: MUTATION_UI_LABELS.currentValue,
    });
  }

  throw error;
}

async function runTagOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    rethrowTagError(error);
  }
}

function tagUnavailableMessage(code: unknown) {
  if (code === "TAG_PROJECT_NOT_FOUND") {
    return "Project is unavailable.";
  }
  if (code === "TAG_RECORD_NOT_FOUND") {
    return "Work is unavailable.";
  }
  if (code === "TAG_WORKSPACE_NOT_FOUND") {
    return "Workspace is unavailable.";
  }
  return "Tag is unavailable.";
}
function nullableProjectValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

async function previewWikiDocumentTransfer(
  context: Context,
  accountId: string,
  input: WikiDocumentTransferInput,
) {
  if (!context.documents?.previewTransfer) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  try {
    const preview = await context.documents.previewTransfer(accountId, input);
    return {
      ...preview,
      references: await Promise.all(
        preview.references.map(async (reference) => {
          let source: { projectId: string | null } | null = null;
          let title: string | null = null;
          if (reference.directive?.kind === "Work") {
            const resolved = await documentReferenceSource(context, accountId, {
              recordType: "Work",
              recordId: reference.directive.id,
              label: reference.title,
              start: reference.directive.start,
              end: reference.directive.end,
            });
            source = resolved;
            title = resolved?.title ?? null;
          } else if (reference.directive) {
            const block = await liveDocumentBlockSource(
              context,
              accountId,
              reference.directive,
            );
            source = block;
            title =
              block && "title" in block ? block.title : (block?.name ?? null);
          } else if (reference.reference) {
            const resolved = await documentReferenceSource(
              context,
              accountId,
              reference.reference,
            );
            source = resolved;
            title = resolved?.title ?? null;
          }
          return {
            ...reference,
            available: source !== null,
            projectId: source?.projectId ?? null,
            title: title ?? reference.title,
          };
        }),
      ),
    };
  } catch (error) {
    rethrowDocumentMutationError(error, input.documentId);
  }
}

async function transferWikiDocument(
  context: Context,
  accountId: string,
  input: z.infer<typeof transferDocumentMutationInputSchema>,
) {
  const { baseRevision, clientIdempotencyKey, previewFingerprint, ...fields } =
    input;
  const payload = wikiDocumentTransferInputSchema.parse(fields);
  if (
    baseRevision !== (payload.action === "copy" ? 0 : payload.documentRevision)
  ) {
    throw new ORPCError("BAD_REQUEST");
  }
  const mutation = requireDocumentMutationContracts(context).transfer?.(
    accountId,
    payload,
    previewFingerprint,
  );
  if (!mutation) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  try {
    const receipt = await mutation.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision,
        clientIdempotencyKey,
        kind: "human",
        payload: { ...payload, previewFingerprint },
        targetId:
          payload.action === "copy"
            ? payload.copyDocumentId
            : payload.documentId,
      },
      ({ committedAt, currentRevision, currentValue }) => {
        const source =
          payload.action === "copy"
            ? currentValue.sourceDocument
            : currentValue.document;
        if (!source) {
          throw new DocumentUnavailableError();
        }
        return {
          document: documentSchema.parse({
            ...source,
            id: payload.action === "copy" ? payload.copyDocumentId : source.id,
            projectId: payload.targetProjectId,
            parentDocumentId: null,
            folder: null,
            ...(payload.action === "copy"
              ? {
                  archivedAt: null,
                  createdAt: committedAt,
                  origin: {
                    documentId: source.id,
                    revision: source.revision,
                  },
                }
              : {}),
            revision: currentRevision + 1,
            updatedAt: committedAt,
          }),
        } satisfies DocumentMutationValue;
      },
    );
    if (!receipt.nextValue.document) {
      throw new ORPCError("NOT_FOUND");
    }
    return receipt.nextValue.document;
  } catch (error) {
    rethrowDocumentMutationError(error, input.documentId);
  }
}

function requireProjectGoals(context: Context) {
  if (!context.projectGoals) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.projectGoals;
}
function rethrowProjectGoalError(error: unknown, targetId: string): never {
  if (error instanceof ProjectGoalConflictError) {
    throw new ORPCError("CONFLICT", {
      cause: error,
      data: { code: "CONFLICT", targetId },
      defined: true,
      message: "Conflict",
    });
  }
  throw error;
}
export const appRouter = {
  projectGoalDetail: protectedProcedure
    .input(projectGoalInputSchema)
    .handler(({ context, input }) => {
      const { membership } = requireProjectGoals(context);
      if (!membership) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return membership.detail(context.session.user.id, input);
    }),
  setProjectGoalRelation: protectedProcedure
    .input(projectGoalRelationInputSchema)
    .handler(async ({ context, input }) => {
      const { membership } = requireProjectGoals(context);
      if (!membership) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const relation = await membership.setRelation(
          context.session.user.id,
          input,
        );
        if (!relation) {
          throw new ORPCError("NOT_FOUND");
        }
        return relation;
      } catch (error) {
        rethrowProjectGoalError(error, input.goalId);
      }
    }),
  projectGoals: protectedProcedure
    .input(projectGoalsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectGoals(context).list(
        context.session.user.id,
        input.projectId,
      ),
    ),
  projectGoal: protectedProcedure
    .input(projectGoalInputSchema)
    .handler(({ context, input }) =>
      requireProjectGoals(context).find(context.session.user.id, input),
    ),
  createProjectGoal: protectedProcedure
    .input(createProjectGoalInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectGoals(context).create(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectGoalError(error, input.id);
      }
    }),
  updateProjectGoal: protectedProcedure
    .input(updateProjectGoalInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectGoals(context).update(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectGoalError(error, input.id);
      }
    }),
  documentTemplates: protectedProcedure
    .input(documentTemplateScopeSchema)
    .handler(async ({ context, input }) => {
      const templates = context.documents?.templates;
      if (!templates) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await templates.list(context.session.user.id, input.projectId);
      } catch (error) {
        rethrowDocumentMutationError(error, "document-templates");
      }
    }),
  previewDocumentTemplate: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      const source = await context.documents?.get(
        context.session.user.id,
        input.documentId,
      );
      if (!source) {
        throw new ORPCError("NOT_FOUND");
      }
      return {
        body: documentTemplateSkeleton(source.body),
        name: source.title,
        projectId: source.projectId,
        sourceDocumentId: source.id,
        sourceRevision: source.revision,
        type: source.type,
      };
    }),
  createDocumentTemplate: protectedProcedure
    .input(createDocumentTemplateInputSchema)
    .handler(async ({ context, input }) => {
      const contracts = context.documentMutationContracts?.templates;
      if (!contracts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      try {
        const receipt = await contracts.create(context.session.user.id).mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ committedAt }) => ({
            template: documentTemplateSchema.parse({
              ...documentTemplateDefinitionSchema.parse({
                projectId: payload.projectId,
                name: payload.name,
                body: documentTemplateSkeleton(payload.body),
                type: payload.type,
              }),
              id: crypto.randomUUID(),
              revision: 1,
              createdAt: committedAt,
              updatedAt: committedAt,
            }),
          }),
        );
        if (!receipt.nextValue.template) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.template;
      } catch (error) {
        rethrowDocumentMutationError(error, clientIdempotencyKey);
      }
    }),
  updateDocumentTemplate: protectedProcedure
    .input(updateDocumentTemplateInputSchema)
    .handler(async ({ context, input }) => {
      const contracts = context.documentMutationContracts?.templates;
      if (!contracts) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { baseRevision, clientIdempotencyKey, ...payload } = input;
      try {
        const receipt = await contracts.update(context.session.user.id).mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: payload.templateId,
          },
          ({ committedAt, currentRevision, currentValue }) => ({
            template: currentValue.template
              ? documentTemplateSchema.parse({
                  ...currentValue.template,
                  name: payload.name,
                  body: documentTemplateSkeleton(payload.body),
                  type: payload.type,
                  revision: currentRevision + 1,
                  updatedAt: committedAt,
                })
              : null,
          }),
        );
        if (!receipt.nextValue.template) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.template;
      } catch (error) {
        rethrowDocumentMutationError(error, payload.templateId);
      }
    }),
  createDocumentFromTemplate: protectedProcedure
    .input(createDocumentFromTemplateInputSchema)
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const { baseRevision, clientIdempotencyKey, ...templatePayload } = input;
      const contract =
        requireDocumentMutationContracts(context).create(accountId);
      const command = {
        actor: { actorId: accountId, type: "User" as const },
        baseRevision,
        clientIdempotencyKey,
        kind: "human" as const,
        payload: templatePayload,
        targetId: clientIdempotencyKey,
      };
      try {
        const replay = await contract.replay(command);
        if (replay?.nextValue.document) {
          return replay.nextValue.document;
        }
      } catch (error) {
        rethrowDocumentMutationError(error, clientIdempotencyKey);
      }
      const template =
        input.templateId === personalReviewTemplate.id
          ? personalReviewTemplate
          : await context.documents?.templates?.get(
              accountId,
              input.templateId,
            );
      if (
        !template ||
        ("projectId" in template && template.projectId !== input.projectId)
      ) {
        throw new ORPCError("NOT_FOUND");
      }
      if (
        "revision" in template &&
        template.revision !== input.templateRevision
      ) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message:
            "Document Template changed. Reload it before creating a Document.",
        });
      }
      let body: string;
      try {
        body = renderDocumentTemplate(template.body, input.values);
      } catch (error) {
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          message:
            error instanceof Error
              ? error.message
              : "Document Template values are invalid.",
        });
      }
      const payload = documentCreationInputSchema.parse({
        projectId: input.projectId,
        title: input.title,
        type: template.type,
        body,
      });
      try {
        const receipt = await contract.mutate(
          command,
          ({ committedAt, currentRevision }) => ({
            document: documentSchema.parse({
              ...payload,
              id: crypto.randomUUID(),
              revision: currentRevision + 1,
              createdAt: committedAt,
              updatedAt: committedAt,
            }),
          }),
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, input.clientIdempotencyKey);
      }
    }),
  discoverDocuments: protectedProcedure
    .input(documentDiscoveryInputSchema)
    .handler(({ context, input }) => {
      const discovery = context.documents?.discovery;
      if (!discovery) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return discovery.discover(context.session.user.id, input);
    }),
  searchRecords: protectedProcedure
    .input(universalSearchInputSchema)
    .handler(({ context, input }) => {
      const search = context.universalSearch;
      if (!search) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return search.search(context.session.user.id, input);
    }),
  tableRecords: protectedProcedure
    .input(recordTableInputSchema)
    .handler(({ context, input }) => {
      const table = context.recordTable;
      if (!table) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return table.list(context.session.user.id, input);
    }),
  updateTableCell: protectedProcedure
    .input(recordTableCellUpdateInputSchema)
    .handler(({ context, input }) => {
      const table = context.recordTable;
      if (!table) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return table.updateCell(context.session.user.id, input);
    }),
  applyTablePaste: protectedProcedure
    .input(recordTablePasteInputSchema)
    .handler(({ context, input }) => {
      const table = context.recordTable;
      if (!table) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return table.applyPaste(context.session.user.id, input);
    }),
  documents: protectedProcedure
    .input(
      z
        .object({
          projectId: projectIdSchema.nullable(),
          archived: z.boolean().optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.documents.list(
          context.session.user.id,
          input.projectId,
          input.archived,
        );
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
    }),
  document: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const result = await context.documents.get(
        context.session.user.id,
        input.documentId,
      );
      if (!result) {
        throw new ORPCError("NOT_FOUND");
      }
      return result;
    }),
  documentConflictDrafts: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      const drafts = await context.documents?.conflictDrafts?.(
        context.session.user.id,
        input.documentId,
      );
      if (!drafts) {
        throw new ORPCError("NOT_FOUND");
      }
      return drafts;
    }),
  discardDocumentConflictDraft: protectedProcedure
    .input(discardDocumentConflictDraftInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents?.discardConflictDraft) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        await context.documents.discardConflictDraft(
          context.session.user.id,
          input.documentId,
          input.conflictDraftId,
        );
      } catch (error) {
        rethrowDocumentMutationError(error, input.documentId);
      }
    }),
  documentLiveWorkBlocks: protectedProcedure
    .input(
      z
        .object({
          documentId: documentIdSchema,
          body: documentBodySchema.optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { documents } = context;
      const record = await documents.get(
        context.session.user.id,
        input.documentId,
      );
      if (!record) {
        throw new ORPCError("NOT_FOUND");
      }
      return Promise.all(
        documentLiveWorkIds(input.body ?? record.body).map(async (workId) => {
          const work = await documents.getLiveWork(
            context.session.user.id,
            workId,
          );
          return {
            workId,
            source: work ?? null,
          };
        }),
      );
    }),
  pinDocumentEvidence: protectedProcedure
    .input(pinDocumentEvidenceInputSchema)
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const documentRecord = await context.documents?.get(
        accountId,
        input.documentId,
      );
      if (!documentRecord) {
        throw new ORPCError("NOT_FOUND");
      }
      if (
        documentRecord.revision !== input.documentRevision ||
        input.selectionEnd > documentRecord.body.length ||
        documentRecord.body.slice(input.selectionStart, input.selectionEnd) !==
          input.selectedText
      ) {
        throw new ORPCError("CONFLICT", {
          defined: true,
          message: "The Document changed after the text was selected.",
        });
      }
      const targetProjectId = await pinnedEvidenceTargetProjectId(
        context,
        accountId,
        input.targetRecordType,
        input.targetRecordId,
      );
      if (targetProjectId !== documentRecord.projectId) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The evidence target is unavailable.",
        });
      }
      if (
        input.targetRecordType === "Document" &&
        input.targetRecordId === documentRecord.id
      ) {
        throw new ORPCError("BAD_REQUEST", {
          defined: true,
          message: "A Document cannot pin evidence to itself.",
        });
      }
      const mutation =
        requireUsageLinkMutationContracts(context).create(accountId);
      const { baseRevision, clientIdempotencyKey } = input;
      const payload = usageLinkPayloadSchema.parse({
        kind: "Pinned bind",
        location: {
          ...(input.targetRecordType === "Assumption"
            ? { projectId: targetProjectId }
            : {}),
          documentVersion: {
            documentId: documentRecord.id,
            revision: documentRecord.revision,
          },
          end: input.selectionEnd,
          excerpt: input.selectedText,
          start: input.selectionStart,
        },
        source: { recordId: documentRecord.id, recordType: "Document" },
        surface: {
          recordId: input.targetRecordId,
          recordType: input.targetRecordType,
        },
      });
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: accountId, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ committedAt, currentRevision, payload: mutationPayload }) => ({
            usageLink: usageLinkSchema.parse({
              ...mutationPayload,
              createdAt: committedAt,
              id: crypto.randomUUID(),
              revision: currentRevision + 1,
            }),
          }),
        );
        if (!receipt.nextValue.usageLink) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.usageLink;
      } catch (error) {
        rethrowUsageLinkMutationError(error, clientIdempotencyKey);
      }
    }),
  documentLiveOtherBlocks: protectedProcedure
    .input(
      z
        .object({
          documentId: documentIdSchema,
          body: documentBodySchema.optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (
        !(
          context.documents &&
          context.smartCollections &&
          context.technicalDiagrams
        )
      ) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const record = await context.documents.get(
        context.session.user.id,
        input.documentId,
      );
      if (!record) {
        throw new ORPCError("NOT_FOUND");
      }
      return Promise.all(
        documentLiveDirectives(input.body ?? record.body)
          .filter(({ kind }) => kind !== "Work")
          .map(async (directive) => ({
            id: directive.id,
            kind: directive.kind,
            sectionId: directive.sectionId ?? null,
            viewId: directive.viewId ?? null,
            source: await liveDocumentBlockSource(
              context,
              context.session.user.id,
              directive,
            ),
          })),
      );
    }),
  documentRecordReferences: protectedProcedure
    .input(
      z
        .object({
          body: documentBodySchema.optional(),
          documentId: documentIdSchema,
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const documentRecord = await context.documents?.get(
        accountId,
        input.documentId,
      );
      if (!documentRecord) {
        throw new ORPCError("NOT_FOUND");
      }
      return Promise.all(
        parseDocumentRecordReferences(input.body ?? documentRecord.body).map(
          async (reference) => ({
            ...reference,
            source: await documentReferenceSource(
              context,
              accountId,
              reference,
            ),
          }),
        ),
      );
    }),
  createSmartCollection: protectedProcedure
    .input(createSmartCollectionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.smartCollections.create(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof SmartCollectionUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        if (error instanceof SmartCollectionConflictError) {
          throw new ORPCError("CONFLICT", { cause: error });
        }
        throw error;
      }
    }),
  smartCollectionViews: protectedProcedure
    .input(z.object({ projectId: projectIdSchema }).strict())
    .handler(({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return context.smartCollections.listViews(
        context.session.user.id,
        input.projectId,
      );
    }),
  setSmartCollectionSubscription: protectedProcedure
    .input(setSmartCollectionSubscriptionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.smartCollections.setSubscription(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof SmartCollectionUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
    }),
  smartCollectionView: protectedProcedure
    .input(
      z
        .object({ viewId: z.string().min(1), readOnly: z.boolean().optional() })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.smartCollections) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const view = await context.smartCollections.getView(
        context.session.user.id,
        input.viewId,
        { readOnly: input.readOnly },
      );
      if (!view) {
        throw new ORPCError("NOT_FOUND");
      }
      return view;
    }),
  technicalDiagrams: protectedProcedure
    .input(z.object({ projectId: projectIdSchema }).strict())
    .handler(({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return context.technicalDiagrams.list(
        context.session.user.id,
        input.projectId,
      );
    }),
  technicalDiagram: protectedProcedure
    .input(
      z
        .object({
          diagramId: z.string().min(1),
          viewId: z.string().min(1).optional(),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const diagram = await context.technicalDiagrams.get(
        context.session.user.id,
        input.diagramId,
        input.viewId,
      );
      if (!diagram) {
        throw new ORPCError("NOT_FOUND");
      }
      return diagram;
    }),
  createDiagramView: protectedProcedure
    .input(createDiagramViewInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const view = await context.technicalDiagrams.createView(
          context.session.user.id,
          input,
        );
        if (!view) {
          throw new ORPCError("NOT_FOUND");
        }
        return view;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  technicalDiagramViews: protectedProcedure
    .input(z.object({ diagramId: z.string().min(1) }).strict())
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const views = await context.technicalDiagrams.listViews(
        context.session.user.id,
        input.diagramId,
      );
      if (!views) {
        throw new ORPCError("NOT_FOUND");
      }
      return views;
    }),
  previewMermaidConversion: protectedProcedure
    .input(mermaidConversionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const preview = await context.technicalDiagrams.previewConversion(
          context.session.user.id,
          input,
        );
        if (!preview) {
          throw new ORPCError("NOT_FOUND");
        }
        return preview;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("BAD_REQUEST", { cause: error });
      }
    }),
  convertMermaidToTechnicalDiagram: protectedProcedure
    .input(confirmMermaidConversionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.technicalDiagrams) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const diagram = await context.technicalDiagrams.convert(
          context.session.user.id,
          input,
        );
        if (!diagram) {
          throw new ORPCError("NOT_FOUND");
        }
        return diagram;
      } catch (error) {
        if (error instanceof ORPCError) {
          throw error;
        }
        throw new ORPCError("CONFLICT", { cause: error });
      }
    }),
  documentVersions: protectedProcedure
    .input(z.object({ documentId: documentIdSchema }).strict())
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const versions = await context.documents.versions(
        context.session.user.id,
        input.documentId,
      );
      if (!versions) {
        throw new ORPCError("NOT_FOUND");
      }
      return versions;
    }),
  documentVersion: protectedProcedure
    .input(documentVersionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const version = await context.documents.getVersion(
        context.session.user.id,
        input.documentId,
        input.revision,
      );
      if (!version) {
        throw new ORPCError("NOT_FOUND");
      }
      return version;
    }),
  restoreDocumentVersion: protectedProcedure
    .input(restoreDocumentVersionInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const selected = await context.documents.getVersion(
        context.session.user.id,
        input.documentId,
        input.revision,
      );
      if (!selected) {
        throw new ORPCError("NOT_FOUND");
      }
      const mutation = requireDocumentMutationContracts(context).update(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {
              documentId: input.documentId,
              title: selected.title,
              body: selected.body,
              type: selected.type,
            },
            targetId: input.documentId,
          },
          ({ committedAt, currentRevision, currentValue }) =>
            ({
              document: currentValue.document
                ? documentSchema.parse({
                    ...currentValue.document,
                    title: selected.title,
                    body: selected.body,
                    inlineTags: selected.inlineTags,
                    type: selected.type,
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  })
                : null,
            }) satisfies DocumentMutationValue,
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, input.documentId);
      }
    }),
  previewDocumentTransfer: protectedProcedure
    .input(
      z.union([documentTransferInputSchema, wikiDocumentTransferInputSchema]),
    )
    .handler(async ({ context, input }) => {
      if (input.action === "move" || input.action === "copy") {
        return previewWikiDocumentTransfer(
          context,
          context.session.user.id,
          input,
        );
      }
      if (!context.documentTransfers) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const preview = await context.documentTransfers.preview(
          context.session.user.id,
          input,
        );
        if (
          context.documents?.previewTransfer &&
          (input.action === "Move" || input.action === "Copy")
        ) {
          const source = await context.documents.get(
            context.session.user.id,
            input.documentId,
          );
          if (!source) {
            throw new DocumentUnavailableError();
          }
          if (input.action === "Copy" && !input.newDocumentId) {
            throw new ORPCError("BAD_REQUEST");
          }
          const selection: WikiDocumentTransferInput =
            input.action === "Move"
              ? {
                  action: "move",
                  documentId: input.documentId,
                  documentRevision: input.sourceRevision,
                  targetProjectId: input.targetProjectId,
                  children: preview.documents
                    .filter((item) => item.id !== input.documentId)
                    .map(({ id, revision }) => ({ id, revision })),
                }
              : {
                  action: "copy",
                  documentId: input.documentId,
                  documentRevision: source.revision,
                  targetProjectId: input.targetProjectId,
                  sourceRevision: input.sourceRevision,
                  copyDocumentId: input.newDocumentId ?? "",
                };
          const scopePreview = await previewWikiDocumentTransfer(
            context,
            context.session.user.id,
            selection,
          );
          return {
            ...preview,
            descendants: scopePreview.descendants,
            detachedChildren: scopePreview.detachedChildren,
            references: scopePreview.references,
          };
        }
        return preview;
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw new ORPCError("BAD_REQUEST", {
          cause: error,
          message:
            error instanceof Error
              ? error.message
              : "Document selection is unavailable.",
        });
      }
    }),
  transferDocument: protectedProcedure
    .input(
      z.union([
        documentTransferMutationInputSchema,
        transferDocumentMutationInputSchema,
      ]),
    )
    .handler(async ({ context, input }) => {
      if (input.action === "move" || input.action === "copy") {
        return transferWikiDocument(context, context.session.user.id, input);
      }
      if (!context.documentTransfers) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const { baseRevision, clientIdempotencyKey, ...command } = input;
      try {
        const receipt = await context.documentTransfers
          .mutation(context.session.user.id)
          .mutate(
            {
              actor: { actorId: context.session.user.id, type: "User" },
              kind: "human",
              clientIdempotencyKey,
              baseRevision,
              targetId:
                command.action === "Copy"
                  ? (command.newDocumentId ?? "")
                  : command.documentId,
              payload: command,
            },
            ({ currentValue }) => ({ ...currentValue, command }),
          );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, command.documentId);
      }
    }),
  exportDocument: protectedProcedure
    .input(
      z
        .object({
          documentId: documentIdSchema,
          revision: z.number().int().positive(),
          format: z.enum(["Markdown", "PDF"]),
        })
        .strict(),
    )
    .handler(async ({ context, input }) => {
      if (!context.documentTransfers) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const snapshot = await context.documentTransfers.snapshot(
          context.session.user.id,
          input.documentId,
          input.revision,
        );
        return {
          ...snapshot,
          format: input.format,
          content:
            input.format === "PDF"
              ? await context.documentTransfers.pdf(snapshot)
              : snapshot.markdown,
        };
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        if (error instanceof DocumentTransferError) {
          throw new ORPCError("BAD_REQUEST", {
            message: error.message,
            cause: error,
          });
        }
        throw error;
      }
    }),
  previewDocumentOrganization: protectedProcedure
    .input(documentOrganizationInputSchema)
    .handler(async ({ context, input }) => {
      if (!context.documents?.previewOrganization) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        return await context.documents.previewOrganization(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof DocumentUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
    }),
  organizeDocument: protectedProcedure
    .input(organizeDocumentMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = documentOrganizationInputSchema.parse(payloadInput);
      const mutation = requireDocumentMutationContracts(context).organize?.(
        context.session.user.id,
      );
      if (!mutation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: payload.documentId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentValue.document;
            return {
              document: current
                ? documentSchema.parse({
                    ...current,
                    ...(payload.action === "archive"
                      ? { archivedAt: payload.archived ? committedAt : null }
                      : {
                          folder: payload.folder,
                          parentDocumentId: payload.parentDocumentId,
                        }),
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  })
                : null,
            } satisfies DocumentMutationValue;
          },
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, payload.documentId);
      }
    }),
  createDocument: protectedProcedure
    .input(createDocumentMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payloadSource: Record<string, unknown> = payloadInput;
      const { conflictDraftId, ...creationSource } = payloadSource;
      const payload = documentCreationInputSchema.parse(creationSource);
      const conflictDraftOwnerId =
        typeof conflictDraftId === "string" ? conflictDraftId : undefined;
      const mutation = requireDocumentMutationContracts(context).create(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ committedAt, currentRevision }) =>
            ({
              document: documentSchema.parse({
                ...documentCreationFields(payload),
                createdAt: committedAt,
                id: crypto.randomUUID(),
                revision: currentRevision + 1,
                updatedAt: committedAt,
              }),
              ...(conflictDraftOwnerId
                ? { conflictDraftId: conflictDraftOwnerId }
                : {}),
            }) satisfies DocumentMutationValue,
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        rethrowDocumentMutationError(error, clientIdempotencyKey);
      }
    }),
  updateDocument: protectedProcedure
    .input(updateDocumentMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = updateDocumentInputSchema.parse(payloadInput);
      const mutation = requireDocumentMutationContracts(context).update(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: payload.documentId,
          },
          ({ committedAt, currentRevision, currentValue }) => {
            const current = currentValue.document;
            return {
              ...(payload.conflictDraftId
                ? { conflictDraftId: payload.conflictDraftId }
                : {}),
              document: current
                ? documentSchema.parse({
                    ...current,
                    ...(payload.title === undefined
                      ? {}
                      : { title: payload.title }),
                    ...(payload.body === undefined
                      ? {}
                      : { body: payload.body }),
                    ...(payload.type === undefined
                      ? {}
                      : { type: payload.type }),
                    revision: currentRevision + 1,
                    updatedAt: committedAt,
                  })
                : null,
            } satisfies DocumentMutationValue;
          },
        );
        if (!receipt.nextValue.document) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.document;
      } catch (error) {
        if (
          isRecord(error) &&
          error.code === "STALE_BASE_REVISION" &&
          context.documents?.captureConflictDraft &&
          !payload.conflictDraftId
        ) {
          let conflictDraft: Awaited<
            ReturnType<
              NonNullable<typeof context.documents.captureConflictDraft>
            >
          >;
          try {
            conflictDraft = await context.documents.captureConflictDraft(
              context.session.user.id,
              input,
            );
          } catch (captureError) {
            rethrowDocumentMutationError(captureError, payload.documentId);
          }
          throw new ORPCError("PRECONDITION_FAILED", {
            cause: error,
            defined: true,
            message: "Conflict Draft",
            data: {
              code: "STALE_BASE_REVISION",
              conflictDraft,
              currentRevision: error.currentRevision,
              currentValue: error.currentValue,
              targetId: payload.documentId,
            },
          });
        }
        rethrowDocumentMutationError(error, payload.documentId);
      }
    }),
  externalExecutionHandoffs: protectedProcedure
    .input(listExternalExecutionHandoffsInputSchema)
    .handler(async ({ context, input }) => {
      const handoffs = await requireExternalExecutionHandoffs(context).list(
        context.session.user.id,
        input.workId,
      );
      if (!handoffs) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return handoffs;
    }),
  externalExecutionHandoffHistory: protectedProcedure
    .input(listExternalExecutionHandoffHistoryInputSchema)
    .handler(async ({ context, input }) => {
      const history = await requireExternalExecutionHandoffs(
        context,
      ).listHistory(context.session.user.id, input.workId);
      if (!history) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return history;
    }),
  externalExecutionHandoffRelatedWorks: protectedProcedure
    .input(listExternalExecutionHandoffRelatedWorksInputSchema)
    .handler(async ({ context, input }) => {
      const works = await requireExternalExecutionHandoffs(
        context,
      ).listRelatedWorks(context.session.user.id, input.workId);
      if (!works) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Handoff is unavailable.",
        });
      }
      return works;
    }),
  previewExternalExecutionHandoffReconcile: protectedProcedure
    .input(previewExternalExecutionHandoffReconcileInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireExternalExecutionHandoffs(
          context,
        ).previewReconcile(context.session.user.id, input);
        if (!preview) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return preview;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  recordExternalExecutionHandoffReturn: protectedProcedure
    .input(recordExternalExecutionHandoffReturnInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(
          context,
        ).recordReturn(context.session.user.id, input);
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  confirmExternalExecutionHandoffReconcile: protectedProcedure
    .input(confirmExternalExecutionHandoffReconcileInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(
          context,
        ).confirmReconcile(context.session.user.id, input);
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  startExternalExecutionHandoff: protectedProcedure
    .input(startExternalExecutionHandoffMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(context).start(
          context.session.user.id,
          input,
        );
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  cancelExternalExecutionHandoff: protectedProcedure
    .input(cancelExternalExecutionHandoffInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const handoff = await requireExternalExecutionHandoffs(context).cancel(
          context.session.user.id,
          input,
        );
        if (!handoff) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Handoff is unavailable.",
          });
        }
        return handoff;
      } catch (error) {
        rethrowExternalExecutionHandoffError(error);
      }
    }),
  recordExternalExecutionHandoffPackageExport: protectedProcedure
    .input(recordExternalExecutionHandoffPackageExportInputSchema)
    .handler(async ({ context, input }) => {
      const event = await requireExternalExecutionHandoffs(
        context,
      ).recordPackageExport(context.session.user.id, input);
      if (!event) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Handoff is unavailable.",
        });
      }
      return event;
    }),
  workTemplates: protectedProcedure
    .input(workTemplatesInputSchema)
    .handler(async ({ context, input }) => {
      const templates = await requireWorkTemplates(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!templates) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return templates;
    }),
  createWorkTemplate: protectedProcedure
    .input(createWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        return await requireWorkTemplates(context).create(
          context.session.user.id,
          createWorkTemplateInputSchema.parse(payload),
        );
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  instantiateWorkTemplate: protectedProcedure
    .input(instantiateWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const created = await requireWorkTemplates(context).instantiate(
          context.session.user.id,
          input,
        );
        if (!created) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Template is unavailable.",
          });
        }
        return created;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  previewDuplicateWork: protectedProcedure
    .input(previewDuplicateWorkInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const preview = await requireWorkTemplates(context).previewDuplicate(
          context.session.user.id,
          input.sourceWorkId,
        );
        if (!preview) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return preview;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  duplicateWork: protectedProcedure
    .input(duplicateWorkMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const created = await requireWorkTemplates(context).duplicate(
          context.session.user.id,
          input,
        );
        if (!created) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return created;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  updateWorkTemplate: protectedProcedure
    .input(updateWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey: _key,
        templateId,
        ...payload
      } = input;
      try {
        const updated = await requireWorkTemplates(context).update(
          context.session.user.id,
          templateId,
          baseRevision,
          updateWorkTemplateInputSchema.parse(payload),
        );
        if (!updated) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Template is unavailable.",
          });
        }
        return updated;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  trashWorkTemplate: protectedProcedure
    .input(trashWorkTemplateMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const trashed = await requireWorkTemplates(context).trash(
          context.session.user.id,
          input.templateId,
          input.baseRevision,
        );
        if (!trashed) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Template is unavailable.",
          });
        }
        return trashed;
      } catch (error) {
        rethrowWorkTemplateError(error);
      }
    }),
  recordActions: protectedProcedure
    .input(recordActionsInputSchema)
    .handler(async ({ context, input }) => {
      const actions = await requireRecordActions(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!actions) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return actions;
    }),
  previewRecordAction: protectedProcedure
    .input(previewRecordActionInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireRecordActions(context).preview(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Record Action or Work is unavailable.",
        });
      }
      return preview;
    }),
  applyRecordAction: protectedProcedure
    .input(applyRecordActionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireRecordActions(context).apply(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  undoRecordAction: protectedProcedure
    .input(undoRecordActionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireRecordActions(context).undo(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  createRecordAction: protectedProcedure
    .input(createRecordActionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision: _baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        return await requireRecordActions(context).create(
          context.session.user.id,
          createRecordActionInputSchema.parse(payload),
        );
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  updateRecordAction: protectedProcedure
    .input(updateRecordActionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        actionId,
        baseRevision,
        clientIdempotencyKey: _key,
        ...payload
      } = input;
      try {
        const updated = await requireRecordActions(context).update(
          context.session.user.id,
          actionId,
          baseRevision,
          updateRecordActionInputSchema.parse(payload),
        );
        if (!updated) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Record Action is unavailable.",
          });
        }
        return updated;
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  trashRecordAction: protectedProcedure
    .input(trashRecordActionMutationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const trashed = await requireRecordActions(context).trash(
          context.session.user.id,
          input.actionId,
          input.baseRevision,
        );
        if (!trashed) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Record Action is unavailable.",
          });
        }
        return trashed;
      } catch (error) {
        rethrowRecordActionError(error);
      }
    }),
  healthCheck: publicProcedure.handler(() => "OK"),
  githubAvailability: publicProcedure.handler(({ context }) => ({
    status: context.githubAvailability.getStatus(),
  })),
  privateData: protectedProcedure.handler(({ context }) => ({
    message: "This is private",
    user: context.session?.user,
  })),
  projects: protectedProcedure.handler(({ context }) =>
    requireProjectShell(context).list(context.session.user.id),
  ),
  workspaceOverview: protectedProcedure.handler(({ context }) =>
    requireWorkspaceOverview(context).get(context.session.user.id),
  ),
  saveWorkspaceOverviewPresentation: protectedProcedure
    .input(workspaceOverviewPresentationSchema)
    .handler(({ context, input }) =>
      requireWorkspaceOverviewWriter(context)(context.session.user.id, input),
    ),
  project: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const project = await requireProjectShell(context).find(
        context.session.user.id,
        input.projectId,
      );
      if (!project) {
        throw new ORPCError("NOT_FOUND");
      }
      return project;
    }),
  tags: protectedProcedure
    .input(tagsInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const tags = await requireTags(context).list(
          context.session.user.id,
          input.projectId,
        );
        if (!tags) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Project is unavailable.",
          });
        }
        return tags;
      }),
    ),
  tagRecords: protectedProcedure
    .input(tagRecordsInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const records = await requireTags(context).records(
          context.session.user.id,
          input,
        );
        if (!records) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Project is unavailable.",
          });
        }
        return records;
      }),
    ),
  createTag: protectedProcedure
    .input(createTagInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(() =>
        requireTags(context).create(context.session.user.id, input),
      ),
    ),
  applyTag: protectedProcedure
    .input(applyTagInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const assignment = await requireTags(context).apply(
          context.session.user.id,
          input,
        );
        if (!assignment) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return assignment;
      }),
    ),
  removeTag: protectedProcedure
    .input(removeTagInputSchema)
    .handler(({ context, input }) =>
      runTagOperation(async () => {
        const result = await requireTags(context).remove(
          context.session.user.id,
          input,
        );
        if (!result) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work is unavailable.",
          });
        }
        return result;
      }),
    ),
  renameTag: protectedProcedure
    .input(renameTagMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...inputPayload } = input;
      const parsed = renameTagCommandSchema.parse(inputPayload);
      const mutation = requireTagMutationContracts(context).rename(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: parsed.tagId,
          },
          ({ currentValue, currentRevision, payload }) => {
            if (!currentValue.tag) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              tag: {
                ...currentValue.tag,
                name: payload.name,
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies TagMutationValue;
          },
          {
            undo: {
              kind: "atomic-transform",
              scope: "tag.name",
            },
          },
        );
        if (!receipt.nextValue.tag) {
          throw new ORPCError("NOT_FOUND");
        }
        return { receiptId: receipt.id, tag: receipt.nextValue.tag };
      } catch (error) {
        rethrowTagMutationError(error, parsed.tagId);
      }
    }),
  undoTagRename: protectedProcedure
    .input(undoTagRenameInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireTagMutationContracts(context).rename(
        context.session.user.id,
      );
      if (!(mutation.findReceiptById && mutation.undo)) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      const sourceReceipt = await mutation.findReceiptById(input.receiptId);
      if (!sourceReceipt) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Tag rename is no longer available for Undo.",
        });
      }

      try {
        const receipt = await mutation.undo(
          sourceReceipt,
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: input.tagId,
          },
          ({ currentValue, currentRevision, previousValue }) => {
            if (!(currentValue.tag && previousValue.tag)) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              tag: {
                ...currentValue.tag,
                name: previousValue.tag.name,
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies TagMutationValue;
          },
        );
        if (!receipt.nextValue.tag) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.tag;
      } catch (error) {
        rethrowTagMutationError(error, input.tagId);
      }
    }),
  usageLinks: protectedProcedure
    .input(listUsageLinksInputSchema)
    .handler(({ context, input }) =>
      requireUsageLinks(context).listBySource(
        context.session.user.id,
        input.source,
      ),
    ),
  createUsageLink: protectedProcedure
    .input(createUsageLinkMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const payload = usageLinkPayloadSchema.parse(payloadInput);
      const mutation = requireUsageLinkMutationContracts(context).create(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload,
            targetId: clientIdempotencyKey,
          },
          ({ currentRevision, payload: mutationPayload }) =>
            ({
              usageLink: usageLinkSchema.parse({
                ...mutationPayload,
                createdAt: new Date().toISOString(),
                id: crypto.randomUUID(),
                revision: currentRevision + 1,
              }),
            }) satisfies UsageLinkMutationValue,
        );
        if (!receipt.nextValue.usageLink) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.usageLink;
      } catch (error) {
        rethrowUsageLinkMutationError(error, clientIdempotencyKey);
      }
    }),
  unlinkUsageLink: protectedProcedure
    .input(unlinkUsageLinkInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireUsageLinkMutationContracts(context).unlink(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: input.usageLinkId,
          },
          ({ currentValue }) => {
            if (!currentValue.usageLink) {
              throw new ORPCError("NOT_FOUND");
            }
            return { usageLink: null } satisfies UsageLinkMutationValue;
          },
        );
        if (receipt.nextValue.usageLink !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowUsageLinkMutationError(error, input.usageLinkId);
      }
    }),
  customFields: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const fields = await requireCustomFields(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!fields) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return fields;
    }),
  priorityMetrics: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const metrics = await requirePriorityMetrics(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!metrics) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return metrics;
    }),
  copyPriorityMetricDefinitions: protectedProcedure
    .input(copyPriorityMetricDefinitionsInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...copyInput } = input;
      const mutation = requirePriorityMetricMutationContracts(
        context,
      ).copyDefinitions(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: copyInput,
            targetId: `priority-metric-copy:${clientIdempotencyKey}`,
          },
          ({ payload }) =>
            ({
              definitions: [],
              sourceProjectId: payload.sourceProjectId,
              targetProjectId: payload.targetProjectId,
            }) satisfies PriorityMetricDefinitionsCopyMutationValue,
        );
        return receipt.nextValue.definitions;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, clientIdempotencyKey);
      }
    }),
  priorityMetricProjectValues: protectedProcedure
    .input(priorityMetricProjectValuesInputSchema)
    .handler(async ({ context, input }) => {
      const values = await requirePriorityMetrics(context).projectValues(
        context.session.user.id,
        input.projectId,
      );
      if (!values) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return values;
    }),
  priorityMetricTrashImpactPreview: protectedProcedure
    .input(priorityMetricTrashImpactPreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requirePriorityMetrics(context).trashImpactPreview(
        context.session.user.id,
        input.metricId,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Priority metric is unavailable.",
        });
      }
      return preview;
    }),
  priorityMetricValues: protectedProcedure
    .input(priorityMetricValuesInputSchema)
    .handler(async ({ context, input }) => {
      const values = await requirePriorityMetrics(context).values(
        context.session.user.id,
        input.workId,
      );
      if (!values) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return values;
    }),
  createPriorityMetric: protectedProcedure
    .input(createPriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...createInput } = input;
      const parsed = createPriorityMetricInputSchema.parse(createInput);
      const mutation = requirePriorityMetricMutationContracts(context).create(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: clientIdempotencyKey,
          },
          ({ currentRevision, payload }) => {
            const timestamp = new Date().toISOString();
            return {
              metric: {
                createdAt: timestamp,
                enabled: true,
                id: crypto.randomUUID(),
                name: payload.name,
                projectId: payload.projectId,
                rankDescriptions: payload.rankDescriptions,
                revision: currentRevision + 1,
                shortDescription: payload.shortDescription,
                trashedAt: null,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, clientIdempotencyKey);
      }
    }),
  updatePriorityMetric: protectedProcedure
    .input(updatePriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, metricId, ...payloadInput } =
        input;
      const parsed = updatePriorityMetricInputSchema.parse(payloadInput);
      const mutation = requirePriorityMetricMutationContracts(context).update(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: metricId,
          },
          ({ currentRevision, currentValue, payload }) => {
            const current = currentValue.metric;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              metric: {
                ...current,
                enabled: payload.enabled,
                name: payload.name,
                rankDescriptions: payload.rankDescriptions,
                revision: currentRevision + 1,
                shortDescription: payload.shortDescription,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  trashPriorityMetric: protectedProcedure
    .input(trashPriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, metricId } = input;
      const mutation = requirePriorityMetricMutationContracts(context).trash(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: metricId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.metric;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              metric: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: timestamp,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  restorePriorityMetric: protectedProcedure
    .input(restorePriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, metricId } = input;
      const mutation = requirePriorityMetricMutationContracts(context).restore(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: metricId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.metric;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              metric: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: timestamp,
              },
            } satisfies PriorityMetricMutationValue;
          },
        );
        const { metric } = receipt.nextValue;
        if (!metric) {
          throw new ORPCError("NOT_FOUND");
        }
        return metric;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  deletePriorityMetric: protectedProcedure
    .input(deletePriorityMetricMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey,
        grant,
        metricId,
        projectId,
        typedProjectName,
      } = input;
      const mutation = requirePriorityMetricMutationContracts(context).delete(
        context.session.user.id,
      );
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: { projectId },
            targetId: metricId,
          },
          async ({ currentValue }) => {
            const current = currentValue.metric;
            if (!current || current.projectId !== projectId) {
              throw new ORPCError("NOT_FOUND");
            }
            const project = await requireProjectShell(context).find(
              context.session.user.id,
              projectId,
            );
            if (!project) {
              throw new ORPCError("NOT_FOUND");
            }
            if (project.name !== typedProjectName) {
              throw new ORPCError("BAD_REQUEST", {
                defined: true,
                message: "The Project name does not match.",
              });
            }
            const consumed = await confirmation.consume(
              sessionPrincipal(context.session),
              "early-permanent-delete",
              grant,
              context.clientKey,
            );
            if (!consumed) {
              throw new ORPCError("FORBIDDEN", {
                defined: true,
                message:
                  "Confirm GitHub Identity is required to delete this criterion.",
              });
            }
            return { metric: null } satisfies PriorityMetricMutationValue;
          },
        );
        if (receipt.nextValue.metric !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowPriorityMetricMutationError(error, metricId);
      }
    }),
  setPriorityMetricValue: protectedProcedure
    .input(setPriorityMetricValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = setPriorityMetricValueInputSchema.parse(payloadInput);
      const targetId = `${parsed.workId}:${parsed.metricId}`;
      const mutation = requirePriorityMetricMutationContracts(context).setValue(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => {
            const timestamp = new Date().toISOString();
            const current = currentValue.value;
            return {
              value: {
                createdAt: current?.createdAt ?? timestamp,
                id: current?.id ?? crypto.randomUUID(),
                metricId: payload.metricId,
                projectId: payload.projectId,
                rank: payload.rank,
                revision: currentRevision + 1,
                updatedAt: timestamp,
                workId: payload.workId,
              },
            } satisfies PriorityMetricValueMutationValue;
          },
        );
        if (!receipt.nextValue.value) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.value;
      } catch (error) {
        rethrowPriorityMetricMutationError(error, targetId);
      }
    }),
  clearPriorityMetricValue: protectedProcedure
    .input(clearPriorityMetricValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = clearPriorityMetricValueInputSchema.parse(payloadInput);
      const targetId = `${parsed.workId}:${parsed.metricId}`;
      const mutation = requirePriorityMetricMutationContracts(
        context,
      ).clearValue(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          () => ({ value: null }) satisfies PriorityMetricValueMutationValue,
        );
        if (receipt.nextValue.value !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowPriorityMetricMutationError(error, targetId);
      }
    }),
  focusPeriods: protectedProcedure.handler(({ context }) =>
    requireFocusPeriod(context).list(context.session.user.id),
  ),
  focusPeriod: protectedProcedure
    .input(focusPeriodIdInputSchema)
    .handler(({ context, input }) =>
      requireFocusPeriod(context).find(context.session.user.id, input.periodId),
    ),
  createFocusPeriod: protectedProcedure
    .input(createFocusPeriodInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFocusPeriod(context).create(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  addToFocusPeriod: protectedProcedure
    .input(focusPeriodMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).add(
          context.session.user.id,
          input.periodId,
          input.workId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  moveToFocusPeriod: protectedProcedure
    .input(focusPeriodMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).move(
          context.session.user.id,
          input.periodId,
          input.workId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  removeFromFocusPeriod: protectedProcedure
    .input(focusPeriodMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).remove(
          context.session.user.id,
          input.periodId,
          input.workId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  cancelFocusPeriod: protectedProcedure
    .input(focusPeriodIdInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).cancel(
          context.session.user.id,
          input.periodId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  closeFocusPeriod: protectedProcedure
    .input(focusPeriodIdInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).close(
          context.session.user.id,
          input.periodId,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  decideFocusPeriodLeftovers: protectedProcedure
    .input(focusPeriodDecisionInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).decide(
          context.session.user.id,
          input,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  saveFocusPeriodEvaluation: protectedProcedure
    .input(focusPeriodEvaluationInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFocusPeriod(context).saveEvaluation(
          context.session.user.id,
          input,
        );
        return { status: true };
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  createFocusPeriodFollowUpWork: protectedProcedure
    .input(focusPeriodFollowUpWorkInputSchema)
    .handler(async ({ context, input }) => {
      const accountId = context.session.user.id;
      const access = requireFocusPeriod(context);
      try {
        const source = await access.find(accountId, input.periodId);
        if (!source) {
          throw new FocusPeriodUnavailableError("Focus Period is unavailable.");
        }
        if (source.status !== "Closed") {
          throw new FocusPeriodConflictError(
            "Follow-up Work needs a Closed Focus Period.",
          );
        }
        const learningKey = {
          Keep: "keep",
          Change: "change",
          "Try next": "tryNext",
        } as const satisfies Record<
          typeof input.learning,
          "keep" | "change" | "tryNext"
        >;
        const learningText = source.evaluation?.[learningKey[input.learning]];
        if (!learningText) {
          throw new FocusPeriodConflictError(
            "Follow-up Work needs a saved period learning.",
          );
        }
        const created = await runWorkLifecycleOperation(() =>
          requireWorkLifecycle(context).create(accountId, {
            baseRevision: 0,
            clientIdempotencyKey: input.clientIdempotencyKey,
            projectId: input.projectId,
            title: input.title,
            type: input.type,
            ...(input.description === undefined
              ? {}
              : { description: input.description }),
          }),
        );
        await access.linkFollowUpWork(accountId, {
          periodId: input.periodId,
          workId: created.id,
          learning: input.learning,
          learningText,
        });
        return created;
      } catch (error) {
        rethrowFocusPeriodError(error);
      }
    }),
  returnToWork: protectedProcedure
    .input(returnContextInputSchema)
    .handler(({ context, input }) =>
      requireReturnToWork(context).read(context.session.user.id, input),
    ),
  markReturnContextViewed: protectedProcedure
    .input(returnContextInputSchema)
    .handler(async ({ context, input }) => {
      await requireReturnToWork(context).markViewed(
        context.session.user.id,
        input,
      );
      return { status: true };
    }),
  saveNextConcreteStep: protectedProcedure
    .input(saveNextConcreteStepInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireReturnToWork(context).saveNextStep(
          context.session.user.id,
          input,
        );
        return { status: true };
      } catch (error) {
        if (input.workId) {
          rethrowWorkLifecycleError(error);
        }
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  dailyFocusDay: protectedProcedure
    .input(dailyFocusDayInputSchema)
    .handler(({ context, input }) =>
      requireDailyFocus(context).list(context.session.user.id, input.focusDate),
    ),
  decisionSupersessionGraph: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).supersession;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.read(context.session.user.id, input.projectId);
    }),
  decisionSupersessionHistory: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).supersession;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access.history(context.session.user.id, input.projectId);
    }),
  previewDecisionSupersession: protectedProcedure
    .input(decisionSupersessionSelectionSchema)
    .handler(async ({ context, input }) => {
      try {
        const access = requireProjectSourceRecords(context).supersession;
        if (!access) {
          throw new ORPCError("NOT_IMPLEMENTED");
        }
        const result = await access.preview(context.session.user.id, input);
        if (!result) {
          throw new ORPCError("NOT_FOUND");
        }
        return result;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  commitDecisionSupersession: protectedProcedure
    .input(decisionSupersessionCommandSchema)
    .handler(async ({ context, input }) => {
      try {
        const access = requireProjectSourceRecords(context).supersession;
        if (!access) {
          throw new ORPCError("NOT_IMPLEMENTED");
        }
        const result = await access.commit(context.session.user.id, input);
        if (!result) {
          throw new ORPCError("NOT_FOUND");
        }
        return result;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  projectAssumptions: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).listAssumptions;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access(context.session.user.id, input.projectId);
    }),
  projectDecisions: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).listDecisions(
        context.session.user.id,
        input.projectId,
      ),
    ),
  projectSourceRecords: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).list(
        context.session.user.id,
        input.projectId,
      ),
    ),
  openQuestions: protectedProcedure
    .input(projectSourceRecordsProjectInputSchema)
    .handler(({ context, input }) => {
      const access = requireProjectSourceRecords(context).listOpenQuestions;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access(context.session.user.id, input.projectId);
    }),
  openQuestionContext: protectedProcedure
    .input(projectSourceRecordInputSchema)
    .handler(({ context, input }) => {
      if (input.sourceType !== "Open Question") {
        throw new ORPCError("BAD_REQUEST");
      }
      const access = requireProjectSourceRecords(context).openQuestionContext;
      if (!access) {
        throw new ORPCError("NOT_IMPLEMENTED");
      }
      return access(context.session.user.id, input.sourceId);
    }),
  projectSourceRecord: protectedProcedure
    .input(projectSourceRecordInputSchema)
    .handler(({ context, input }) =>
      requireProjectSourceRecords(context).find(
        context.session.user.id,
        input.sourceType,
        input.sourceId,
      ),
    ),
  createProjectSourceRecord: protectedProcedure
    .input(createProjectSourceRecordInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectSourceRecords(context).create(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  updateProjectSourceRecord: protectedProcedure
    .input(updateProjectSourceRecordInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectSourceRecords(context).update(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  transitionProjectSourceRecord: protectedProcedure
    .input(transitionProjectSourceRecordInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const record = await requireProjectSourceRecords(context).transition(
          context.session.user.id,
          input,
        );
        if (!record) {
          throw new ORPCError("NOT_FOUND");
        }
        return record;
      } catch (error) {
        rethrowProjectSourceRecordError(error);
      }
    }),
  dailyFocusClose: protectedProcedure
    .input(dailyFocusDayInputSchema)
    .handler(({ context, input }) =>
      requireDailyFocus(context).readClose(
        context.session.user.id,
        input.focusDate,
      ),
    ),
  favoritesList: protectedProcedure.handler(({ context }) =>
    requireFavorites(context).list(context.session.user.id),
  ),
  openFavoriteSource: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFavorites(context).open(
          context.session.user.id,
          input,
        );
      } catch (error) {
        if (error instanceof FavoriteSourceUnavailableError) {
          throw new ORPCError("NOT_FOUND", {
            cause: error,
            message: "Source record is unavailable.",
          });
        }
        throw error;
      }
    }),
  favoriteMembership: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => ({
      isFavorite: await requireFavorites(context).contains(
        context.session.user.id,
        input,
      ),
    })),
  addToFavorites: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFavorites(context).add(context.session.user.id, input);
      } catch (error) {
        if (error instanceof FavoriteSourceUnavailableError) {
          throw new ORPCError("NOT_FOUND", {
            cause: error,
            defined: true,
            message: "Source record is unavailable.",
          });
        }
        throw error;
      }
      return { status: true };
    }),
  removeFromFavorites: protectedProcedure
    .input(favoriteSourceSchema)
    .handler(async ({ context, input }) => {
      await requireFavorites(context).remove(context.session.user.id, input);
      return { status: true };
    }),
  addToDailyFocus: protectedProcedure
    .input(dailyFocusMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireDailyFocus(context).add(
          context.session.user.id,
          input.focusDate,
          input.workId,
        );
      } catch (error) {
        if (error instanceof DailyFocusWorkUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
      return { status: true };
    }),
  removeFromDailyFocus: protectedProcedure
    .input(dailyFocusMembershipInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireDailyFocus(context).remove(
          context.session.user.id,
          input.focusDate,
          input.workId,
        );
      } catch (error) {
        if (error instanceof DailyFocusWorkUnavailableError) {
          throw new ORPCError("NOT_FOUND", { cause: error });
        }
        throw error;
      }
      return { status: true };
    }),
  projectBacklogOrder: protectedProcedure
    .input(projectBacklogInputSchema)
    .handler(async ({ context, input }) => {
      const order = await requireBacklog(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!order) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Backlog is unavailable.",
        });
      }
      return order;
    }),
  projectBacklog: protectedProcedure
    .input(projectBacklogInputSchema)
    .handler(async ({ context, input }) => {
      const work = await requireBacklog(context).listPrepared(
        context.session.user.id,
        input.projectId,
      );
      if (!work) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Backlog is unavailable.",
        });
      }
      return work;
    }),
  projectRoadmapViews: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const views = await requireRoadmapHorizon(context).listViews(
        context.session.user.id,
        input.projectId,
      );
      if (!views) {
        throw new ORPCError("NOT_FOUND");
      }
      return views;
    }),
  projectRoadmapOrigins: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const origins = await requireRoadmapHorizon(context).listOrigins(
        context.session.user.id,
        input.projectId,
      );
      if (!origins) {
        throw new ORPCError("NOT_FOUND");
      }
      return origins;
    }),
  projectRoadmapBlockers: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const blockers = await requireRoadmapHorizon(context).listActiveBlockers(
        context.session.user.id,
        input.projectId,
      );
      if (!blockers) {
        throw new ORPCError("NOT_FOUND");
      }
      return blockers;
    }),
  personalReminderSignals: protectedProcedure.handler(({ context }) =>
    requirePersonalReminders(context).listSignals(context.session.user.id),
  ),
  dismissPersonalReminderSignal: protectedProcedure
    .input(personalReminderSignalInputSchema)
    .handler(async ({ context, input }) => {
      const signal = await requirePersonalReminders(context).dismissSignal(
        context.session.user.id,
        input.signalId,
      );
      if (!signal) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Reminder signal is unavailable.",
        });
      }
      return signal;
    }),
  reschedulePersonalReminderSignal: protectedProcedure
    .input(reschedulePersonalReminderSignalInputSchema)
    .handler(({ context, input }) =>
      runPersonalReminderOperation(async () => {
        const reminder = await requirePersonalReminders(
          context,
        ).rescheduleSignal(context.session.user.id, input);
        if (!reminder) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Reminder signal is unavailable.",
          });
        }
        return reminder;
      }),
    ),
  personalReminders: protectedProcedure
    .input(personalRemindersInputSchema)
    .handler(async ({ context, input }) => {
      const reminders = await requirePersonalReminders(context).list(
        context.session.user.id,
        input,
      );
      if (!reminders) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Reminders are unavailable for this source.",
        });
      }
      return reminders;
    }),
  createPersonalReminder: protectedProcedure
    .input(createPersonalReminderInputSchema)
    .handler(({ context, input }) =>
      runPersonalReminderOperation(async () => {
        const reminder = await requirePersonalReminders(context).create(
          context.session.user.id,
          input,
        );
        if (!reminder) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Reminder is unavailable for this source.",
          });
        }
        return reminder;
      }),
    ),
  cancelPersonalReminder: protectedProcedure
    .input(cancelPersonalReminderInputSchema)
    .handler(async ({ context, input }) => {
      const reminder = await requirePersonalReminders(context).cancel(
        context.session.user.id,
        input.reminderId,
      );
      if (!reminder) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Planned reminder is unavailable.",
        });
      }
      return reminder;
    }),
  workReviewLater: protectedProcedure
    .input(workReviewLaterInputSchema)
    .handler(async ({ context, input }) => {
      const reminders = await requirePersonalReminders(context).list(
        context.session.user.id,
        { sourceRecordId: input.workId, sourceRecordType: "Work" },
      );
      if (!reminders) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work reminders are unavailable.",
        });
      }
      return reminders.filter((reminder) => reminder.action === "Review Later");
    }),
  createWorkReviewLater: protectedProcedure
    .input(createWorkReviewLaterInputSchema)
    .handler(({ context, input }) =>
      runPersonalReminderOperation(async () => {
        const reminder = await requirePersonalReminders(context).create(
          context.session.user.id,
          {
            action: "Review Later",
            clientIdempotencyKey: input.clientIdempotencyKey,
            condition: input.condition,
            fireAt: input.fireAt,
            sourceRecordId: input.workId,
            sourceRecordType: "Work",
          },
        );
        if (!reminder) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Review Later is unavailable for this Work.",
          });
        }
        return reminder;
      }),
    ),
  cancelWorkReviewLater: protectedProcedure
    .input(cancelWorkReviewLaterInputSchema)
    .handler(async ({ context, input }) => {
      const reminder = await requirePersonalReminders(context).cancel(
        context.session.user.id,
        input.reminderId,
        { action: "Review Later", sourceRecordType: "Work" },
      );
      if (!reminder) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Planned Review Later is unavailable.",
        });
      }
      return reminder;
    }),
  workNotNowHistory: protectedProcedure
    .input(workNotNowHistoryInputSchema)
    .handler(async ({ context, input }) => {
      const history = await requireRoadmapHorizon(context).history(
        context.session.user.id,
        input.workId,
      );
      if (!history) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work history is unavailable.",
        });
      }
      return history;
    }),
  recordWorkNotNow: protectedProcedure
    .input(recordWorkNotNowInputSchema)
    .handler(({ context, input }) =>
      runWorkNotNowOperation(async () => {
        const trail = await requireRoadmapHorizon(context).record(
          context.session.user.id,
          input,
        );
        if (!trail) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Not now can be recorded only on open Work.",
          });
        }
        return trail;
      }),
    ),
  reconsiderWorkNotNow: protectedProcedure
    .input(reconsiderWorkNotNowInputSchema)
    .handler(({ context, input }) =>
      runWorkNotNowOperation(async () => {
        const trail = await requireRoadmapHorizon(context).reconsider(
          context.session.user.id,
          input,
        );
        if (!trail) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "The active Not now trail is unavailable.",
          });
        }
        return trail;
      }),
    ),
  projectMilestones: protectedProcedure
    .input(projectRoadmapInputSchema)
    .handler(async ({ context, input }) => {
      const milestones = await requireRoadmapHorizon(context).listMilestones(
        context.session.user.id,
        input.projectId,
      );
      if (!milestones) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestones;
    }),
  createMilestone: protectedProcedure
    .input(createMilestoneInputSchema)
    .handler(async ({ context, input }) => {
      const milestone = await requireRoadmapHorizon(context).createMilestone(
        context.session.user.id,
        input,
      );
      if (!milestone) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestone;
    }),
  updateMilestone: protectedProcedure
    .input(updateMilestoneInputSchema)
    .handler(async ({ context, input }) => {
      const milestone = await requireRoadmapHorizon(context).updateMilestone(
        context.session.user.id,
        input,
      );
      if (!milestone) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestone;
    }),
  updateMilestoneStatus: protectedProcedure
    .input(updateMilestoneStatusInputSchema)
    .handler(async ({ context, input }) => {
      const milestone = await requireRoadmapHorizon(
        context,
      ).updateMilestoneStatus(context.session.user.id, input);
      if (!milestone) {
        throw new ORPCError("NOT_FOUND");
      }
      return milestone;
    }),
  saveRoadmapView: protectedProcedure
    .input(saveRoadmapViewInputSchema)
    .handler(async ({ context, input }) => {
      const view = await requireRoadmapHorizon(context).saveView(
        context.session.user.id,
        input,
      );
      if (!view) {
        throw new ORPCError("NOT_FOUND");
      }
      return view;
    }),
  projectBacklogPresentation: protectedProcedure
    .input(projectBacklogInputSchema)
    .handler(async ({ context, input }) => {
      const presentation = await requireBacklog(context).listPresentation(
        context.session.user.id,
        input.projectId,
      );
      if (!presentation) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Backlog is unavailable.",
        });
      }
      return presentation;
    }),
  saveBacklogPresentation: protectedProcedure
    .input(saveBacklogPresentationMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = saveBacklogPresentationInputSchema.parse(payloadInput);
      const targetId = parsed.projectId;
      const mutation = requireBacklogMutationContracts(
        context,
      ).savePresentation(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => ({
            ...currentValue,
            revision: currentRevision + 1,
            saved: payload.saved,
          }),
        );
        return receipt.nextValue;
      } catch (error) {
        rethrowBacklogMutationError(error, targetId);
      }
    }),
  updateBacklogOrder: protectedProcedure
    .input(updateBacklogOrderMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = updateBacklogOrderInputSchema.parse(payloadInput);
      const targetId = parsed.projectId;
      const mutation = requireBacklogMutationContracts(context).updateOrder(
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => ({
            order: currentValue.order
              ? {
                  ...currentValue.order,
                  revision: currentRevision + 1,
                  workIds: payload.workIds,
                }
              : null,
          }),
        );
        if (!receipt.nextValue.order) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.order;
      } catch (error) {
        rethrowBacklogMutationError(error, targetId);
      }
    }),
  prioritizationSessions: protectedProcedure
    .input(prioritizationSessionsProjectInputSchema)
    .handler(async ({ context, input }) => {
      const sessions = await requirePrioritizationSessions(context).list(
        context.session.user.id,
        input.projectId,
      );
      if (!sessions) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The Project Prioritization sessions are unavailable.",
        });
      }
      return sessions;
    }),
  createPrioritizationSession: protectedProcedure
    .input(createPrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = createPrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = clientIdempotencyKey;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).create(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, payload }) => {
            const timestamp = new Date().toISOString();
            return {
              session: {
                closedAt: null,
                createdAt: timestamp,
                id: crypto.randomUUID(),
                name: payload.name,
                projectId: payload.projectId,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: timestamp,
                workIds: payload.workIds,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  updatePrioritizationSessionOrder: protectedProcedure
    .input(updatePrioritizationSessionOrderMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed =
        updatePrioritizationSessionOrderInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).updateOrder(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue, payload }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            return {
              session: {
                ...current,
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
                workIds: payload.workIds,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  closePrioritizationSession: protectedProcedure
    .input(closePrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = closePrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).close(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            const timestamp = new Date().toISOString();
            return {
              session: {
                ...current,
                closedAt: timestamp,
                revision: currentRevision + 1,
                updatedAt: timestamp,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  trashPrioritizationSession: protectedProcedure
    .input(trashPrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed = trashPrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).trash(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            const timestamp = new Date().toISOString();
            return {
              session: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: timestamp,
                updatedAt: timestamp,
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  restorePrioritizationSession: protectedProcedure
    .input(restorePrioritizationSessionMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...payloadInput } = input;
      const parsed =
        restorePrioritizationSessionInputSchema.parse(payloadInput);
      const targetId = parsed.sessionId;
      const mutation = requirePrioritizationSessionMutationContracts(
        context,
      ).restore(context.session.user.id);
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentRevision, currentValue }) => {
            const current = currentValue.session;
            if (!current) {
              return { session: null };
            }
            return {
              session: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: new Date().toISOString(),
              },
            } satisfies PrioritizationSessionMutationValue;
          },
        );
        if (!receipt.nextValue.session) {
          throw new ORPCError("NOT_FOUND");
        }
        return receipt.nextValue.session;
      } catch (error) {
        rethrowPrioritizationSessionMutationError(error, targetId);
      }
    }),
  copyCustomFieldDefinitions: protectedProcedure
    .input(copyCustomFieldDefinitionsInputSchema)
    .handler(async ({ context, input }) => {
      try {
        const definitions = await requireCustomFields(context).copyDefinitions(
          context.session.user.id,
          input,
        );
        if (!definitions) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Source or target Project is unavailable.",
          });
        }
        return definitions;
      } catch (error) {
        rethrowCustomFieldMutationError(error, input.targetProjectId, {
          targetNotFoundMessage: "Source or target Project is unavailable.",
        });
      }
    }),
  projectWorks: protectedProcedure
    .input(
      z
        .object({
          archived: z.union([z.boolean(), z.literal("all")]).default(false),
          projectId: z.string().trim().min(1),
        })
        .strict(),
    )
    .handler(({ context, input }) =>
      requireWorkLifecycle(context).list(
        context.session.user.id,
        input.projectId,
        { archived: input.archived },
      ),
    ),
  workContext: protectedProcedure
    .input(workContextInputSchema)
    .handler(async ({ context, input }) => {
      const projection = await requireWorkContext(context).find(
        context.session.user.id,
        input.workId,
      );
      if (!projection) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work context is unavailable.",
        });
      }
      return projection;
    }),
  relations: protectedProcedure
    .input(relationsInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).list(context.session.user.id, input),
      ),
    ),
  usedIn: protectedProcedure
    .input(relationsInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).listUsedIn(context.session.user.id, input),
      ),
    ),
  relationPreview: protectedProcedure
    .input(relationCreatePreviewInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).previewCreate(context.session.user.id, input),
      ),
    ),
  createRelation: protectedProcedure
    .input(relationCreateInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).create(context.session.user.id, input),
      ),
    ),
  resolveBlocker: protectedProcedure
    .input(resolveBlockerInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).resolveBlocker(
          context.session.user.id,
          input,
        ),
      ),
    ),
  reactivateBlocker: protectedProcedure
    .input(reactivateBlockerInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).reactivateBlocker(
          context.session.user.id,
          input,
        ),
      ),
    ),
  removeRelation: protectedProcedure
    .input(removeRelationInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).remove(context.session.user.id, input),
      ),
    ),
  undoRelation: protectedProcedure
    .input(undoRelationInputSchema)
    .handler(({ context, input }) =>
      runRelationsOperation(() =>
        requireRelations(context).undo(context.session.user.id, input),
      ),
    ),
  workDrafts: protectedProcedure
    .input(workDraftsInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).list(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  workDraft: protectedProcedure
    .input(workDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).find(context.session.user.id, input.draftId),
      ),
    ),
  saveWorkDraft: protectedProcedure
    .input(saveWorkDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).save(context.session.user.id, input),
      ),
    ),
  deleteWorkDraft: protectedProcedure
    .input(deleteWorkDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).delete(context.session.user.id, input),
      ),
    ),
  finalizeWorkDraft: protectedProcedure
    .input(finalizeWorkDraftInputSchema)
    .handler(({ context, input }) =>
      runWorkDraftOperation(() =>
        requireWorkDrafts(context).finalize(context.session.user.id, input),
      ),
    ),
  scopeTree: protectedProcedure
    .input(z.object({ projectId: z.string().trim().min(1) }).strict())
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).scopeTree(
          context.session.user.id,
          input.projectId,
        ),
      ),
    ),
  featureProgress: protectedProcedure
    .input(z.object({ featureId: z.string().trim().min(1) }).strict())
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).featureProgress(
          context.session.user.id,
          input.featureId,
        ),
      ),
    ),
  includeWork: protectedProcedure
    .input(includeWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).includeWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  detachIncludedWork: protectedProcedure
    .input(detachIncludedWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).detachIncludedWork(
          context.session.user.id,
          input,
        ),
      ),
    ),
  recordFeatureHealth: protectedProcedure
    .input(recordFeatureHealthInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).recordFeatureHealth(
          context.session.user.id,
          input,
        ),
      ),
    ),
  detachFeatureHealthHistory: protectedProcedure
    .input(detachFeatureHealthHistoryInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).detachFeatureHealthHistory(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateFeaturePrimarySpec: protectedProcedure
    .input(updateFeaturePrimarySpecInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateFeaturePrimarySpec(
          context.session.user.id,
          input,
        ),
      ),
    ),
  work: protectedProcedure
    .input(z.object({ workId: z.string().trim().min(1) }).strict())
    .handler(async ({ context, input }) => {
      const record = await requireWorkLifecycle(context).find(
        context.session.user.id,
        input.workId,
      );
      if (!record) {
        throw new ORPCError("NOT_FOUND");
      }
      return record;
    }),
  workTypeChangePreview: protectedProcedure
    .input(workTypeChangePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewTypeChange(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return preview;
    }),
  workRecreatePreview: protectedProcedure
    .input(workRecreatePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewRecreate(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work or target Project is unavailable.",
        });
      }
      return preview;
    }),
  workChecklistConversionPreview: protectedProcedure
    .input(workChecklistConversionPreviewInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(async () => {
        const preview = await requireWorkLifecycle(
          context,
        ).previewChecklistConversion(context.session.user.id, input);
        if (!preview) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work checklist item is unavailable.",
          });
        }
        return preview;
      }),
    ),
  workMergePreview: protectedProcedure
    .input(workMergePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewMerge(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "The selected Work records are unavailable.",
        });
      }
      return preview;
    }),
  mergeWork: protectedProcedure
    .input(mergeWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).merge(context.session.user.id, input),
      ),
    ),
  resolveWorkIdentity: protectedProcedure
    .input(workIdentityInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).resolve(context.session.user.id, input),
      ),
    ),
  undoWorkMerge: protectedProcedure
    .input(undoWorkMergeInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).undoMerge(context.session.user.id, input),
      ),
    ),
  undoWorkStatus: protectedProcedure
    .input(undoWorkStatusInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).undoStatus(
          context.session.user.id,
          input,
        ),
      ),
    ),
  undoWorkDate: protectedProcedure
    .input(undoWorkDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).undoDate(context.session.user.id, input),
      ),
    ),
  recreateWork: protectedProcedure
    .input(recreateWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).recreate(context.session.user.id, input),
      ),
    ),
  workClosePreview: protectedProcedure
    .input(workClosePreviewInputSchema)
    .handler(async ({ context, input }) => {
      const preview = await requireWorkLifecycle(context).previewClose(
        context.session.user.id,
        input,
      );
      if (!preview) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Work is unavailable.",
        });
      }
      return preview;
    }),
  updateWorkType: protectedProcedure
    .input(updateWorkTypeInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateType(
          context.session.user.id,
          input,
        ),
      ),
    ),
  archiveWork: protectedProcedure
    .input(workArchiveMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).archive(context.session.user.id, input),
      ),
    ),
  updateWorkStatus: protectedProcedure
    .input(updateWorkStatusInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateStatus(
          context.session.user.id,
          input,
          { kind: "Visible user" },
        ),
      ),
    ),
  updateWorkChecklist: protectedProcedure
    .input(updateWorkChecklistInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateChecklist(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkReappearDate: protectedProcedure
    .input(updateWorkReappearDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateReappearDate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkPlannedDate: protectedProcedure
    .input(updateWorkPlannedDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updatePlannedDate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkDate: protectedProcedure
    .input(updateWorkDateInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateDate(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateWorkHorizon: protectedProcedure
    .input(updateWorkHorizonInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateRoadmapHorizon(
          context.session.user.id,
          input,
        ),
      ),
    ),
  updateResearchDirection: protectedProcedure
    .input(updateResearchDirectionInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).updateResearchDirection(
          context.session.user.id,
          input,
        ),
      ),
    ),
  convertWorkChecklistItem: protectedProcedure
    .input(convertWorkChecklistItemInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).convertChecklistItem(
          context.session.user.id,
          input,
        ),
      ),
    ),
  closeWork: protectedProcedure
    .input(closeWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).close(context.session.user.id, input, {
          kind: "Visible user",
        }),
      ),
    ),
  reopenWork: protectedProcedure
    .input(reopenWorkInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).reopen(context.session.user.id, input, {
          kind: "Visible user",
        }),
      ),
    ),
  unarchiveWork: protectedProcedure
    .input(workArchiveMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).unarchive(context.session.user.id, input),
      ),
    ),
  createWork: protectedProcedure
    .input(createWorkRpcMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).create(context.session.user.id, input),
      ),
    ),
  createDocumentWorkBatch: protectedProcedure
    .input(createDocumentWorkBatchInputSchema)
    .handler(({ context, input }) => {
      const createBatch = requireWorkLifecycle(context).createDocumentWorkBatch;
      if (!createBatch) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      return runWorkLifecycleOperation(() =>
        createBatch(context.session.user.id, input),
      );
    }),
  createProject: protectedProcedure
    .input(createProjectMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...createInput } = input;
      const parsed = createProjectInputSchema.parse(createInput);
      const mutation = requireProjectShellMutationContract(
        context,
        "create",
        context.session.user.id,
      );
      const baseShortCode =
        parsed.shortCode ?? suggestProjectShortCode(parsed.name);

      for (let attempt = 0; attempt < 10_000; attempt += 1) {
        const shortCode = shortCodeSchema.parse(
          attempt === 0 ? baseShortCode : `${baseShortCode}-${attempt + 1}`,
        );
        try {
          // biome-ignore lint/performance/noAwaitInLoops: Automatic suggestions must be retried in order so each candidate reflects the previous reservation result.
          const receipt = await mutation.mutate(
            {
              actor: { actorId: context.session.user.id, type: "User" },
              baseRevision,
              clientIdempotencyKey,
              kind: "human",
              payload: parsed,
              targetId: clientIdempotencyKey,
            },
            ({ currentRevision }) => {
              const timestamp = new Date().toISOString();
              return {
                project: {
                  createdAt: timestamp,
                  configuration: getProjectShellConfiguration(
                    parsed.starterConfiguration,
                  ),
                  id: crypto.randomUUID(),
                  logo: nullableProjectValue(parsed.logo),
                  name: parsed.name,
                  problem: nullableProjectValue(parsed.problem),
                  purpose: nullableProjectValue(parsed.purpose),
                  revision: currentRevision + 1,
                  scope: nullableProjectValue(parsed.scope),
                  shortCode,
                  shortCodeLocked: false,
                  starterConfiguration: parsed.starterConfiguration,
                  status: "Active",
                  targetDate: parsed.targetDate ?? null,
                  updatedAt: timestamp,
                },
              } satisfies ProjectShellMutationValue;
            },
          );
          return receipt.nextValue.project;
        } catch (error) {
          if (
            isRecord(error) &&
            error.code === "SHORT_CODE_CONFLICT" &&
            !parsed.shortCode
          ) {
            continue;
          }
          rethrowProjectShellMutationError(error, clientIdempotencyKey);
        }
      }

      throw new ORPCError("CONFLICT", {
        data: {
          code: "SHORT_CODE_CONFLICT",
          label: "Short code is already used in this Workspace.",
        },
        defined: true,
        message: "Short code could not be suggested.",
      });
    }),
  createCustomField: protectedProcedure
    .input(createCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...createInput } = input;
      const parsed = createCustomFieldInputSchema.parse(createInput);
      const mutation = requireCustomFieldMutationContracts(context).create(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: clientIdempotencyKey,
          },
          ({ currentRevision, payload }) => {
            const timestamp = new Date().toISOString();
            return {
              field: {
                createdAt: timestamp,
                id: crypto.randomUUID(),
                name: payload.name,
                options: payload.options,
                projectId: payload.projectId,
                recordTypes: payload.recordTypes,
                revision: currentRevision + 1,
                trashedAt: null,
                type: payload.type,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, clientIdempotencyKey, {
          targetNotFoundMessage: "Project is unavailable.",
        });
      }
    }),
  customFieldValues: protectedProcedure
    .input(customFieldValuesInputSchema)
    .handler(async ({ context, input }) => {
      const items = await requireCustomFields(context).values(
        context.session.user.id,
        input,
      );
      if (!items) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return items;
    }),
  customFieldSearchFields: protectedProcedure
    .input(customFieldSearchFieldsInputSchema)
    .handler(async ({ context, input }) => {
      const fields = await requireCustomFields(context).searchFields(
        context.session.user.id,
        input,
      );
      if (!fields) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return fields;
    }),
  customFieldProjectValues: protectedProcedure
    .input(customFieldProjectValuesInputSchema)
    .handler(async ({ context, input }) => {
      const projectValues = await requireCustomFields(context).projectValues(
        context.session.user.id,
        input,
      );
      if (!projectValues) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      return projectValues;
    }),
  previewCustomFieldOptionDeletion: protectedProcedure
    .input(previewCustomFieldOptionDeletionInputSchema)
    .handler(({ context, input }) =>
      requireCustomFields(context).previewOptionDeletion(
        context.session.user.id,
        input,
      ),
    ),
  updateCustomField: protectedProcedure
    .input(updateCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const {
        baseRevision,
        clientIdempotencyKey,
        definitionId,
        ...inputPayload
      } = input;
      const parsed = updateCustomFieldInputSchema.parse(inputPayload);
      const mutation = requireCustomFieldMutationContracts(context).update(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId: definitionId,
          },
          ({ currentValue, currentRevision, payload }) => {
            const current = currentValue.field;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              field: {
                ...current,
                name: payload.name,
                options: payload.options,
                recordTypes: payload.recordTypes,
                revision: currentRevision + 1,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  trashCustomField: protectedProcedure
    .input(trashCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, definitionId } = input;
      const mutation = requireCustomFieldMutationContracts(context).trash(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: definitionId,
          },
          ({ currentValue, currentRevision }) => {
            const current = currentValue.field;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              field: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: timestamp,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  restoreCustomField: protectedProcedure
    .input(restoreCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, definitionId } = input;
      const mutation = requireCustomFieldMutationContracts(context).restore(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: definitionId,
          },
          ({ currentValue, currentRevision }) => {
            const current = currentValue.field;
            if (!current) {
              throw new ORPCError("NOT_FOUND");
            }
            const timestamp = new Date().toISOString();
            return {
              field: {
                ...current,
                revision: currentRevision + 1,
                trashedAt: null,
                updatedAt: timestamp,
              },
            } satisfies CustomFieldMutationValue;
          },
        );
        const { field } = receipt.nextValue;
        if (!field) {
          throw new ORPCError("NOT_FOUND");
        }
        return field;
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  deleteCustomField: protectedProcedure
    .input(deleteCustomFieldMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, definitionId } = input;
      const mutation = requireCustomFieldMutationContracts(context).delete(
        context.session.user.id,
      );

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: definitionId,
          },
          () => ({ field: null }) satisfies CustomFieldMutationValue,
        );
        if (receipt.nextValue.field !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowCustomFieldMutationError(error, definitionId);
      }
    }),
  setCustomFieldValue: protectedProcedure
    .input(setCustomFieldValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...valueInput } = input;
      const parsed = setCustomFieldValueInputSchema.parse(valueInput);
      const mutation = requireCustomFieldMutationContracts(context).setValue(
        context.session.user.id,
      );
      const targetId = `${parsed.definitionId}:${parsed.recordId}`;

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          ({ currentValue, currentRevision }) => {
            const timestamp = new Date().toISOString();
            return {
              value: {
                createdAt: currentValue.value?.createdAt ?? timestamp,
                definitionId: parsed.definitionId,
                id: currentValue.value?.id ?? crypto.randomUUID(),
                recordId: parsed.recordId,
                recordType: parsed.recordType,
                revision: currentRevision + 1,
                updatedAt: timestamp,
                value: parsed.payload,
              },
            } satisfies CustomFieldValueMutationValue;
          },
        );
        const { value } = receipt.nextValue;
        if (!value) {
          throw new ORPCError("NOT_FOUND");
        }
        return value;
      } catch (error) {
        rethrowCustomFieldMutationError(error, targetId);
      }
    }),
  clearCustomFieldValue: protectedProcedure
    .input(clearCustomFieldValueMutationInputSchema)
    .handler(async ({ context, input }) => {
      const { baseRevision, clientIdempotencyKey, ...valueInput } = input;
      const parsed = clearCustomFieldValueInputSchema.parse(valueInput);
      const mutation = requireCustomFieldMutationContracts(context).clearValue(
        context.session.user.id,
      );
      const targetId = `${parsed.definitionId}:${parsed.recordId}`;

      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision,
            clientIdempotencyKey,
            kind: "human",
            payload: parsed,
            targetId,
          },
          () => ({ value: null }) satisfies CustomFieldValueMutationValue,
        );
        if (receipt.nextValue.value !== null) {
          throw new ORPCError("NOT_FOUND");
        }
        return { status: true };
      } catch (error) {
        rethrowCustomFieldMutationError(error, targetId);
      }
    }),
  updateProjectShortCode: protectedProcedure
    .input(updateProjectShortCodeInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: { shortCode: input.shortCode },
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision, payload }) => {
            if (!currentValue.project) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                revision: currentRevision + 1,
                shortCode: payload.shortCode,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return project;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  enableProjectArea: protectedProcedure
    .input(enableProjectAreaInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: { area: input.area },
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision, payload }) => {
            if (!currentValue.project) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                configuration: enableProjectArea(
                  currentValue.project.configuration,
                  payload.area,
                ),
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return project;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  updateProjectConfiguration: protectedProcedure
    .input(updateProjectConfigurationInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      try {
        const receipt = await mutation.mutate(
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: { change: input.change },
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision }) => {
            if (!currentValue.project) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                configuration: applyProjectShellConfigurationChange(
                  currentValue.project.configuration,
                  input.change,
                  currentValue.project.starterConfiguration,
                ),
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
          input.change.kind === "set-work-context-layout"
            ? {
                undo: {
                  kind: "view-metadata",
                  scope: `${WORK_CONTEXT_LAYOUT_UNDO_SCOPE_PREFIX}${input.change.workType}`,
                },
              }
            : undefined,
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return input.change.kind === "set-work-context-layout"
          ? ({
              ...project,
              receiptId: receipt.id,
            } satisfies WorkContextLayoutMutationResult)
          : project;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  previewWorkContextLayout: protectedProcedure
    .input(previewWorkContextLayoutInputSchema)
    .handler(async ({ context, input }) => {
      const project = await requireProjectShell(context).find(
        context.session.user.id,
        input.projectId,
      );
      if (!project) {
        throw new ORPCError("NOT_FOUND", {
          defined: true,
          message: "Project is unavailable.",
        });
      }
      if (project.revision !== input.baseRevision) {
        throw new ORPCError("PRECONDITION_FAILED", {
          data: {
            code: "STALE_BASE_REVISION",
            currentRevision: project.revision,
            currentValue: project,
            label: MUTATION_UI_LABELS.currentValue,
            targetId: input.projectId,
          },
          defined: true,
          message: MUTATION_UI_LABELS.currentValue,
        });
      }
      try {
        const nextConfiguration = applyProjectShellConfigurationChange(
          project.configuration,
          input.change,
          project.starterConfiguration,
        );
        return {
          baseRevision: project.revision,
          preview: previewWorkContextLayout(
            input.change.workType,
            project.configuration.workContextLayouts[input.change.workType],
            nextConfiguration.workContextLayouts[input.change.workType],
          ),
          projectId: project.id,
          workType: input.change.workType,
        };
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  undoWorkContextLayout: protectedProcedure
    .input(undoWorkContextLayoutInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireProjectShellMutationContract(
        context,
        "update",
        context.session.user.id,
      );
      if (!(mutation.findReceiptById && mutation.undo)) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }
      try {
        const sourceReceipt = await mutation.findReceiptById(input.receiptId);
        if (!sourceReceipt) {
          throw new ORPCError("NOT_FOUND", {
            defined: true,
            message: "Work Context Card layout history is unavailable.",
          });
        }
        const workType = workContextLayoutTypeFromUndoScope(
          sourceReceipt.undo?.scope,
        );
        if (sourceReceipt.targetId !== input.projectId || !workType) {
          throw new ORPCError("BAD_REQUEST", {
            data: { code: "WORK_CONTEXT_LAYOUT_UNDO_NOT_SUPPORTED" },
            defined: true,
            message: "Only Work Context Card layout changes can be undone.",
          });
        }
        const receipt = await mutation.undo(
          sourceReceipt,
          {
            actor: { actorId: context.session.user.id, type: "User" },
            baseRevision: input.baseRevision,
            clientIdempotencyKey: input.clientIdempotencyKey,
            kind: "human",
            payload: {},
            targetId: input.projectId,
          },
          ({ currentValue, currentRevision, previousValue }) => {
            if (!(currentValue.project && previousValue.project)) {
              throw new ORPCError("NOT_FOUND");
            }
            return {
              project: {
                ...currentValue.project,
                configuration: {
                  ...currentValue.project.configuration,
                  workContextLayouts: {
                    ...currentValue.project.configuration.workContextLayouts,
                    [workType]:
                      previousValue.project.configuration.workContextLayouts[
                        workType
                      ],
                  },
                },
                revision: currentRevision + 1,
                updatedAt: new Date().toISOString(),
              },
            } satisfies ProjectShellMutationValue;
          },
        );
        const { project } = receipt.nextValue;
        if (!project) {
          throw new ORPCError("NOT_FOUND");
        }
        return {
          ...project,
          receiptId: receipt.id,
        } satisfies WorkContextLayoutMutationResult;
      } catch (error) {
        rethrowProjectShellMutationError(error, input.projectId);
      }
    }),
  captureInbox: protectedProcedure.handler(({ context }) =>
    requireCaptureInbox(context).list(context.session.user.id),
  ),
  createCapture: protectedProcedure
    .input(captureInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInbox(context).create(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  updateCaptureBulkSenseMaking: protectedProcedure
    .input(captureBulkSenseMakingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInbox(context).updateBulkSenseMaking(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  createBug: protectedProcedure
    .input(captureInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInbox(context).createBug(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  captureSuggestions: protectedProcedure
    .input(captureSuggestionsInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).suggestions(
          context.session.user.id,
          input.itemId,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  previewCaptureConversion: protectedProcedure
    .input(captureConvertPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).previewConvert(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  convertCapture: protectedProcedure
    .input(captureConvertInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).convert(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  previewCaptureAttachment: protectedProcedure
    .input(captureAttachPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).previewAttachToExisting(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  attachCapture: protectedProcedure
    .input(captureAttachInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).attachToExisting(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  deleteCapture: protectedProcedure
    .input(captureDeleteInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).delete(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  previewCaptureMergeUndo: protectedProcedure
    .input(captureUndoMergePreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).previewUndoMerge(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  undoCaptureMerge: protectedProcedure
    .input(captureUndoMergeInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireCaptureInboxTriage(context).undoMerge(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowCaptureInboxError(error);
      }
    }),
  fileAttachments: protectedProcedure
    .input(fileAttachmentListInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).list(
          context.session.user.id,
          input.scope,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  fileAttachmentQuota: protectedProcedure.handler(async ({ context }) => {
    try {
      return await requireFileAttachments(context).getQuota(
        context.session.user.id,
      );
    } catch (error) {
      rethrowFileAttachmentError(error);
    }
  }),
  fileAttachmentMarkings: protectedProcedure
    .input(fileAttachmentMarkingsInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).listMarkings(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  createFileAttachmentMarking: protectedProcedure
    .input(fileAttachmentMarkingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).createMarking(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  undoFileAttachmentMarking: protectedProcedure
    .input(fileAttachmentUndoMarkingInputSchema)
    .handler(async ({ context, input }) => {
      try {
        await requireFileAttachments(context).undoMarking(
          context.session.user.id,
          input,
        );
        return { status: "undone" as const };
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  previewFileAttachmentLocationBind: protectedProcedure
    .input(fileAttachmentLocationBindPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).previewLocationBind(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentWorkError(error);
      }
    }),
  bindFileAttachmentLocation: protectedProcedure
    .input(fileAttachmentLocationBindInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).bindLocation(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentWorkError(error);
      }
    }),
  finalizeFileAttachment: protectedProcedure
    .input(fileAttachmentFinalizeInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).finalize(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  previewFileAttachment: protectedProcedure
    .input(fileAttachmentPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(context).preview(
          context.session.user.id,
          input,
        );
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  fileAttachmentExternalSurfaceSelection: protectedProcedure
    .input(fileAttachmentPreviewInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await requireFileAttachments(
          context,
        ).canSelectIntoExternalSurface(context.session.user.id, input);
      } catch (error) {
        rethrowFileAttachmentError(error);
      }
    }),
  sessions: protectedProcedure.handler(({ context }) =>
    context.accountAccess.listSessions(sessionPrincipal(context.session)),
  ),
  createWebCapturePairingCode: protectedProcedure.handler(({ context }) =>
    requireWebCapture(context).createPairingCode(context.session.user.id),
  ),
  webCaptureLinks: protectedProcedure.handler(({ context }) =>
    requireWebCapture(context).listLinks(context.session.user.id),
  ),
  revokeWebCaptureLink: protectedProcedure
    .input(revokeWebCaptureLinkInputSchema)
    .handler(async ({ context, input }) => {
      await requireWebCapture(context).revokeLink(
        context.session.user.id,
        input.linkId,
        sessionPrincipal(context.session).sessionId,
      );
      return { status: true };
    }),
  accountPreferences: protectedProcedure.handler(({ context }) =>
    context.accountPreferences.get(context.session.user.id),
  ),
  completionEffectsPreferences: protectedProcedure.handler(({ context }) =>
    requireCompletionEffectsPreferencesAccess(context).get(
      context.session.user.id,
    ),
  ),
  saveAccountAppearance: protectedProcedure
    .input(saveAccountAppearanceProcedureInputSchema)
    .handler(async ({ context, input }) => {
      if (!("baseRevision" in input)) {
        return requireAccountPreferencesCompatibility(context).saveAppearance(
          context.session.user.id,
          input.appearance,
        );
      }

      const receipt = await mutateAccountPreferences(
        context,
        {
          actor: { actorId: context.session.user.id, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: { appearance: input.appearance },
          targetId: context.session.user.id,
        },
        ({ currentValue, payload }) => ({
          ...currentValue,
          ...payload,
        }),
      );
      return preferencesSnapshotFromReceipt(receipt);
    }),
  saveAccountPreferences: protectedProcedure
    .input(saveAccountPreferencesProcedureInputSchema)
    .handler(async ({ context, input }) => {
      if (!("baseRevision" in input)) {
        return requireAccountPreferencesCompatibility(context).save(
          context.session.user.id,
          input,
        );
      }

      const receipt = await mutateAccountPreferences(
        context,
        {
          actor: { actorId: context.session.user.id, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: input.preferences,
          targetId: context.session.user.id,
        },
        ({ currentValue, payload }) => ({
          ...currentValue,
          ...payload,
        }),
      );
      return preferencesSnapshotFromReceipt(receipt);
    }),
  saveCompletionEffectsPreferences: protectedProcedure
    .input(saveCompletionEffectsPreferencesInputSchema)
    .handler(async ({ context, input }) => {
      const receipt = await mutateCompletionEffectsPreferences(
        context,
        {
          actor: { actorId: context.session.user.id, type: "User" },
          baseRevision: input.baseRevision,
          clientIdempotencyKey: input.clientIdempotencyKey,
          kind: "human",
          payload: input.preferences,
          targetId: context.session.user.id,
        },
        ({ payload }) => payload,
      );
      return completionEffectsPreferencesSnapshotFromReceipt(receipt);
    }),
  revokeSession: protectedProcedure
    .input(z.object({ sessionId: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      await context.accountAccess.revokeSession(
        sessionPrincipal(context.session),
        input.sessionId,
      );
      return { status: true };
    }),
  revokeOtherSessions: protectedProcedure.handler(async ({ context }) => {
    await context.accountAccess.revokeOtherSessions(
      sessionPrincipal(context.session),
    );
    return { status: true };
  }),
  startGitHubIdentityConfirmation: protectedProcedure
    .input(
      z.object({
        operationId: z.enum(CONFIRM_GITHUB_IDENTITY_OPERATION_IDS),
      }),
    )
    .handler(async ({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      const result = await confirmation.start(
        sessionPrincipal(context.session),
        input.operationId,
        context.clientKey,
        context.clientPlatform,
      );
      if (!result) {
        throw new ORPCError("BAD_REQUEST");
      }
      return result;
    }),
  exchangeGitHubIdentityHandoff: protectedProcedure
    .input(z.object({ code: z.string().min(1).max(512) }))
    .handler(async ({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      return {
        grant: await confirmation.exchange(
          sessionPrincipal(context.session),
          input.code,
          context.clientKey,
        ),
      };
    }),
  consumeGitHubIdentityGrant: protectedProcedure
    .input(
      z.object({
        grant: z.string().min(1).max(512),
        operationId: z.enum(CONFIRM_GITHUB_IDENTITY_OPERATION_IDS),
      }),
    )
    .handler(async ({ context, input }) => {
      const confirmation = context.githubIdentityConfirmation;
      if (!confirmation) {
        throw new ORPCError("INTERNAL_SERVER_ERROR");
      }

      return {
        consumed: await confirmation.consume(
          sessionPrincipal(context.session),
          input.operationId,
          input.grant,
          context.clientKey,
        ),
      };
    }),
};
export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<typeof appRouter>;
