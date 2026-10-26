import type {
  RecordLookup,
  RecordLookupKind,
  ScreenLookup,
  UserFlowBindRecord,
  UserFlowDocument,
  UserFlowRecord,
  UserFlowStore,
  UserFlowTemplateView,
  UserFlowViewport,
} from "@cantiara/api/user-flow";
import { recordLookupKey } from "@cantiara/api/user-flow";

import { UserFlowVersionConflictError } from "../user-flow";

export const ACCOUNT = "account-1";
export const PROJECT = "project-1";
/** A second Project of the same Workspace: templates cross between them. */
export const PROJECT_B = "project-2";
export const timestamp = "2026-10-01T09:00:00.000Z";

const PROJECT_NAMES = new Map([
  [PROJECT, "Cantiara"],
  [PROJECT_B, "Second Project"],
]);

interface MemoryScreen {
  archivedAt: string | null;
  id: string;
  projectId: string;
  redactedAt: string | null;
  title: string;
  trashedAt: string | null;
}

interface MemoryRecord {
  archived: boolean;
  projectId: string;
  status: string | null;
  title: string;
}

/** What `Convert and Bind` wrote into the owning record stores. */
export interface CreatedRecord {
  body: string;
  id: string;
  /** Origin Location the record carries; null for records without origin columns. */
  origin: { componentId: string; ownerRecordId: string; sourceVersion: string };
  title: string;
  type: string;
  workType: string | null;
}

/**
 * In-memory store. It records every call (`calls`) and every write
 * (`writes`, `recordWrites`) so the seam's reach is observable: reads of
 * Work/Decision/Risk records are `lookupRecords` only, and no code path of the
 * store writes an existing source record.
 */
export function createMemoryStore() {
  const flows = new Map<string, UserFlowRecord>();
  const history = new Map<string, UserFlowDocument>();
  const versions: Array<{ flowId: string; version: number }> = [];
  const screens = new Map<string, MemoryScreen>();
  const foreignScreens = new Set<string>();
  const records = new Map<string, MemoryRecord>();
  const created: CreatedRecord[] = [];
  const binds = new Map<string, UserFlowBindRecord>();
  const rebinds: Array<{ bindId: string; from: number; to: number }> = [];
  const templates = new Map<string, UserFlowTemplateView>();
  const viewports = new Map<string, UserFlowViewport>();
  const writes: string[] = [];
  const recordWrites: string[] = [];
  const calls: string[] = [];

  function keep(record: UserFlowRecord) {
    flows.set(record.id, record);
    history.set(`${record.id}:${record.version}`, record.document);
    versions.push({ flowId: record.id, version: record.version });
  }

  const store: UserFlowStore = {
    appendVersion: async (accountId, input) => {
      calls.push("appendVersion");
      await Promise.resolve();
      const current = flows.get(input.userFlowId);
      if (
        !current ||
        accountId !== ACCOUNT ||
        current.projectId !== input.projectId
      ) {
        return null;
      }
      if (current.version !== input.expectedVersion) {
        throw new UserFlowVersionConflictError(current.id);
      }
      const next: UserFlowRecord = {
        ...current,
        document: input.document,
        updatedAt: timestamp,
        version: current.version + 1,
      };
      keep(next);
      writes.push("appendVersion");
      return next;
    },
    convertNode: async (accountId, input) => {
      calls.push("convertNode");
      await Promise.resolve();
      const flow = flows.get(input.userFlowId);
      if (!flow || accountId !== ACCOUNT) {
        return null;
      }
      const existing = binds.get(input.id);
      if (existing) {
        return existing;
      }
      const { plan } = input;
      created.push({
        body: plan.record.body,
        id: input.recordId,
        origin: {
          componentId: plan.originLocation.nodeId,
          ownerRecordId: plan.originLocation.userFlowId,
          sourceVersion: String(plan.originLocation.flowVersion),
        },
        title: plan.record.title,
        type: plan.record.type,
        workType: plan.record.workType,
      });
      records.set(recordLookupKey(plan.record.type, input.recordId), {
        archived: false,
        projectId: flow.projectId,
        status: null,
        title: plan.record.title,
      });
      writes.push(`createRecord:${plan.record.type}`);
      recordWrites.push(`createRecord:${plan.record.type}`);
      const bind: UserFlowBindRecord = {
        boundVersion: plan.originLocation.flowVersion,
        createdAt: timestamp,
        id: input.id,
        nodeId: plan.nodeId,
        originVersion: plan.originLocation.flowVersion,
        recordId: input.recordId,
        recordType: plan.record.type,
        revision: 1,
        updatedAt: timestamp,
        userFlowId: flow.id,
      };
      binds.set(bind.id, bind);
      return bind;
    },
    create: async (accountId, input) => {
      calls.push("create");
      await Promise.resolve();
      if (accountId !== ACCOUNT || !PROJECT_NAMES.has(input.projectId)) {
        return null;
      }
      const record: UserFlowRecord = {
        createdAt: timestamp,
        document: input.document,
        id: input.id,
        projectId: input.projectId,
        title: input.title,
        updatedAt: timestamp,
        version: 1,
      };
      keep(record);
      writes.push("create");
      return record;
    },
    createScreen: async (accountId, input) => {
      calls.push("createScreen");
      await Promise.resolve();
      if (accountId !== ACCOUNT || !PROJECT_NAMES.has(input.projectId)) {
        return null;
      }
      screens.set(input.id, {
        archivedAt: null,
        id: input.id,
        projectId: input.projectId,
        redactedAt: null,
        title: input.title,
        trashedAt: null,
      });
      writes.push("createScreen");
      return { id: input.id, title: input.title };
    },
    createTemplate: async (accountId, input) => {
      calls.push("createTemplate");
      await Promise.resolve();
      if (accountId !== ACCOUNT || !PROJECT_NAMES.has(input.projectId)) {
        return null;
      }
      const template: UserFlowTemplateView = {
        createdAt: timestamp,
        id: input.id,
        name: input.name,
        structure: input.structure,
      };
      templates.set(template.id, template);
      writes.push("createTemplate");
      return template;
    },
    find: async (accountId, projectId, userFlowId) => {
      calls.push("find");
      await Promise.resolve();
      const record = flows.get(userFlowId);
      return record && accountId === ACCOUNT && record.projectId === projectId
        ? record
        : null;
    },
    findViewport: async (accountId, userFlowId) => {
      calls.push("findViewport");
      await Promise.resolve();
      return viewports.get(`${accountId}:${userFlowId}`) ?? null;
    },
    saveViewport: async (accountId, userFlowId, viewport) => {
      calls.push("saveViewport");
      await Promise.resolve();
      viewports.set(`${accountId}:${userFlowId}`, viewport);
      writes.push("saveViewport");
    },
    findTemplate: async (accountId, projectId, templateId) => {
      calls.push("findTemplate");
      await Promise.resolve();
      return accountId === ACCOUNT && PROJECT_NAMES.has(projectId)
        ? (templates.get(templateId) ?? null)
        : null;
    },
    findVersion: async (accountId, projectId, userFlowId, version) => {
      calls.push("findVersion");
      await Promise.resolve();
      const flow = flows.get(userFlowId);
      return accountId === ACCOUNT && flow?.projectId === projectId
        ? (history.get(`${userFlowId}:${version}`) ?? null)
        : null;
    },
    list: async (accountId, projectId) => {
      calls.push("list");
      await Promise.resolve();
      return accountId === ACCOUNT && projectId === PROJECT
        ? [...flows.values()].filter((flow) => flow.projectId === projectId)
        : null;
    },
    listBinds: async (accountId, projectId, userFlowId) => {
      calls.push("listBinds");
      await Promise.resolve();
      const flow = flows.get(userFlowId);
      if (accountId !== ACCOUNT || flow?.projectId !== projectId) {
        return null;
      }
      return [...binds.values()].filter((bind) => bind.userFlowId === flow.id);
    },
    listCardRecords: async (accountId, projectId) => {
      calls.push("listCardRecords");
      await Promise.resolve();
      if (accountId !== ACCOUNT || !PROJECT_NAMES.has(projectId)) {
        return null;
      }
      return [...records.entries()]
        .filter(
          ([key, record]) =>
            record.projectId === projectId &&
            !record.archived &&
            ["Work", "Decision", "Risk"].includes(key.split(":")[0] ?? ""),
        )
        .map(([key, record]) => ({
          id: key.split(":")[1] as string,
          kind: key.split(":")[0] as "Decision" | "Risk" | "Work",
          title: record.title,
        }));
    },
    listScreens: async (accountId, projectId) => {
      calls.push("listScreens");
      await Promise.resolve();
      if (accountId !== ACCOUNT || projectId !== PROJECT) {
        return null;
      }
      return [...screens.values()]
        .filter(
          (screen) =>
            screen.projectId === projectId &&
            !(screen.archivedAt || screen.trashedAt || screen.redactedAt),
        )
        .map(({ id, title }) => ({ id, title }));
    },
    listTemplates: async (accountId, projectId) => {
      calls.push("listTemplates");
      await Promise.resolve();
      return accountId === ACCOUNT && PROJECT_NAMES.has(projectId)
        ? [...templates.values()]
        : null;
    },
    lookupRecords: async (_accountId, refs) => {
      calls.push("lookupRecords");
      await Promise.resolve();
      const found = new Map<string, RecordLookup>();
      for (const { id, kind } of refs) {
        const key = recordLookupKey(kind, id);
        const record = records.get(key);
        if (record) {
          found.set(key, { ...record, kind: "found" });
        }
      }
      return found;
    },
    lookupScreens: async (_accountId, screenIds) => {
      calls.push("lookupScreens");
      await Promise.resolve();
      const found = new Map<string, ScreenLookup>();
      for (const id of screenIds) {
        const screen = screens.get(id);
        if (foreignScreens.has(id)) {
          found.set(id, { kind: "inaccessible" });
        } else if (screen) {
          found.set(id, { ...screen, kind: "found" });
        }
      }
      return found;
    },
    readConversionSource: async (accountId, projectId, userFlowId) => {
      calls.push("readConversionSource");
      await Promise.resolve();
      const record = flows.get(userFlowId);
      return record && accountId === ACCOUNT && record.projectId === projectId
        ? { projectName: PROJECT_NAMES.get(projectId) ?? "", record }
        : null;
    },
    rebind: async (accountId, input) => {
      calls.push("rebind");
      await Promise.resolve();
      const bind = binds.get(input.bindId);
      if (!bind || accountId !== ACCOUNT) {
        return null;
      }
      // Only the bound version moves; the Origin Location stays as it was.
      const moved: UserFlowBindRecord = {
        ...bind,
        boundVersion: input.plan.toVersion,
        revision: bind.revision + 1,
        updatedAt: timestamp,
      };
      binds.set(moved.id, moved);
      rebinds.push({
        bindId: bind.id,
        from: bind.boundVersion,
        to: moved.boundVersion,
      });
      writes.push("rebind");
      return moved;
    },
  };
  return {
    addRecord(
      kind: RecordLookupKind,
      id: string,
      title: string,
      patch: Partial<MemoryRecord> = {},
    ) {
      records.set(recordLookupKey(kind, id), {
        archived: false,
        projectId: PROJECT,
        status: null,
        title,
        ...patch,
      });
    },
    addScreen(id: string, title: string, patch: Partial<MemoryScreen> = {}) {
      screens.set(id, {
        archivedAt: null,
        id,
        projectId: PROJECT,
        redactedAt: null,
        title,
        trashedAt: null,
        ...patch,
      });
    },
    binds,
    calls,
    created,
    flows,
    foreignScreens,
    rebinds,
    recordWrites,
    records,
    screens,
    store,
    templates,
    viewports,
    versions,
    writes,
  };
}
