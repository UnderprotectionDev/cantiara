import {
  type LinkedBlockRecord,
  type ParsedSetScreenLifecycleInput,
  planScreenLifecycle,
  type ScreenRecord,
  type ScreenStore,
  type StoredHeadDocument,
  type StoredWireframe,
} from "@cantiara/api/screens";
import { createEmptyWireframeDocument } from "@cantiara/api/wireframe-document";

import {
  createScreens,
  ScreenLifecycleInvalidError,
  ScreenRevisionConflictError,
} from "./screens";

export const timestamp = "2026-10-01T09:00:00.000Z";
export const accountId = "account-1";

/** In-memory Screens store; Wireframe versions live only inside their Screen record. */
export function createMemoryStore() {
  const records = new Map<string, ScreenRecord>();
  const archived = new Set<string>();
  const trashed = new Set<string>();
  /** Stored Wireframe versions per Screen, oldest first. */
  const stored = new Map<string, StoredWireframe[]>();
  const linkedBlocks = new Map<string, LinkedBlockRecord>();
  /** Markdown sections by `documentId#sectionId`; a missing key is a gone source. */
  const sections = new Map<string, string>();
  let sequence = 0;
  const nextId = (prefix: string) => {
    sequence += 1;
    return `${prefix}-${sequence}`;
  };
  const owns = (account: string, projectId: string) =>
    account === accountId && projectId === "project-1";
  const withLifecycle = (record: ScreenRecord): ScreenRecord => {
    if (trashed.has(record.id)) {
      return { ...record, lifecycle: "In Trash" };
    }
    return {
      ...record,
      lifecycle: archived.has(record.id) ? "Archived" : "Active",
    };
  };
  const store: ScreenStore = {
    attachWireframeVersion: async (account, projectId, screenId, document) => {
      await Promise.resolve();
      const current = records.get(screenId);
      if (
        !(current && owns(account, projectId)) ||
        trashed.has(screenId) ||
        current.projectId !== projectId
      ) {
        return null;
      }
      const versionId = nextId("version");
      stored.set(screenId, [
        ...(stored.get(screenId) ?? []),
        {
          createdAt: timestamp,
          document: document ?? createEmptyWireframeDocument(),
          version: current.wireframeVersions.length + 1,
          versionId,
        },
      ]);
      const next: ScreenRecord = {
        ...current,
        wireframeVersions: [
          ...current.wireframeVersions,
          {
            createdAt: timestamp,
            id: versionId,
            version: current.wireframeVersions.length + 1,
          },
        ],
      };
      records.set(screenId, next);
      return withLifecycle(next);
    },
    applyLinkedBlockChange: async (account, input, updates) => {
      await Promise.resolve();
      const current = linkedBlocks.get(input.definitionId);
      if (!(current && owns(account, input.projectId))) {
        return null;
      }
      const next = {
        ...current,
        content: input.content,
        revision: current.revision + 1,
      };
      linkedBlocks.set(next.id, next);
      for (const update of updates) {
        const versions = stored.get(update.screenId) ?? [];
        stored.set(update.screenId, [
          ...versions,
          {
            createdAt: timestamp,
            document: update.document,
            version: versions.length + 1,
            versionId: nextId("version"),
          },
        ]);
      }
      return next;
    },
    createLinkedBlock: async (account, input) => {
      await Promise.resolve();
      if (!owns(account, input.projectId)) {
        return null;
      }
      const record: LinkedBlockRecord = {
        content: input.content,
        id: nextId("linked"),
        name: input.name,
        projectId: input.projectId,
        revision: 1,
      };
      linkedBlocks.set(record.id, record);
      return record;
    },
    findLinkedBlock: async (account, projectId, definitionId) => {
      await Promise.resolve();
      const record = linkedBlocks.get(definitionId);
      return record && owns(account, projectId) ? record : null;
    },
    findWireframe: async (account, projectId, screenId, version) => {
      await Promise.resolve();
      const current = records.get(screenId);
      if (!(current && owns(account, projectId)) || trashed.has(screenId)) {
        return null;
      }
      const versions = stored.get(screenId) ?? [];
      return (
        (version === undefined
          ? versions.at(-1)
          : versions.find((item) => item.version === version)) ?? null
      );
    },
    headDocuments: async (account, projectId) => {
      await Promise.resolve();
      if (!owns(account, projectId)) {
        return null;
      }
      return [...records.values()].flatMap((record): StoredHeadDocument[] => {
        const head = stored.get(record.id)?.at(-1);
        return head
          ? [
              {
                document: head.document,
                lifecycle: withLifecycle(record).lifecycle,
                screenId: record.id,
                title: record.title,
              },
            ]
          : [];
      });
    },
    listLinkedBlocks: async (account, projectId) => {
      await Promise.resolve();
      return owns(account, projectId) ? [...linkedBlocks.values()] : null;
    },
    readLiveSections: async (_account, sources) => {
      await Promise.resolve();
      return sources.map(({ documentId, sectionId }) => ({
        documentId,
        sectionId,
        text: sections.get(`${documentId}#${sectionId}`) ?? null,
      }));
    },
    saveWireframe: async (account, projectId, screenId, document) => {
      await Promise.resolve();
      const current = records.get(screenId);
      if (!(current && owns(account, projectId)) || trashed.has(screenId)) {
        return null;
      }
      const versions = stored.get(screenId) ?? [];
      const head = versions.at(-1);
      if (head) {
        const next = { ...head, document };
        stored.set(screenId, [...versions.slice(0, -1), next]);
        return next;
      }
      const first: StoredWireframe = {
        createdAt: timestamp,
        document,
        version: 1,
        versionId: nextId("version"),
      };
      stored.set(screenId, [first]);
      records.set(screenId, {
        ...current,
        wireframeVersions: [
          { createdAt: timestamp, id: first.versionId, version: 1 },
        ],
      });
      return first;
    },
    create: async (account, input) => {
      await Promise.resolve();
      if (!owns(account, input.projectId)) {
        return null;
      }
      const record: ScreenRecord = {
        createdAt: timestamp,
        id: nextId("screen"),
        lifecycle: "Active",
        projectId: input.projectId,
        revision: 1,
        title: input.title,
        updatedAt: timestamp,
        wireframeVersions: [],
      };
      records.set(record.id, record);
      return record;
    },
    find: async (account, projectId, screenId) => {
      await Promise.resolve();
      const record = records.get(screenId);
      return record &&
        owns(account, projectId) &&
        record.projectId === projectId
        ? withLifecycle(record)
        : null;
    },
    list: async (account, projectId) => {
      await Promise.resolve();
      return owns(account, projectId)
        ? {
            readOnly: false,
            screens: [...records.values()].map(withLifecycle),
          }
        : null;
    },
    setLifecycle: async (account, input: ParsedSetScreenLifecycleInput) => {
      await Promise.resolve();
      const current = records.get(input.screenId);
      if (!(current && owns(account, input.projectId))) {
        return null;
      }
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== current.revision
      ) {
        throw new ScreenRevisionConflictError(current.id);
      }
      const plan = planScreenLifecycle(
        {
          archived: archived.has(current.id),
          trashed: trashed.has(current.id),
        },
        input.action,
      );
      if (!plan) {
        throw new ScreenLifecycleInvalidError(current.id, input.action);
      }
      if (plan.changed) {
        archived[plan.archived ? "add" : "delete"](current.id);
        trashed[plan.trashed ? "add" : "delete"](current.id);
        records.set(current.id, { ...current, revision: current.revision + 1 });
      }
      return withLifecycle(records.get(current.id) ?? current);
    },
  };
  return { screens: createScreens(store), sections, stored, store };
}
