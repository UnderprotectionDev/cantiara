import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  type CaptureAttachInput,
  type CaptureAttachPreview,
  type CaptureAttachPreviewInput,
  type CaptureAttachReceipt,
  type CaptureBindReceipt,
  type CaptureConversionPreview,
  type CaptureConvertInput,
  type CaptureConvertPreviewInput,
  type CaptureConvertReceipt,
  type CaptureDeleteInput,
  type CaptureDeleteReceipt,
  type CaptureFieldMapping,
  type CaptureInboxGroup,
  type CaptureInboxItem,
  type CaptureInboxSnapshot,
  type CaptureInboxTriageAccess,
  type CaptureInboxTriageAdapter,
  type CaptureInput,
  type CaptureSuggestion,
  type CaptureSuggestions,
  type CaptureUndoMergeInput,
  type CaptureUndoMergePreview,
  type CaptureUndoMergePreviewInput,
  type CaptureUndoMergeReceipt,
  captureAttachInputSchema,
  captureAttachPreviewInputSchema,
  captureConvertInputSchema,
  captureConvertPreviewInputSchema,
  captureDeleteInputSchema,
  captureInboxItemSchema,
  captureInputSchema,
  captureSuggestionsInputSchema,
  captureUndoMergeInputSchema,
  captureUndoMergePreviewInputSchema,
  type DirectBugCreateInput,
  type DirectBugCreateReceipt,
  type NormalizedCaptureInput,
} from "@cantiara/api/capture-triage";

const CAPTURE_CONTENT_LINE_SEPARATOR = /\r?\n/u;

export interface CaptureInboxStore {
  consume?: (
    accountId: string,
    itemId: string,
  ) => Promise<CaptureInboxItem | null>;
  find?: (
    accountId: string,
    itemId: string,
  ) => Promise<CaptureInboxItem | null>;
  insert: (
    accountId: string,
    input: NormalizedCaptureInput,
  ) => Promise<CaptureInboxItem>;
  list: (accountId: string) => Promise<CaptureInboxItem[]>;
  restore?: (
    accountId: string,
    item: CaptureInboxItem,
  ) => Promise<CaptureInboxItem>;
}

export interface CaptureInboxWorkCreate {
  createBug: (input: DirectBugCreateInput) => Promise<DirectBugCreateReceipt>;
}

export class CaptureInboxError extends Error {
  readonly code: CaptureInboxErrorCode;

  constructor(code: CaptureInboxErrorCode, message: string) {
    super(message);
    this.name = "CaptureInboxError";
    this.code = code;
  }
}

export type CaptureInboxErrorCode =
  | "CAPTURE_NOT_FOUND"
  | "CAPTURE_PREVIEW_CONFLICT"
  | "CAPTURE_PREVIEW_REQUIRED"
  | "CAPTURE_TARGET_NOT_FOUND"
  | "CAPTURE_TRIAGE_UNAVAILABLE"
  | "CREATE_BUG_TEMPLATE_UNSUPPORTED"
  | "CAPTURE_IDEMPOTENCY_CONFLICT"
  | "CAPTURE_WORK_CREATE_UNAVAILABLE"
  | "PROJECT_REQUIRED_FOR_CREATE_BUG"
  | "UNKNOWN_CAPTURE_FIELD";

function normalizeCaptureInput(input: CaptureInput): NormalizedCaptureInput {
  const parsed = captureInputSchema.parse(input);
  const allowedFields: readonly string[] = parsed.template
    ? CAPTURE_TEMPLATE_FIELD_LABELS[parsed.template]
    : [];

  for (const field of Object.keys(parsed.fields)) {
    if (!allowedFields.includes(field)) {
      throw new CaptureInboxError(
        "UNKNOWN_CAPTURE_FIELD",
        `${field} is not a field in ${parsed.template ?? "freeform capture"}.`,
      );
    }
  }

  return parsed;
}

function groupCaptureInboxItems(items: CaptureInboxItem[]) {
  const groups = new Map<string, CaptureInboxGroup>();

  for (const item of items) {
    const projectKey = item.projectId?.toLocaleLowerCase("en-US");
    const groupKey = projectKey ? `project:${projectKey}` : "workspace";
    const existing = groups.get(groupKey);
    if (existing) {
      existing.itemIds.push(item.id);
      existing.items.push(item);
      continue;
    }

    groups.set(
      groupKey,
      projectKey
        ? {
            itemIds: [item.id],
            items: [item],
            kind: "project",
            label: "Project Capture Inbox",
            projectId: item.projectId ?? undefined,
          }
        : {
            itemIds: [item.id],
            items: [item],
            kind: "workspace",
            label: "Workspace Capture Inbox",
          },
    );
  }

  return [...groups.values()];
}

type PendingPreview =
  | {
      accountId: string;
      kind: "convert";
      preview: CaptureConversionPreview;
    }
  | {
      accountId: string;
      kind: "attach";
      preview: CaptureAttachPreview;
    }
  | {
      accountId: string;
      kind: "undo";
      preview: CaptureUndoMergePreview;
    };

interface CompletedOperation<TReceipt> {
  fingerprint: string;
  receipt: TReceipt;
}

interface MergeRecord {
  accountId: string;
  item: CaptureInboxItem;
  receipt: CaptureBindReceipt;
  targetId: string;
}

function sameProject(left: string | null, right: string | null) {
  if (left === null || right === null) {
    return left === right;
  }
  return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

function operationFingerprint(value: unknown) {
  return JSON.stringify(value);
}

function createUnavailableTriageAdapter(): CaptureInboxTriageAdapter {
  const unavailable = (): Promise<never> =>
    Promise.reject(
      new CaptureInboxError(
        "CAPTURE_TRIAGE_UNAVAILABLE",
        "Capture triage targets are not available yet.",
      ),
    );

  return {
    attachToExisting: unavailable,
    createRecord: unavailable,
    findRecord: unavailable,
    undoMerge: unavailable,
  };
}

export function createCaptureInbox({
  store,
  triageAdapter,
  workCreate,
}: {
  store: CaptureInboxStore;
  triageAdapter?: CaptureInboxTriageAdapter;
  workCreate: CaptureInboxWorkCreate;
}): CaptureInboxTriageAccess {
  const adapter = triageAdapter ?? createUnavailableTriageAdapter();
  const previews = new Map<string, PendingPreview>();
  const mergeRecords = new Map<string, MergeRecord>();
  const locallyConsumed = new Set<string>();
  const locallyRestored = new Map<string, CaptureInboxItem>();
  const completedConverts = new Map<
    string,
    CompletedOperation<CaptureConvertReceipt>
  >();
  const completedAttachments = new Map<
    string,
    CompletedOperation<CaptureAttachReceipt>
  >();
  const completedDeletes = new Map<
    string,
    CompletedOperation<CaptureDeleteReceipt>
  >();
  const completedUndos = new Map<
    string,
    CompletedOperation<CaptureUndoMergeReceipt>
  >();

  function itemKey(accountId: string, itemId: string) {
    return `${accountId}\u0000${itemId}`;
  }

  async function listStoredItems(accountId: string) {
    const restored = [...locallyRestored.entries()]
      .filter(([key]) => key.startsWith(`${accountId}\u0000`))
      .map(([, item]) => item);
    const restoredIds = new Set(restored.map((item) => item.id));
    const stored = (await store.list(accountId)).filter(
      (item) => !locallyConsumed.has(itemKey(accountId, item.id)),
    );
    return [...stored.filter((item) => !restoredIds.has(item.id)), ...restored];
  }

  async function findItem(accountId: string, itemId: string) {
    const key = itemKey(accountId, itemId);
    if (locallyConsumed.has(key)) {
      return null;
    }
    const restored = locallyRestored.get(key);
    if (restored) {
      return restored;
    }
    const found = store.find
      ? await store.find(accountId, itemId)
      : (await store.list(accountId)).find((item) => item.id === itemId);
    return found ? captureInboxItemSchema.parse(found) : null;
  }

  async function requireItem(accountId: string, itemId: string) {
    const item = await findItem(accountId, itemId);
    if (!item) {
      throw new CaptureInboxError(
        "CAPTURE_NOT_FOUND",
        "The Capture Inbox item is no longer available.",
      );
    }
    return item;
  }

  async function consumeItem(accountId: string, itemId: string) {
    const key = itemKey(accountId, itemId);
    if (locallyConsumed.has(key)) {
      return null;
    }
    const restored = locallyRestored.get(key);
    if (restored) {
      locallyRestored.delete(key);
      locallyConsumed.add(key);
      return restored;
    }
    if (store.consume) {
      const consumed = await store.consume(accountId, itemId);
      return consumed ? captureInboxItemSchema.parse(consumed) : null;
    }
    const item = await findItem(accountId, itemId);
    if (!item) {
      return null;
    }
    locallyConsumed.add(key);
    locallyRestored.delete(key);
    return item;
  }

  async function restoreItem(accountId: string, item: CaptureInboxItem) {
    const key = itemKey(accountId, item.id);
    if (store.restore) {
      await store.restore(accountId, item);
      return;
    }
    locallyConsumed.delete(key);
    locallyRestored.set(key, item);
  }

  function requirePreview<TKind extends PendingPreview["kind"]>(
    accountId: string,
    previewId: string | undefined,
    kind: TKind,
  ): Extract<PendingPreview, { kind: TKind }> {
    if (!previewId) {
      throw new CaptureInboxError(
        "CAPTURE_PREVIEW_REQUIRED",
        "Review the preview before confirming this Capture Inbox action.",
      );
    }
    const pending = previews.get(previewId);
    if (!pending || pending.accountId !== accountId || pending.kind !== kind) {
      throw new CaptureInboxError(
        "CAPTURE_PREVIEW_CONFLICT",
        "This Capture Inbox preview is no longer valid.",
      );
    }
    return pending as Extract<PendingPreview, { kind: TKind }>;
  }

  function cachedOperation<TReceipt>(
    accountId: string,
    clientIdempotencyKey: string | undefined,
    input: unknown,
    operations: Map<string, CompletedOperation<TReceipt>>,
  ) {
    if (!clientIdempotencyKey) {
      return;
    }
    const key = itemKey(accountId, clientIdempotencyKey);
    const existing = operations.get(key);
    const fingerprint = operationFingerprint(input);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new CaptureInboxError(
        "CAPTURE_IDEMPOTENCY_CONFLICT",
        "The action key was already used for different content.",
      );
    }
    return existing?.receipt;
  }

  function cacheOperation<TReceipt>(
    accountId: string,
    clientIdempotencyKey: string | undefined,
    input: unknown,
    receipt: TReceipt,
    operations: Map<string, CompletedOperation<TReceipt>>,
  ) {
    if (!clientIdempotencyKey) {
      return;
    }
    operations.set(itemKey(accountId, clientIdempotencyKey), {
      fingerprint: operationFingerprint(input),
      receipt,
    });
  }

  async function list(accountId: string): Promise<CaptureInboxSnapshot> {
    const items = (await listStoredItems(accountId))
      .map((item) => captureInboxItemSchema.parse(item))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return {
      groups: groupCaptureInboxItems(items),
      items,
    };
  }

  return {
    async create(accountId, input) {
      return await store.insert(accountId, normalizeCaptureInput(input));
    },

    async createBug(accountId, input) {
      const normalized = normalizeCaptureInput(input);
      if (!normalized.projectId) {
        throw new CaptureInboxError(
          "PROJECT_REQUIRED_FOR_CREATE_BUG",
          "Create Bug requires a Project.",
        );
      }
      if (
        normalized.template !== null &&
        normalized.template !== "Bug Capture"
      ) {
        throw new CaptureInboxError(
          "CREATE_BUG_TEMPLATE_UNSUPPORTED",
          "Create Bug is available for Bug Capture or an unspecified type.",
        );
      }

      return await workCreate.createBug({
        ...normalized,
        accountId,
      });
    },

    list,

    async previewConvert(
      accountId,
      rawInput: CaptureConvertPreviewInput,
    ): Promise<CaptureConversionPreview> {
      const input = captureConvertPreviewInputSchema.parse(rawInput);
      const item = await requireItem(accountId, input.itemId);
      const title =
        input.title ??
        item.content
          .split(CAPTURE_CONTENT_LINE_SEPARATOR)
          .find((line) => line.trim().length > 0) ??
        "Untitled capture";
      const fieldMappings: CaptureFieldMapping[] = Object.entries(
        item.fields,
      ).map(([sourceField, value]) => ({
        sourceField,
        targetField: sourceField,
        value,
      }));
      const targetScope = item.projectId
        ? {
            kind: "project" as const,
            label: "Project" as const,
            projectId: item.projectId,
          }
        : {
            kind: "workspace" as const,
            label: "Workspace" as const,
            projectId: null,
          };
      const preview: CaptureConversionPreview = {
        fieldMappings,
        itemId: item.id,
        previewId: crypto.randomUUID(),
        proposedRecord: {
          fields: item.fields,
          projectId: item.projectId,
          recordType: input.recordType,
          title,
        },
        source: item,
        targetScope,
      };
      previews.set(preview.previewId, { accountId, kind: "convert", preview });
      return preview;
    },

    async convert(
      accountId,
      rawInput: CaptureConvertInput,
    ): Promise<CaptureConvertReceipt> {
      const input = captureConvertInputSchema.parse(rawInput);
      const cached = cachedOperation(
        accountId,
        input.clientIdempotencyKey,
        input,
        completedConverts,
      );
      if (cached) {
        return cached;
      }
      const pending = requirePreview(accountId, input.previewId, "convert");
      if (pending.preview.itemId !== input.itemId) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "This conversion preview belongs to another Capture Inbox item.",
        );
      }
      const item = await requireItem(accountId, input.itemId);
      if (
        operationFingerprint(item) !==
        operationFingerprint(pending.preview.source)
      ) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The Capture Inbox item changed after the preview.",
        );
      }
      const consumed = await consumeItem(accountId, item.id);
      if (!consumed) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The Capture Inbox item is no longer available.",
        );
      }
      try {
        const created = await adapter.createRecord({
          accountId,
          fields: pending.preview.proposedRecord.fields,
          item: consumed,
          projectId: pending.preview.proposedRecord.projectId,
          recordType: pending.preview.proposedRecord.recordType,
          title: pending.preview.proposedRecord.title,
        });
        const receipt: CaptureConvertReceipt = {
          consumed: true,
          exit: "convert",
          itemId: item.id,
          recordId: created.id,
          recordType:
            created.recordType ?? pending.preview.proposedRecord.recordType,
        };
        previews.delete(input.previewId ?? "");
        cacheOperation(
          accountId,
          input.clientIdempotencyKey,
          input,
          receipt,
          completedConverts,
        );
        return receipt;
      } catch (error) {
        await restoreItem(accountId, consumed);
        throw error;
      }
    },

    async previewAttachToExisting(
      accountId,
      rawInput: CaptureAttachPreviewInput,
    ): Promise<CaptureAttachPreview> {
      const input = captureAttachPreviewInputSchema.parse(rawInput);
      const item = await requireItem(accountId, input.itemId);
      const target = await adapter.findRecord(accountId, input.targetId);
      if (!target) {
        throw new CaptureInboxError(
          "CAPTURE_TARGET_NOT_FOUND",
          "The selected target record is no longer available.",
        );
      }
      const crossProject = !sameProject(item.projectId, target.projectId);
      const preview: CaptureAttachPreview = {
        crossProject,
        itemId: item.id,
        previewId: crypto.randomUUID(),
        relationPreview: {
          relation: input.relation,
          targetId: target.id,
        },
        source: item,
        target,
        ...(target.projectId
          ? {
              targetProject: {
                id: target.projectId,
                name: target.projectName ?? target.projectId,
              },
            }
          : {}),
      };
      previews.set(preview.previewId, { accountId, kind: "attach", preview });
      return preview;
    },

    async attachToExisting(
      accountId,
      rawInput: CaptureAttachInput,
    ): Promise<CaptureAttachReceipt> {
      const input = captureAttachInputSchema.parse(rawInput);
      const cached = cachedOperation(
        accountId,
        input.clientIdempotencyKey,
        input,
        completedAttachments,
      );
      if (cached) {
        return cached;
      }
      const pending = requirePreview(accountId, input.previewId, "attach");
      const { preview } = pending;
      if (
        preview.itemId !== input.itemId ||
        preview.relationPreview.relation !== input.relation ||
        preview.relationPreview.targetId !== input.targetId
      ) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The selected target or relation changed after the preview.",
        );
      }
      const currentTarget = await adapter.findRecord(accountId, input.targetId);
      if (!currentTarget) {
        throw new CaptureInboxError(
          "CAPTURE_TARGET_NOT_FOUND",
          "The selected target record is no longer available.",
        );
      }
      if (
        currentTarget.revision !== preview.target.revision ||
        currentTarget.projectId !== preview.target.projectId
      ) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The selected target changed after the preview.",
        );
      }
      const item = await requireItem(accountId, input.itemId);
      if (operationFingerprint(item) !== operationFingerprint(preview.source)) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The Capture Inbox item changed after the preview.",
        );
      }
      const consumed = await consumeItem(accountId, item.id);
      if (!consumed) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The Capture Inbox item is no longer available.",
        );
      }
      const mergeId = crypto.randomUUID();
      try {
        const attached = await adapter.attachToExisting({
          accountId,
          item: consumed,
          mergeId,
          relation: input.relation,
          target: currentTarget,
        });
        const receipt: CaptureAttachReceipt = {
          consumed: true,
          exit: "attach",
          itemId: item.id,
          mergeId: attached.mergeId,
          relation: input.relation,
          targetId: input.targetId,
        };
        mergeRecords.set(attached.mergeId, {
          accountId,
          item: consumed,
          receipt: attached,
          targetId: input.targetId,
        });
        previews.delete(input.previewId ?? "");
        cacheOperation(
          accountId,
          input.clientIdempotencyKey,
          input,
          receipt,
          completedAttachments,
        );
        return receipt;
      } catch (error) {
        await restoreItem(accountId, consumed);
        throw error;
      }
    },

    async suggestions(accountId, itemId): Promise<CaptureSuggestions> {
      const item = await requireItem(
        accountId,
        captureSuggestionsInputSchema.parse({ itemId }).itemId,
      );
      const suggestions = adapter.findSimilar
        ? await adapter.findSimilar(accountId, item)
        : [];
      const sameProjectItems: CaptureSuggestion[] = [];
      const otherProjectItems = new Map<string, CaptureSuggestion[]>();
      for (const suggestion of suggestions) {
        if (sameProject(item.projectId, suggestion.projectId)) {
          sameProjectItems.push(suggestion);
          continue;
        }
        const projectKey = (
          suggestion.projectId ??
          suggestion.projectName ??
          "workspace"
        ).toLocaleLowerCase("en-US");
        const existing = otherProjectItems.get(projectKey) ?? [];
        existing.push(suggestion);
        otherProjectItems.set(projectKey, existing);
      }
      return {
        otherProjects: [...otherProjectItems.values()].map((items) => ({
          items,
          label: "Other Projects" as const,
        })),
        sameProject: {
          items: sameProjectItems,
          label: "Same Project",
        },
      };
    },

    async delete(
      accountId,
      rawInput: CaptureDeleteInput,
    ): Promise<CaptureDeleteReceipt> {
      const input = captureDeleteInputSchema.parse(rawInput);
      const cached = cachedOperation(
        accountId,
        input.clientIdempotencyKey,
        input,
        completedDeletes,
      );
      if (cached) {
        return cached;
      }
      const item = await requireItem(accountId, input.itemId);
      const consumed = await consumeItem(accountId, item.id);
      if (!consumed) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The Capture Inbox item is no longer available.",
        );
      }
      const receipt: CaptureDeleteReceipt = {
        consumed: true,
        exit: "delete",
        itemId: item.id,
      };
      cacheOperation(
        accountId,
        input.clientIdempotencyKey,
        input,
        receipt,
        completedDeletes,
      );
      return receipt;
    },

    previewUndoMerge(
      accountId,
      rawInput: CaptureUndoMergePreviewInput,
    ): Promise<CaptureUndoMergePreview> {
      const input = captureUndoMergePreviewInputSchema.parse(rawInput);
      const merge = mergeRecords.get(input.mergeId);
      if (!merge || merge.accountId !== accountId) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The merge is no longer available for undo.",
        );
      }
      const preview: CaptureUndoMergePreview = {
        itemId: merge.item.id,
        mergeId: input.mergeId,
        previewId: crypto.randomUUID(),
        removeFromTarget: {
          attributedRelationIds: merge.receipt.attributedRelationIds,
          attributedValueKeys: merge.receipt.attributedValueKeys,
        },
        restore: merge.item,
      };
      previews.set(preview.previewId, { accountId, kind: "undo", preview });
      return Promise.resolve(preview);
    },

    async undoMerge(
      accountId,
      rawInput: CaptureUndoMergeInput,
    ): Promise<CaptureUndoMergeReceipt> {
      const input = captureUndoMergeInputSchema.parse(rawInput);
      const cached = cachedOperation(
        accountId,
        input.clientIdempotencyKey,
        input,
        completedUndos,
      );
      if (cached) {
        return cached;
      }
      const pending = requirePreview(accountId, input.previewId, "undo");
      if (pending.preview.mergeId !== input.mergeId) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "This Undo Preview belongs to another merge.",
        );
      }
      const merge = mergeRecords.get(input.mergeId);
      if (!merge || merge.accountId !== accountId) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The merge is no longer available for undo.",
        );
      }
      const currentTarget = await adapter.findRecord(accountId, merge.targetId);
      await adapter.undoMerge({
        ...input,
        attributedRelationIds: merge.receipt.attributedRelationIds,
        attributedValueKeys: merge.receipt.attributedValueKeys,
        currentTarget,
      });
      await restoreItem(accountId, merge.item);
      const receipt: CaptureUndoMergeReceipt = {
        mergeId: input.mergeId,
        removedRelationIds: merge.receipt.attributedRelationIds,
        removedValueKeys: merge.receipt.attributedValueKeys,
        restoredItem: merge.item,
      };
      mergeRecords.delete(input.mergeId);
      previews.delete(input.previewId);
      cacheOperation(
        accountId,
        input.clientIdempotencyKey,
        input,
        receipt,
        completedUndos,
      );
      return receipt;
    },
  };
}
