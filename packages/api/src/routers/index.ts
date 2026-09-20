import { ORPCError, type RouterClient } from "@orpc/server";
import { z } from "zod";

import {
  type AccountPreferences,
  type AccountPreferencesSnapshot,
  accountPreferencesSchema,
  appearanceSchema,
} from "../account-preferences";
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
  applyProjectShellConfigurationChange,
  createProjectInputSchema,
  createProjectMutationInputSchema,
  enableProjectArea,
  enableProjectAreaInputSchema,
  getProjectShellConfiguration,
  type ProjectShellMutationValue,
  shortCodeSchema,
  suggestProjectShortCode,
  updateProjectConfigurationInputSchema,
  updateProjectShortCodeInputSchema,
} from "../project-shell";
import {
  createUsageLinkMutationInputSchema,
  listUsageLinksInputSchema,
  type UsageLinkMutationValue,
  unlinkUsageLinkInputSchema,
  usageLinkPayloadSchema,
  usageLinkSchema,
} from "../relations";
import type { WebCaptureAccess } from "../web-capture";
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
  createWorkMutationInputSchema,
  detachFeatureHealthHistoryInputSchema,
  detachIncludedWorkInputSchema,
  includeWorkInputSchema,
  mergeWorkInputSchema,
  recordFeatureHealthInputSchema,
  recreateWorkInputSchema,
  reopenWorkInputSchema,
  undoWorkMergeInputSchema,
  updateFeaturePrimarySpecInputSchema,
  updateWorkStatusInputSchema,
  updateWorkTypeInputSchema,
  workArchiveMutationInputSchema,
  workClosePreviewInputSchema,
  workIdentityInputSchema,
  workMergePreviewInputSchema,
  workRecreatePreviewInputSchema,
  workTypeChangePreviewInputSchema,
} from "../work-lifecycle";

function sessionPrincipal(session: NonNullable<Context["session"]>) {
  return {
    accountId: session.user.id,
    sessionId: session.session.id,
  };
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

const revokeWebCaptureLinkInputSchema = z
  .object({ linkId: z.string().trim().min(1).max(255) })
  .strict();

function requireAccountPreferencesMutationContract(context: Context) {
  if (!context.accountPreferencesMutationContract) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.accountPreferencesMutationContract;
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

function requireCustomFields(context: Context) {
  if (!context.customFields) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.customFields;
}

function requireCustomFieldMutationContracts(context: Context) {
  if (!context.customFieldMutationContracts) {
    throw new ORPCError("INTERNAL_SERVER_ERROR");
  }
  return context.customFieldMutationContracts;
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

function rethrowAccountPreferencesMutationError(
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
    const currentValue = accountPreferencesSchema.safeParse(rawCurrentValue);
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
    rethrowAccountPreferencesMutationError(error, command.targetId);
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

function nullableProjectValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

export const appRouter = {
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
    }),
  unlinkUsageLink: protectedProcedure
    .input(unlinkUsageLinkInputSchema)
    .handler(async ({ context, input }) => {
      const mutation = requireUsageLinkMutationContracts(context).unlink(
        context.session.user.id,
      );
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
          archived: z.boolean().default(false),
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
    .input(createWorkMutationInputSchema)
    .handler(({ context, input }) =>
      runWorkLifecycleOperation(() =>
        requireWorkLifecycle(context).create(context.session.user.id, input),
      ),
    ),
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
