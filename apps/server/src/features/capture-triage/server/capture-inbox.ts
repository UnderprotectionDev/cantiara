import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  type CaptureAttachInput,
  type CaptureAttachment,
  type CaptureAttachPreview,
  type CaptureAttachPreviewInput,
  type CaptureAttachReceipt,
  type CaptureBindReceipt,
  type CaptureBulkSenseMaking,
  type CaptureBulkSenseMakingInput,
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
  captureBulkSenseMakingInputSchema,
  captureBulkSenseMakingSchema,
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
import type {
  MutationContract,
  MutationPayload,
} from "@cantiara/api/mutation-and-undo";

const CAPTURE_CONTENT_LINE_SEPARATOR = /\r?\n/u;

export interface CaptureInboxStore {
  bulkSenseMaking: CaptureInboxBulkSenseMakingStore;
  /** Consume the item and remove its Bulk placement in one persistence operation. */
  consume: (
    accountId: string,
    itemId: string,
    attachmentDisposition: CaptureAttachmentDisposition,
  ) => Promise<CaptureInboxStoredItem | null>;
  find?: (
    accountId: string,
    itemId: string,
  ) => Promise<CaptureInboxItem | null>;
  findStored?: (
    accountId: string,
    itemId: string,
  ) => Promise<CaptureInboxStoredItem | null>;
  insert: (
    accountId: string,
    input: NormalizedCaptureInput,
  ) => Promise<CaptureInboxItem>;
  list: (accountId: string) => Promise<CaptureInboxItem[]>;
  operationState: CaptureInboxOperationStateStore;
  restore: (
    accountId: string,
    item: CaptureInboxStoredItem,
  ) => Promise<CaptureInboxStoredItem>;
}

export interface CaptureInboxBulkSenseMakingStore {
  get: (accountId: string) => Promise<CaptureBulkSenseMaking>;
  removeItem: (accountId: string, itemId: string) => Promise<void>;
  update: (
    accountId: string,
    input: CaptureBulkSenseMakingInput,
  ) => Promise<CaptureBulkSenseMaking>;
}

export type CaptureAttachmentDisposition = "delete" | "promoted";

export interface CaptureInboxStoredItem {
  clientIdempotencyKey: string | null;
  item: CaptureInboxItem;
  payloadFingerprint: string | null;
}

export type CaptureInboxPreview =
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

export interface CaptureInboxMergeRecord {
  accountId: string;
  item: CaptureInboxStoredItem;
  receipt: CaptureBindReceipt;
  targetId: string;
}

export interface CaptureInboxCompletedOperation<TReceipt> {
  fingerprint: string;
  receipt: TReceipt;
}

export interface CaptureInboxOperationStateStore {
  deleteMerge: (accountId: string, mergeId: string) => Promise<void>;
  deletePreview: (accountId: string, previewId: string) => Promise<void>;
  findCompleted: <TReceipt>(
    accountId: string,
    operation: "attach" | "convert" | "delete" | "undo",
    clientIdempotencyKey: string,
  ) => Promise<CaptureInboxCompletedOperation<TReceipt> | null>;
  findMerge: (
    accountId: string,
    mergeId: string,
  ) => Promise<CaptureInboxMergeRecord | null>;
  findPreview: (
    accountId: string,
    previewId: string,
  ) => Promise<CaptureInboxPreview | null>;
  saveCompleted: <TReceipt>(
    accountId: string,
    operation: "attach" | "convert" | "delete" | "undo",
    clientIdempotencyKey: string,
    completed: CaptureInboxCompletedOperation<TReceipt>,
  ) => Promise<void>;
  saveMerge: (merge: CaptureInboxMergeRecord) => Promise<void>;
  savePreview: (preview: CaptureInboxPreview) => Promise<void>;
}

export interface CaptureInboxStagingStore {
  delete: (input: {
    accountId: string;
    attachment: CaptureAttachment;
  }) => Promise<void>;
}

export interface CaptureInboxWorkCreate {
  createBug: (input: DirectBugCreateInput) => Promise<DirectBugCreateReceipt>;
}

export class CaptureInboxError extends Error {
  readonly code: CaptureInboxErrorCode;

  constructor(
    code: CaptureInboxErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
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
  | "CAPTURE_STAGING_UNAVAILABLE"
  | "CREATE_BUG_TEMPLATE_UNSUPPORTED"
  | "CAPTURE_IDEMPOTENCY_CONFLICT"
  | "CAPTURE_WORK_CREATE_UNAVAILABLE"
  | "CAPTURE_BULK_CLUSTER_INVALID"
  | "CAPTURE_BULK_ITEM_NOT_FOUND"
  | "CAPTURE_BULK_PLACEMENT_INVALID"
  | "CAPTURE_BULK_VIEW_CONFLICT"
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

function sameProject(left: string | null, right: string | null) {
  if (left === null || right === null) {
    return left === right;
  }
  return left.toLocaleLowerCase("en-US") === right.toLocaleLowerCase("en-US");
}

function operationFingerprint(value: unknown) {
  return JSON.stringify(value);
}

function normalizeBulkSenseMakingInput(
  rawInput: CaptureBulkSenseMakingInput,
  items: CaptureInboxItem[],
) {
  const input = captureBulkSenseMakingInputSchema.parse(rawInput);
  const clusterIds = new Set<string>();
  for (const cluster of input.clusters) {
    if (clusterIds.has(cluster.id)) {
      throw new CaptureInboxError(
        "CAPTURE_BULK_CLUSTER_INVALID",
        "Bulk sense-making cluster IDs must be unique.",
      );
    }
    clusterIds.add(cluster.id);
  }

  const itemIds = new Set(items.map((item) => item.id));
  const placedItemIds = new Set<string>();
  for (const placement of input.placements) {
    if (!itemIds.has(placement.itemId)) {
      throw new CaptureInboxError(
        "CAPTURE_BULK_ITEM_NOT_FOUND",
        "A Bulk sense-making placement refers to a resolved Capture Inbox item.",
      );
    }
    if (placedItemIds.has(placement.itemId)) {
      throw new CaptureInboxError(
        "CAPTURE_BULK_PLACEMENT_INVALID",
        "Each Capture Inbox item can have only one Bulk sense-making placement.",
      );
    }
    if (placement.clusterId && !clusterIds.has(placement.clusterId)) {
      throw new CaptureInboxError(
        "CAPTURE_BULK_CLUSTER_INVALID",
        "A Bulk sense-making placement refers to an unknown cluster.",
      );
    }
    placedItemIds.add(placement.itemId);
  }

  return input;
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
  triageMutationContract,
  workCreate,
}: {
  store: CaptureInboxStore;
  triageAdapter?: CaptureInboxTriageAdapter;
  triageMutationContract?: MutationContract<MutationPayload>;
  workCreate: CaptureInboxWorkCreate;
}): CaptureInboxTriageAccess {
  const adapter = triageAdapter ?? createUnavailableTriageAdapter();
  const triageAvailable = Boolean(triageAdapter);

  async function listStoredItems(accountId: string) {
    return await store.list(accountId);
  }

  async function findStoredItem(accountId: string, itemId: string) {
    if (store.findStored) {
      const found = await store.findStored(accountId, itemId);
      return found
        ? {
            ...found,
            item: captureInboxItemSchema.parse(found.item),
          }
        : null;
    }
    const found = store.find
      ? await store.find(accountId, itemId)
      : (await store.list(accountId)).find((item) => item.id === itemId);
    return found
      ? {
          clientIdempotencyKey: null,
          item: captureInboxItemSchema.parse(found),
          payloadFingerprint: null,
        }
      : null;
  }

  async function findItem(accountId: string, itemId: string) {
    return (await findStoredItem(accountId, itemId))?.item ?? null;
  }

  async function requireStoredItem(accountId: string, itemId: string) {
    const item = await findStoredItem(accountId, itemId);
    if (!item) {
      throw new CaptureInboxError(
        "CAPTURE_NOT_FOUND",
        "The Capture Inbox item is no longer available.",
      );
    }
    return item;
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

  async function consumeItem(
    accountId: string,
    itemId: string,
    attachmentDisposition: CaptureAttachmentDisposition,
  ) {
    const consumed = await store.consume(
      accountId,
      itemId,
      attachmentDisposition,
    );
    if (!consumed) {
      return null;
    }
    return {
      ...consumed,
      item: captureInboxItemSchema.parse(consumed.item),
    } satisfies CaptureInboxStoredItem;
  }

  async function restoreItem(accountId: string, item: CaptureInboxStoredItem) {
    if (await findItem(accountId, item.item.id)) {
      return;
    }
    await store.restore(accountId, item);
  }

  async function requirePreview<TKind extends CaptureInboxPreview["kind"]>(
    accountId: string,
    previewId: string | undefined,
    kind: TKind,
  ): Promise<Extract<CaptureInboxPreview, { kind: TKind }>> {
    if (!previewId) {
      throw new CaptureInboxError(
        "CAPTURE_PREVIEW_REQUIRED",
        "Review the preview before confirming this Capture Inbox action.",
      );
    }
    const pending = await store.operationState.findPreview(
      accountId,
      previewId,
    );
    if (!pending || pending.accountId !== accountId || pending.kind !== kind) {
      throw new CaptureInboxError(
        "CAPTURE_PREVIEW_CONFLICT",
        "This Capture Inbox preview is no longer valid.",
      );
    }
    return pending as Extract<CaptureInboxPreview, { kind: TKind }>;
  }

  async function cachedOperation<TReceipt>(
    accountId: string,
    operation: "attach" | "convert" | "delete" | "undo",
    clientIdempotencyKey: string,
    input: unknown,
  ): Promise<TReceipt | undefined> {
    const existing = await store.operationState.findCompleted<TReceipt>(
      accountId,
      operation,
      clientIdempotencyKey,
    );
    const fingerprint = operationFingerprint(input);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new CaptureInboxError(
        "CAPTURE_IDEMPOTENCY_CONFLICT",
        "The action key was already used for different content.",
      );
    }
    return existing?.receipt;
  }

  async function cacheOperation<TReceipt>(
    accountId: string,
    operation: "attach" | "convert" | "delete" | "undo",
    clientIdempotencyKey: string,
    input: unknown,
    receipt: TReceipt,
  ): Promise<void> {
    await store.operationState.saveCompleted(
      accountId,
      operation,
      clientIdempotencyKey,
      {
        fingerprint: operationFingerprint(input),
        receipt,
      },
    );
  }

  async function runTriageMutation<TResult>({
    accountId,
    action,
    clientIdempotencyKey,
    input,
    operation,
  }: {
    accountId: string;
    action: () => Promise<TResult>;
    clientIdempotencyKey: string;
    input: MutationPayload;
    operation: "attach" | "convert" | "delete" | "undo";
  }): Promise<TResult> {
    if (!triageMutationContract) {
      return await action();
    }

    const receipt = await triageMutationContract.mutate(
      {
        actor: { actorId: accountId, type: "User" },
        baseRevision: 0,
        clientIdempotencyKey,
        kind: "human",
        payload: { accountId, input, operation },
        targetId: `capture-triage:${accountId}:${operation}:${clientIdempotencyKey}`,
      },
      async () => {
        const result = await action();
        return {
          accountId,
          input,
          operation,
          result: result as MutationPayload,
        };
      },
    );
    const replayed = receipt.nextValue as {
      result?: TResult;
    };
    if (!("result" in replayed)) {
      throw new CaptureInboxError(
        "CAPTURE_PREVIEW_CONFLICT",
        "The Capture Inbox mutation receipt is incomplete.",
      );
    }
    return replayed.result as TResult;
  }

  async function list(accountId: string): Promise<CaptureInboxSnapshot> {
    const items = (await listStoredItems(accountId))
      .map((item) => captureInboxItemSchema.parse(item))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    const bulkSenseMaking = captureBulkSenseMakingSchema.parse(
      await store.bulkSenseMaking.get(accountId),
    );

    return {
      bulkSenseMaking,
      groups: groupCaptureInboxItems(items),
      items,
      triageAvailable,
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

    async updateBulkSenseMaking(accountId, rawInput) {
      const items = await listStoredItems(accountId);
      const input = normalizeBulkSenseMakingInput(rawInput, items);
      try {
        return captureBulkSenseMakingSchema.parse(
          await store.bulkSenseMaking.update(accountId, input),
        );
      } catch (error) {
        if (error instanceof CaptureInboxError) {
          throw error;
        }
        const conflict = new CaptureInboxError(
          "CAPTURE_BULK_VIEW_CONFLICT",
          "The Bulk sense-making view changed. Reload it and try again.",
        );
        conflict.cause = error;
        throw conflict;
      }
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
        proposedRelations: [{ relation: "Origin", target: "Proposed record" }],
        proposedRecord: {
          fields: item.fields,
          projectId: item.projectId,
          recordType: input.recordType,
          title,
        },
        source: item,
        targetScope,
      };
      await store.operationState.savePreview({
        accountId,
        kind: "convert",
        preview,
      });
      return preview;
    },

    async convert(
      accountId,
      rawInput: CaptureConvertInput,
    ): Promise<CaptureConvertReceipt> {
      const input = captureConvertInputSchema.parse(rawInput);
      const cached = cachedOperation<CaptureConvertReceipt>(
        accountId,
        "convert",
        input.clientIdempotencyKey,
        input,
      );
      const cachedReceipt = await cached;
      if (cachedReceipt) {
        await consumeItem(accountId, input.itemId, "promoted");
        if (input.previewId) {
          await store.operationState.deletePreview(accountId, input.previewId);
        }
        return cachedReceipt;
      }
      const pending = await requirePreview(
        accountId,
        input.previewId,
        "convert",
      );
      if (pending.preview.itemId !== input.itemId) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "This conversion preview belongs to another Capture Inbox item.",
        );
      }
      const storedItem = await requireStoredItem(accountId, input.itemId);
      const { item } = storedItem;
      if (
        operationFingerprint(item) !==
        operationFingerprint(pending.preview.source)
      ) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The Capture Inbox item changed after the preview.",
        );
      }
      const created = await runTriageMutation({
        accountId,
        action: () =>
          adapter.createRecord({
            accountId,
            clientIdempotencyKey: input.clientIdempotencyKey,
            fields: pending.preview.proposedRecord.fields,
            item,
            projectId: pending.preview.proposedRecord.projectId,
            recordType: pending.preview.proposedRecord.recordType,
            title: pending.preview.proposedRecord.title,
          }),
        clientIdempotencyKey: input.clientIdempotencyKey,
        input,
        operation: "convert",
      });
      const receipt: CaptureConvertReceipt = {
        consumed: true,
        exit: "convert",
        itemId: item.id,
        recordId: created.id,
        recordType:
          created.recordType ?? pending.preview.proposedRecord.recordType,
      };
      await cacheOperation(
        accountId,
        "convert",
        input.clientIdempotencyKey,
        input,
        receipt,
      );
      await consumeItem(accountId, item.id, "promoted");
      await store.operationState.deletePreview(
        accountId,
        input.previewId ?? "",
      );
      return receipt;
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
      await store.operationState.savePreview({
        accountId,
        kind: "attach",
        preview,
      });
      return preview;
    },

    async attachToExisting(
      accountId,
      rawInput: CaptureAttachInput,
    ): Promise<CaptureAttachReceipt> {
      const input = captureAttachInputSchema.parse(rawInput);
      const cached = cachedOperation<CaptureAttachReceipt>(
        accountId,
        "attach",
        input.clientIdempotencyKey,
        input,
      );
      const cachedReceipt = await cached;
      if (cachedReceipt) {
        await consumeItem(accountId, input.itemId, "promoted");
        if (input.previewId) {
          await store.operationState.deletePreview(accountId, input.previewId);
        }
        return cachedReceipt;
      }
      const pending = await requirePreview(
        accountId,
        input.previewId,
        "attach",
      );
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
      const storedItem = await requireStoredItem(accountId, input.itemId);
      const { item } = storedItem;
      if (operationFingerprint(item) !== operationFingerprint(preview.source)) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "The Capture Inbox item changed after the preview.",
        );
      }
      const mergeId = `${accountId}:${input.clientIdempotencyKey}`;
      const attached = await runTriageMutation({
        accountId,
        action: () =>
          adapter.attachToExisting({
            accountId,
            clientIdempotencyKey: input.clientIdempotencyKey,
            item,
            mergeId,
            relation: input.relation,
            target: currentTarget,
          }),
        clientIdempotencyKey: input.clientIdempotencyKey,
        input,
        operation: "attach",
      });
      const receipt: CaptureAttachReceipt = {
        consumed: true,
        exit: "attach",
        itemId: item.id,
        mergeId: attached.mergeId,
        relation: input.relation,
        targetId: input.targetId,
      };
      await store.operationState.saveMerge({
        accountId,
        item: storedItem,
        receipt: attached,
        targetId: input.targetId,
      });
      await cacheOperation(
        accountId,
        "attach",
        input.clientIdempotencyKey,
        input,
        receipt,
      );
      await consumeItem(accountId, item.id, "promoted");
      await store.operationState.deletePreview(
        accountId,
        input.previewId ?? "",
      );
      return receipt;
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
      const cached = cachedOperation<CaptureDeleteReceipt>(
        accountId,
        "delete",
        input.clientIdempotencyKey,
        input,
      );
      const cachedReceipt = await cached;
      if (cachedReceipt) {
        await consumeItem(accountId, input.itemId, "delete");
        return cachedReceipt;
      }
      const item = await requireItem(accountId, input.itemId);
      await runTriageMutation({
        accountId,
        action: async () => ({ finalized: true }),
        clientIdempotencyKey: input.clientIdempotencyKey,
        input,
        operation: "delete",
      });
      const receipt: CaptureDeleteReceipt = {
        consumed: true,
        exit: "delete",
        itemId: item.id,
      };
      await cacheOperation(
        accountId,
        "delete",
        input.clientIdempotencyKey,
        input,
        receipt,
      );
      await consumeItem(accountId, item.id, "delete");
      return receipt;
    },

    async previewUndoMerge(
      accountId,
      rawInput: CaptureUndoMergePreviewInput,
    ): Promise<CaptureUndoMergePreview> {
      const input = captureUndoMergePreviewInputSchema.parse(rawInput);
      const merge = await store.operationState.findMerge(
        accountId,
        input.mergeId,
      );
      if (!merge || merge.accountId !== accountId) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The merge is no longer available for undo.",
        );
      }
      const preview: CaptureUndoMergePreview = {
        itemId: merge.item.item.id,
        mergeId: input.mergeId,
        previewId: crypto.randomUUID(),
        removeFromTarget: {
          attributedRelationIds: merge.receipt.attributedRelationIds,
          attributedValueKeys: merge.receipt.attributedValueKeys,
        },
        restore: merge.item.item,
      };
      await store.operationState.savePreview({
        accountId,
        kind: "undo",
        preview,
      });
      return preview;
    },

    async undoMerge(
      accountId,
      rawInput: CaptureUndoMergeInput,
    ): Promise<CaptureUndoMergeReceipt> {
      const input = captureUndoMergeInputSchema.parse(rawInput);
      const cached = cachedOperation<CaptureUndoMergeReceipt>(
        accountId,
        "undo",
        input.clientIdempotencyKey,
        input,
      );
      const cachedReceipt = await cached;
      if (cachedReceipt) {
        const cachedMerge = await store.operationState.findMerge(
          accountId,
          input.mergeId,
        );
        if (cachedMerge) {
          await restoreItem(accountId, cachedMerge.item);
          await store.operationState.deleteMerge(accountId, input.mergeId);
        }
        await store.operationState.deletePreview(accountId, input.previewId);
        return cachedReceipt;
      }
      const pending = await requirePreview(accountId, input.previewId, "undo");
      if (pending.preview.mergeId !== input.mergeId) {
        throw new CaptureInboxError(
          "CAPTURE_PREVIEW_CONFLICT",
          "This Undo Preview belongs to another merge.",
        );
      }
      const merge = await store.operationState.findMerge(
        accountId,
        input.mergeId,
      );
      if (!merge || merge.accountId !== accountId) {
        throw new CaptureInboxError(
          "CAPTURE_NOT_FOUND",
          "The merge is no longer available for undo.",
        );
      }
      const currentTarget = await adapter.findRecord(accountId, merge.targetId);
      await runTriageMutation({
        accountId,
        action: async () => {
          await adapter.undoMerge({
            ...input,
            attributedRelationIds: merge.receipt.attributedRelationIds,
            attributedValueKeys: merge.receipt.attributedValueKeys,
            currentTarget,
          });
          return { finalized: true };
        },
        clientIdempotencyKey: input.clientIdempotencyKey,
        input,
        operation: "undo",
      });
      const receipt: CaptureUndoMergeReceipt = {
        mergeId: input.mergeId,
        removedRelationIds: merge.receipt.attributedRelationIds,
        removedValueKeys: merge.receipt.attributedValueKeys,
        restoredItem: merge.item.item,
      };
      await cacheOperation(
        accountId,
        "undo",
        input.clientIdempotencyKey,
        input,
        receipt,
      );
      await restoreItem(accountId, merge.item);
      await store.operationState.deleteMerge(accountId, input.mergeId);
      await store.operationState.deletePreview(accountId, input.previewId);
      return receipt;
    },
  };
}
