import {
  CAPTURE_TEMPLATE_FIELD_LABELS,
  CAPTURE_TRIAGE_EXITS,
  type CaptureBulkSenseMaking,
  type CaptureBulkSenseMakingInput,
  type CaptureInboxItem,
  type CaptureInboxTriageAdapter,
} from "@cantiara/api/capture-triage";
import { describe, expect, test, vi } from "vitest";
import type {
  CaptureInboxCompletedOperation,
  CaptureInboxMergeRecord,
  CaptureInboxOperationStateStore,
  CaptureInboxPreview,
  CaptureInboxStore,
} from "./capture-inbox";
import { createCaptureInbox } from "./capture-inbox";

function createMemoryOperationStateStore(): CaptureInboxOperationStateStore {
  const previews = new Map<string, CaptureInboxPreview>();
  const merges = new Map<string, CaptureInboxMergeRecord>();
  const completed = new Map<string, CaptureInboxCompletedOperation<unknown>>();
  const key = (accountId: string, id: string) => `${accountId}\u0000${id}`;

  return {
    deleteMerge: (accountId, mergeId) => {
      merges.delete(key(accountId, mergeId));
      return Promise.resolve();
    },
    deletePreview: (accountId, previewId) => {
      previews.delete(key(accountId, previewId));
      return Promise.resolve();
    },
    findCompleted: async <TReceipt>(
      accountId: string,
      operation: string,
      clientIdempotencyKey: string,
    ) =>
      (completed.get(key(accountId, `${operation}:${clientIdempotencyKey}`)) as
        | CaptureInboxCompletedOperation<TReceipt>
        | undefined) ?? null,
    findMerge: (accountId, mergeId) =>
      Promise.resolve(merges.get(key(accountId, mergeId)) ?? null),
    findPreview: (accountId, previewId) =>
      Promise.resolve(previews.get(key(accountId, previewId)) ?? null),
    saveCompleted: <TReceipt>(
      accountId: string,
      operation: string,
      clientIdempotencyKey: string,
      value: CaptureInboxCompletedOperation<TReceipt>,
    ) => {
      const operationKey = key(
        accountId,
        `${operation}:${clientIdempotencyKey}`,
      );
      if (!completed.has(operationKey)) {
        completed.set(
          operationKey,
          value as CaptureInboxCompletedOperation<unknown>,
        );
      }
      return Promise.resolve();
    },
    saveMerge: (merge) => {
      merges.set(key(merge.accountId, merge.receipt.mergeId), merge);
      return Promise.resolve();
    },
    savePreview: (preview) => {
      previews.set(key(preview.accountId, preview.preview.previewId), preview);
      return Promise.resolve();
    },
  };
}

function emptyBulkSenseMaking(revision = 0): CaptureBulkSenseMaking {
  return { clusters: [], placements: [], revision };
}

function copyBulkSenseMaking(
  value: CaptureBulkSenseMaking,
): CaptureBulkSenseMaking {
  return {
    clusters: value.clusters.map((cluster) => ({ ...cluster })),
    placements: value.placements.map((placement) => ({ ...placement })),
    revision: value.revision,
  };
}

function createMemoryBulkSenseMakingStore(
  initial: CaptureBulkSenseMaking = emptyBulkSenseMaking(),
) {
  const values = new Map<string, CaptureBulkSenseMaking>([
    ["account-1", copyBulkSenseMaking(initial)],
  ]);

  return {
    get: (accountId: string) =>
      Promise.resolve(
        copyBulkSenseMaking(values.get(accountId) ?? emptyBulkSenseMaking()),
      ),
    removeItem: (accountId: string, itemId: string) => {
      const current = values.get(accountId) ?? emptyBulkSenseMaking();
      const placements = current.placements.filter(
        (placement) => placement.itemId !== itemId,
      );
      const clusterIds = new Set(
        placements.flatMap((placement) =>
          placement.clusterId ? [placement.clusterId] : [],
        ),
      );
      values.set(accountId, {
        clusters: current.clusters.filter((cluster) =>
          clusterIds.has(cluster.id),
        ),
        placements,
        revision:
          placements.length === current.placements.length
            ? current.revision
            : current.revision + 1,
      });
      return Promise.resolve();
    },
    update: (accountId: string, input: CaptureBulkSenseMakingInput) => {
      const current = values.get(accountId) ?? emptyBulkSenseMaking();
      if (input.baseRevision !== current.revision) {
        throw new Error("The Bulk sense-making view changed.");
      }
      const next = {
        clusters: input.clusters,
        placements: input.placements,
        revision: current.revision + 1,
      } satisfies CaptureBulkSenseMaking;
      values.set(accountId, next);
      return Promise.resolve(copyBulkSenseMaking(next));
    },
  };
}

function createMemoryStore(
  initial: CaptureInboxItem[] = [],
  bulkSenseMaking = createMemoryBulkSenseMakingStore(),
) {
  const itemsByAccount = new Map([["account-1", [...initial]]]);
  let nextId = initial.length + 1;

  const store: CaptureInboxStore = {
    consume: async (accountId, itemId) => {
      const items = itemsByAccount.get(accountId) ?? [];
      const index = items.findIndex((candidate) => candidate.id === itemId);
      const removedItem = index < 0 ? undefined : items[index];
      if (!removedItem) {
        return null;
      }
      await bulkSenseMaking.removeItem(accountId, itemId);
      items.splice(index, 1);
      return {
        clientIdempotencyKey: null,
        item: removedItem,
        payloadFingerprint: null,
      };
    },
    bulkSenseMaking,
    list: (accountId) => Promise.resolve(itemsByAccount.get(accountId) ?? []),
    insert: (accountId, input) => {
      const items = itemsByAccount.get(accountId) ?? [];
      itemsByAccount.set(accountId, items);
      const id = `capture-${nextId}`;
      nextId += 1;
      const item: CaptureInboxItem = {
        ...(input.attachment === undefined
          ? {}
          : { attachment: input.attachment }),
        content: input.content,
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: input.fields,
        id,
        ...(input.link === undefined ? {} : { link: input.link }),
        ...(input.origin === undefined ? {} : { origin: input.origin }),
        projectId: input.projectId,
        template: input.template,
      };
      items.push(item);
      return Promise.resolve(item);
    },
    operationState: createMemoryOperationStateStore(),
    restore: (_accountId, stored) => {
      const items = itemsByAccount.get(_accountId) ?? [];
      items.push(stored.item);
      itemsByAccount.set(_accountId, items);
      return Promise.resolve(stored);
    },
  };

  return { items: itemsByAccount.get("account-1") ?? [], store };
}

function createTriageMemoryStore(
  initial: CaptureInboxItem[],
  operationState = createMemoryOperationStateStore(),
  bulkSenseMaking = createMemoryBulkSenseMakingStore(),
) {
  const items = [...initial];
  const store: CaptureInboxStore = {
    consume: async (accountId, itemId) => {
      const index = items.findIndex((candidate) => candidate.id === itemId);
      if (index < 0) {
        return null;
      }
      const removedItem = items[index];
      if (!removedItem) {
        return null;
      }
      await bulkSenseMaking.removeItem(accountId, itemId);
      items.splice(index, 1);
      return {
        clientIdempotencyKey: null,
        item: removedItem,
        payloadFingerprint: null,
      };
    },
    insert: (_accountId, input) => {
      const item: CaptureInboxItem = {
        content: input.content,
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: input.fields,
        id: `capture-${items.length + 1}`,
        projectId: input.projectId,
        template: input.template,
      };
      items.push(item);
      return Promise.resolve(item);
    },
    bulkSenseMaking,
    list: () => Promise.resolve([...items]),
    operationState,
    restore: (_accountId, stored) => {
      items.push(stored.item);
      return Promise.resolve(stored);
    },
  };
  return { items, operationState, store };
}

function createTriageAdapter(
  overrides: Partial<CaptureInboxTriageAdapter> = {},
) {
  const adapter: CaptureInboxTriageAdapter = {
    attachToExisting: vi.fn().mockResolvedValue({
      attributedRelationIds: ["relation-1"],
      attributedValueKeys: ["description"],
      mergeId: "merge-1",
    }),
    createRecord: vi.fn().mockResolvedValue({
      id: "record-1",
      recordType: "Work",
    }),
    findRecord: vi.fn().mockResolvedValue({
      fields: { description: "Existing description" },
      id: "record-1",
      projectId: "project-1",
      projectName: "Cantiara",
      recordType: "Work",
      revision: 1,
      title: "Existing record",
    }),
    findSimilar: vi.fn().mockResolvedValue([
      {
        basis: ["title", "content"],
        id: "record-1",
        projectId: "project-1",
        projectName: "Cantiara",
        recordType: "Work",
        title: "Existing record",
      },
      {
        basis: ["related context"],
        id: "record-2",
        projectId: "other-project",
        projectName: "Other Project",
        recordType: "Document",
        title: "Other record",
      },
    ]),
    undoMerge: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return adapter;
}

describe("Capture Inbox seam", () => {
  test("saves freeform text to the Workspace Capture Inbox without a main record", async () => {
    const { items, store } = createMemoryStore();
    const workCreate = { createBug: vi.fn() };
    const captureInbox = createCaptureInbox({ store, workCreate });

    const saved = await captureInbox.create("account-1", {
      content: "Investigate the slow preview",
    });
    const inbox = await captureInbox.list("account-1");

    expect(saved).toMatchObject({
      content: "Investigate the slow preview",
      fields: {},
      projectId: null,
      template: null,
    });
    expect(items).toHaveLength(1);
    expect(workCreate.createBug).not.toHaveBeenCalled();
    expect(inbox.groups).toEqual([
      expect.objectContaining({
        itemIds: [saved.id],
        kind: "workspace",
        label: "Workspace Capture Inbox",
      }),
    ]);
    expect(saved).not.toHaveProperty("expiresAt");
  });

  test("preserves capture provenance in the Inbox item", async () => {
    const { store } = createMemoryStore();
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    const saved = await captureInbox.create("account-1", {
      attachment: { id: "staging-1", name: "screenshot.png" },
      content: "Remember the original source",
      link: "https://example.com/source",
      origin: { kind: "Web Capture", url: "https://example.com/source" },
    });

    expect(saved).toMatchObject({
      attachment: { id: "staging-1", name: "screenshot.png" },
      link: "https://example.com/source",
      origin: { kind: "Web Capture", url: "https://example.com/source" },
    });
  });

  test("accepts only HTTP(S) provenance links", async () => {
    const { store } = createMemoryStore();
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      captureInbox.create("account-1", {
        content: "Unsafe link",
        link: "javascript:alert(1)",
      }),
    ).rejects.toThrow();
    await expect(
      captureInbox.create("account-1", {
        content: "Safe link",
        link: "https://example.com/source",
      }),
    ).resolves.toMatchObject({ link: "https://example.com/source" });
  });

  test("keeps every mini-template field optional and closed to its catalog", async () => {
    const { store } = createMemoryStore();
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      captureInbox.create("account-1", {
        content: "",
        fields: { "Observed Behavior": "Only this field is known" },
        template: "Bug Capture",
      }),
    ).resolves.toMatchObject({
      fields: { "Observed Behavior": "Only this field is known" },
      template: "Bug Capture",
    });
    await expect(
      captureInbox.create("account-1", {
        content: "Customer quote",
        template: "Feedback Capture",
      }),
    ).resolves.toMatchObject({ fields: {}, template: "Feedback Capture" });
    await expect(
      captureInbox.create("account-1", {
        content: "A paper to revisit",
        fields: { "Source Context": "Search notes" },
        template: "Research Fragment",
      }),
    ).resolves.toMatchObject({
      fields: { "Source Context": "Search notes" },
      template: "Research Fragment",
    });

    expect(CAPTURE_TEMPLATE_FIELD_LABELS).toEqual({
      "Bug Capture": [
        "Observed Behavior",
        "Expected Behavior",
        "Reproduction Context",
      ],
      "Feedback Capture": ["Feedback", "Channel", "Contact"],
      "Research Fragment": ["Note or Excerpt", "Source Context"],
    });
    await expect(
      captureInbox.create("account-1", {
        content: "Wrong field",
        fields: { Channel: "email" },
        template: "Bug Capture",
      }),
    ).rejects.toMatchObject({ code: "UNKNOWN_CAPTURE_FIELD" });
  });

  test("keeps Project captures grouped and does not delete them as time advances", async () => {
    const { store } = createMemoryStore([
      {
        content: "Old project note",
        createdAt: "2020-01-01T00:00:00.000Z",
        fields: {},
        id: "capture-old",
        projectId: "cantiara",
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    const inbox = await captureInbox.list("account-1");

    expect(inbox.items).toHaveLength(1);
    expect(inbox.groups[0]).toMatchObject({
      itemIds: ["capture-old"],
      kind: "project",
      label: "Project Capture Inbox",
      projectId: "cantiara",
    });
  });

  test("does not expose one account's captures to another account", async () => {
    const { store } = createMemoryStore([
      {
        content: "Private workspace thought",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-private",
        projectId: null,
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(captureInbox.list("account-2")).resolves.toEqual({
      bulkSenseMaking: emptyBulkSenseMaking(),
      groups: [],
      items: [],
      triageAvailable: false,
    });
  });

  test("groups Project captures without requiring matching capitalization", async () => {
    const { store } = createMemoryStore([
      {
        content: "First project note",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-first",
        projectId: "Cantiara",
        template: null,
      },
      {
        content: "Second project note",
        createdAt: "2026-09-16T09:01:00.000Z",
        fields: {},
        id: "capture-second",
        projectId: "cantiara",
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    const inbox = await captureInbox.list("account-1");

    expect(inbox.groups).toHaveLength(1);
    expect(inbox.groups[0]?.items).toHaveLength(2);
  });

  test("persists Bulk sense-making clusters as view metadata across Inbox instances", async () => {
    const captures: CaptureInboxItem[] = [
      {
        content: "First thought",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-first",
        projectId: null,
        template: null,
      },
      {
        content: "Second thought",
        createdAt: "2026-09-16T09:01:00.000Z",
        fields: {},
        id: "capture-second",
        projectId: null,
        template: null,
      },
    ];
    const bulkSenseMaking = createMemoryBulkSenseMakingStore();
    const first = createCaptureInbox({
      store: createMemoryStore(captures, bulkSenseMaking).store,
      workCreate: { createBug: vi.fn() },
    });

    const saved = await first.updateBulkSenseMaking("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "bulk-layout-1",
      clusters: [{ id: "cluster-ideas", name: "Ideas", position: 0 }],
      placements: [
        { clusterId: "cluster-ideas", itemId: "capture-first", position: 0 },
        { clusterId: null, itemId: "capture-second", position: 0 },
      ],
    });

    expect(saved).toEqual({
      clusters: [{ id: "cluster-ideas", name: "Ideas", position: 0 }],
      placements: [
        { clusterId: "cluster-ideas", itemId: "capture-first", position: 0 },
        { clusterId: null, itemId: "capture-second", position: 0 },
      ],
      revision: 1,
    });

    const second = createCaptureInbox({
      store: createMemoryStore(captures, bulkSenseMaking).store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(second.list("account-1")).resolves.toMatchObject({
      bulkSenseMaking: saved,
    });
    expect((await second.list("account-1")).items[0]).not.toHaveProperty(
      "clusterId",
    );
  });

  test("rejects stale or unresolved Bulk sense-making placements", async () => {
    const { store } = createMemoryStore([
      {
        content: "Current thought",
        createdAt: "2026-09-16T09:00:00.000Z",
        fields: {},
        id: "capture-current",
        projectId: null,
        template: null,
      },
    ]);
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      captureInbox.updateBulkSenseMaking("account-1", {
        baseRevision: 0,
        clientIdempotencyKey: "bulk-invalid-cluster",
        clusters: [{ id: "cluster-ideas", name: "Ideas", position: 0 }],
        placements: [
          {
            clusterId: "cluster-unknown",
            itemId: "capture-current",
            position: 0,
          },
        ],
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_BULK_CLUSTER_INVALID" });

    await expect(
      captureInbox.updateBulkSenseMaking("account-1", {
        baseRevision: 0,
        clientIdempotencyKey: "bulk-invalid-item",
        clusters: [],
        placements: [
          { clusterId: null, itemId: "capture-resolved", position: 0 },
        ],
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_BULK_ITEM_NOT_FOUND" });

    await captureInbox.updateBulkSenseMaking("account-1", {
      baseRevision: 0,
      clientIdempotencyKey: "bulk-valid-layout",
      clusters: [],
      placements: [],
    });
    await expect(
      captureInbox.updateBulkSenseMaking("account-1", {
        baseRevision: 0,
        clientIdempotencyKey: "bulk-stale-layout",
        clusters: [],
        placements: [],
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_BULK_VIEW_CONFLICT" });
  });

  test("removes a resolved item's Bulk placement and empty cluster", async () => {
    const capture: CaptureInboxItem = {
      content: "Resolve this thought",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: {},
      id: "capture-resolve",
      projectId: null,
      template: null,
    };
    const bulkSenseMaking = createMemoryBulkSenseMakingStore({
      clusters: [{ id: "cluster-resolve", name: "Resolve", position: 0 }],
      placements: [
        { clusterId: "cluster-resolve", itemId: capture.id, position: 0 },
      ],
      revision: 1,
    });
    const { store } = createTriageMemoryStore(
      [capture],
      createMemoryOperationStateStore(),
      bulkSenseMaking,
    );
    const captureInbox = createCaptureInbox({
      store,
      triageAdapter: createTriageAdapter(),
      workCreate: { createBug: vi.fn() },
    });
    const preview = await captureInbox.previewConvert("account-1", {
      itemId: capture.id,
      recordType: "Work",
    });

    await captureInbox.convert("account-1", {
      clientIdempotencyKey: "resolve-bulk-item",
      itemId: capture.id,
      previewId: preview.previewId,
    });

    await expect(captureInbox.list("account-1")).resolves.toMatchObject({
      bulkSenseMaking: { clusters: [], placements: [] },
      items: [],
    });
  });

  test("calls Work create directly for an eligible Create Bug without leaving an Inbox item", async () => {
    const { items, store } = createMemoryStore();
    const createBug = vi.fn().mockResolvedValue({ workId: "work-1" });
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug },
    });

    const result = await captureInbox.createBug("account-1", {
      content: "Preview is blank after refresh",
      fields: { "Observed Behavior": "Blank screen" },
      projectId: "project-1",
      template: "Bug Capture",
    });

    expect(result).toEqual({ workId: "work-1" });
    expect(createBug).toHaveBeenCalledWith({
      accountId: "account-1",
      content: "Preview is blank after refresh",
      fields: { "Observed Behavior": "Blank screen" },
      projectId: "project-1",
      template: "Bug Capture",
    });
    expect(items).toEqual([]);
  });

  test("calls Work create directly when a Project is set without a template", async () => {
    const { items, store } = createMemoryStore();
    const createBug = vi.fn().mockResolvedValue({ workId: "work-2" });
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug },
    });

    await captureInbox.createBug("account-1", {
      content: "Project-specific bug without a chosen type",
      projectId: "project-1",
    });

    expect(createBug).toHaveBeenCalledWith({
      accountId: "account-1",
      content: "Project-specific bug without a chosen type",
      fields: {},
      projectId: "project-1",
      template: null,
    });
    expect(items).toEqual([]);
  });

  test("refuses Create Bug when Project or type is not eligible", async () => {
    const { items, store } = createMemoryStore();
    const createBug = vi.fn();
    const captureInbox = createCaptureInbox({
      store,
      workCreate: { createBug },
    });

    await expect(
      captureInbox.createBug("account-1", {
        content: "No project yet",
      }),
    ).rejects.toMatchObject({ code: "PROJECT_REQUIRED_FOR_CREATE_BUG" });
    await expect(
      captureInbox.createBug("account-1", {
        content: "Feedback is not a Bug",
        projectId: "project-1",
        template: "Feedback Capture",
      }),
    ).rejects.toMatchObject({ code: "CREATE_BUG_TEMPLATE_UNSUPPORTED" });

    expect(createBug).not.toHaveBeenCalled();
    expect(items).toEqual([]);
  });

  test("exposes exactly three explicit exits and consumes a capture on each exit", async () => {
    expect(CAPTURE_TRIAGE_EXITS).toEqual(["convert", "attach", "delete"]);

    const convertedCapture: CaptureInboxItem = {
      attachment: { id: "staging-1", name: "screenshot.png" },
      content: "The preview is blank",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: { "Observed Behavior": "Blank" },
      id: "capture-convert",
      link: "https://example.com/issue",
      origin: { kind: "Web Capture", url: "https://example.com/issue" },
      projectId: "project-1",
      template: "Bug Capture",
    };
    const convertedStore = createTriageMemoryStore(
      [convertedCapture],
      createMemoryOperationStateStore(),
      createMemoryBulkSenseMakingStore({
        clusters: [{ id: "cluster-convert", name: "Convert", position: 0 }],
        placements: [
          {
            clusterId: "cluster-convert",
            itemId: convertedCapture.id,
            position: 0,
          },
        ],
        revision: 1,
      }),
    );
    const convertedAdapter = createTriageAdapter();
    const convertedInbox = createCaptureInbox({
      store: convertedStore.store,
      triageAdapter: convertedAdapter,
      workCreate: { createBug: vi.fn() },
    });
    const conversionPreview = await convertedInbox.previewConvert("account-1", {
      itemId: convertedCapture.id,
      recordType: "Work",
    });

    expect(convertedAdapter.createRecord).not.toHaveBeenCalled();
    expect(conversionPreview.source).toMatchObject({
      attachment: convertedCapture.attachment,
      content: convertedCapture.content,
      link: convertedCapture.link,
      origin: convertedCapture.origin,
    });
    expect(conversionPreview.fieldMappings).toEqual([
      {
        sourceField: "Observed Behavior",
        targetField: "Observed Behavior",
        value: "Blank",
      },
    ]);
    expect(conversionPreview.proposedRelations).toEqual([
      { relation: "Origin", target: "Proposed record" },
    ]);

    await expect(
      convertedInbox.convert("account-1", {
        clientIdempotencyKey: "convert-1",
        itemId: convertedCapture.id,
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_PREVIEW_REQUIRED" });

    await expect(
      convertedInbox.convert("account-1", {
        clientIdempotencyKey: "convert-1",
        itemId: convertedCapture.id,
        previewId: conversionPreview.previewId,
      }),
    ).resolves.toMatchObject({
      consumed: true,
      exit: "convert",
      itemId: convertedCapture.id,
      recordId: "record-1",
    });
    expect(await convertedInbox.list("account-1")).toMatchObject({
      bulkSenseMaking: { clusters: [], placements: [] },
      groups: [],
      items: [],
    });

    const attachedCapture: CaptureInboxItem = {
      content: "Attach this evidence",
      createdAt: "2026-09-16T09:01:00.000Z",
      fields: {},
      id: "capture-attach",
      projectId: "project-1",
      template: null,
    };
    const attachedStore = createTriageMemoryStore(
      [attachedCapture],
      createMemoryOperationStateStore(),
      createMemoryBulkSenseMakingStore({
        clusters: [{ id: "cluster-attach", name: "Attach", position: 0 }],
        placements: [
          {
            clusterId: "cluster-attach",
            itemId: attachedCapture.id,
            position: 0,
          },
        ],
        revision: 1,
      }),
    );
    const attachedAdapter = createTriageAdapter();
    const attachedInbox = createCaptureInbox({
      store: attachedStore.store,
      triageAdapter: attachedAdapter,
      workCreate: { createBug: vi.fn() },
    });
    const attachPreview = await attachedInbox.previewAttachToExisting(
      "account-1",
      {
        itemId: attachedCapture.id,
        relation: "Evidence",
        targetId: "record-1",
      },
    );

    expect(attachPreview.relationPreview).toMatchObject({
      relation: "Evidence",
      targetId: "record-1",
    });
    await expect(
      attachedInbox.attachToExisting("account-1", {
        clientIdempotencyKey: "attach-1",
        itemId: attachedCapture.id,
        relation: "Evidence",
        targetId: "record-1",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_PREVIEW_REQUIRED" });
    await expect(
      attachedInbox.attachToExisting("account-1", {
        clientIdempotencyKey: "attach-1",
        itemId: attachedCapture.id,
        previewId: attachPreview.previewId,
        relation: "Evidence",
        targetId: "record-1",
      }),
    ).resolves.toMatchObject({
      consumed: true,
      exit: "attach",
      itemId: attachedCapture.id,
      relation: "Evidence",
      targetId: "record-1",
    });
    expect(await attachedInbox.list("account-1")).toMatchObject({
      bulkSenseMaking: { clusters: [], placements: [] },
      groups: [],
      items: [],
    });

    const deletedCapture: CaptureInboxItem = {
      content: "Discard this",
      createdAt: "2026-09-16T09:02:00.000Z",
      fields: {},
      id: "capture-delete",
      projectId: null,
      template: null,
    };
    const deletedStore = createTriageMemoryStore(
      [deletedCapture],
      createMemoryOperationStateStore(),
      createMemoryBulkSenseMakingStore({
        clusters: [{ id: "cluster-delete", name: "Delete", position: 0 }],
        placements: [
          {
            clusterId: "cluster-delete",
            itemId: deletedCapture.id,
            position: 0,
          },
        ],
        revision: 1,
      }),
    );
    const deletedInbox = createCaptureInbox({
      store: deletedStore.store,
      triageAdapter: createTriageAdapter(),
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      deletedInbox.delete("account-1", {
        clientIdempotencyKey: "delete-1",
        itemId: deletedCapture.id,
      }),
    ).resolves.toEqual({
      consumed: true,
      exit: "delete",
      itemId: deletedCapture.id,
    });
    expect(await deletedInbox.list("account-1")).toMatchObject({
      bulkSenseMaking: { clusters: [], placements: [] },
      groups: [],
      items: [],
    });
  });

  test("shows suggestion basis and separates other Projects without auto-binding", async () => {
    const capture: CaptureInboxItem = {
      content: "Possible duplicate",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: {},
      id: "capture-suggest",
      projectId: "project-1",
      template: null,
    };
    const adapter = createTriageAdapter();
    const { store } = createTriageMemoryStore([capture]);
    const captureInbox = createCaptureInbox({
      store,
      triageAdapter: adapter,
      workCreate: { createBug: vi.fn() },
    });

    const suggestions = await captureInbox.suggestions("account-1", capture.id);

    expect(suggestions.sameProject.items).toMatchObject([
      { basis: ["title", "content"], id: "record-1" },
    ]);
    expect(suggestions.otherProjects).toMatchObject([
      {
        items: [{ id: "record-2", projectName: "Other Project" }],
        label: "Other Projects",
      },
    ]);
    expect(adapter.attachToExisting).not.toHaveBeenCalled();
  });

  test("requires a relation preview before a cross-Project bind", async () => {
    const capture: CaptureInboxItem = {
      content: "Cross-Project evidence",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: {},
      id: "capture-cross-project",
      projectId: "project-1",
      template: null,
    };
    const adapter = createTriageAdapter({
      findRecord: vi.fn().mockResolvedValue({
        fields: {},
        id: "record-other",
        projectId: "project-2",
        projectName: "Other Project",
        recordType: "Work",
        revision: 3,
        title: "Other project record",
      }),
    });
    const { store } = createTriageMemoryStore([capture]);
    const captureInbox = createCaptureInbox({
      store,
      triageAdapter: adapter,
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      captureInbox.attachToExisting("account-1", {
        clientIdempotencyKey: "cross-project-attach",
        itemId: capture.id,
        relation: "Origin",
        targetId: "record-other",
      }),
    ).rejects.toMatchObject({ code: "CAPTURE_PREVIEW_REQUIRED" });

    const preview = await captureInbox.previewAttachToExisting("account-1", {
      itemId: capture.id,
      relation: "Origin",
      targetId: "record-other",
    });
    expect(preview).toMatchObject({
      crossProject: true,
      targetProject: { id: "project-2", name: "Other Project" },
    });
  });

  test("restores a capture when conversion cannot finalize", async () => {
    const capture: CaptureInboxItem = {
      content: "Retry this conversion",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: {},
      id: "capture-retry",
      projectId: "project-1",
      template: null,
    };
    const { store } = createTriageMemoryStore([capture]);
    const adapter = createTriageAdapter({
      createRecord: vi
        .fn()
        .mockRejectedValue(new Error("target feature unavailable")),
    });
    const captureInbox = createCaptureInbox({
      store,
      triageAdapter: adapter,
      workCreate: { createBug: vi.fn() },
    });
    const preview = await captureInbox.previewConvert("account-1", {
      itemId: capture.id,
      recordType: "Work",
    });

    await expect(
      captureInbox.convert("account-1", {
        clientIdempotencyKey: "convert-retry",
        itemId: capture.id,
        previewId: preview.previewId,
      }),
    ).rejects.toThrow("target feature unavailable");
    await expect(captureInbox.list("account-1")).resolves.toMatchObject({
      items: [capture],
    });
  });

  test("restores the original Inbox item on merge Undo and delegates only attributed changes", async () => {
    const original: CaptureInboxItem = {
      attachment: { id: "staging-merge", name: "screen.png" },
      content: "Original capture text",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: { Note: "Original field" },
      id: "capture-merge",
      link: "https://example.com/original",
      origin: { kind: "Web Capture", url: "https://example.com/original" },
      projectId: "project-1",
      template: "Feedback Capture",
    };
    const adapter = createTriageAdapter();
    const { store } = createTriageMemoryStore([original]);
    const captureInbox = createCaptureInbox({
      store,
      triageAdapter: adapter,
      workCreate: { createBug: vi.fn() },
    });
    const attachPreview = await captureInbox.previewAttachToExisting(
      "account-1",
      {
        itemId: original.id,
        relation: "Origin",
        targetId: "record-1",
      },
    );
    const attached = await captureInbox.attachToExisting("account-1", {
      clientIdempotencyKey: "merge-attach",
      itemId: original.id,
      previewId: attachPreview.previewId,
      relation: "Origin",
      targetId: "record-1",
    });

    const undoPreview = await captureInbox.previewUndoMerge("account-1", {
      mergeId: attached.mergeId,
    });
    expect(undoPreview.restore).toMatchObject({
      attachment: original.attachment,
      content: original.content,
      createdAt: original.createdAt,
      fields: original.fields,
      link: original.link,
      origin: original.origin,
    });
    expect(undoPreview.removeFromTarget).toMatchObject({
      attributedRelationIds: ["relation-1"],
      attributedValueKeys: ["description"],
    });

    await captureInbox.undoMerge("account-1", {
      clientIdempotencyKey: "merge-undo",
      mergeId: attached.mergeId,
      previewId: undoPreview.previewId,
    });

    expect(adapter.undoMerge).toHaveBeenCalledWith(
      expect.objectContaining({
        attributedRelationIds: ["relation-1"],
        attributedValueKeys: ["description"],
        mergeId: "merge-1",
      }),
    );
    await expect(captureInbox.list("account-1")).resolves.toMatchObject({
      items: [original],
    });
  });

  test("replays preview and receipt state across Capture Inbox instances", async () => {
    const capture: CaptureInboxItem = {
      content: "Retry across workers",
      createdAt: "2026-09-16T09:00:00.000Z",
      fields: {},
      id: "capture-durable-state",
      projectId: null,
      template: null,
    };
    const adapter = createTriageAdapter();
    const { operationState, store } = createTriageMemoryStore([capture]);
    const firstInbox = createCaptureInbox({
      store,
      triageAdapter: adapter,
      workCreate: { createBug: vi.fn() },
    });
    const preview = await firstInbox.previewConvert("account-1", {
      itemId: capture.id,
      recordType: "Work",
    });
    const secondInbox = createCaptureInbox({
      store: { ...store, operationState },
      triageAdapter: adapter,
      workCreate: { createBug: vi.fn() },
    });

    await expect(
      secondInbox.convert("account-1", {
        clientIdempotencyKey: "durable-convert",
        itemId: capture.id,
        previewId: preview.previewId,
      }),
    ).resolves.toMatchObject({ recordId: "record-1" });
    await expect(
      firstInbox.convert("account-1", {
        clientIdempotencyKey: "durable-convert",
        itemId: capture.id,
        previewId: preview.previewId,
      }),
    ).resolves.toMatchObject({ recordId: "record-1" });
    expect(adapter.createRecord).toHaveBeenCalledTimes(1);
  });
});
