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
  createProjectInputSchema,
  createProjectMutationInputSchema,
  enableProjectArea,
  enableProjectAreaInputSchema,
  getProjectShellConfiguration,
  type ProjectShellMutationValue,
  shortCodeSchema,
  suggestProjectShortCode,
  updateProjectShortCodeInputSchema,
} from "../project-shell";
import type { WebCaptureAccess } from "../web-capture";

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

  throw error;
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

  throw error;
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
