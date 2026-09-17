import type {
  ProjectProfile,
  ProjectShellRecord,
} from "@cantiara/api/project-shell";
import {
  createProjectInputSchema,
  type ParsedCreateProjectInput,
  type ProjectShellAccess,
  type ProjectShellCreateRecord,
  shortCodeSchema,
  suggestProjectShortCode,
} from "@cantiara/api/project-shell";

export type {
  CreateProjectInput,
  ProjectProfile,
  ProjectShellRecord,
} from "@cantiara/api/project-shell";

export class ProjectShortCodeConflictError extends Error {
  readonly code = "SHORT_CODE_CONFLICT" as const;

  constructor(shortCode: string) {
    super(`Short code ${shortCode} is already used in this Workspace.`);
    this.name = "ProjectShortCodeConflictError";
  }
}

export class ProjectShortCodeLockedError extends Error {
  readonly code = "SHORT_CODE_LOCKED" as const;

  constructor() {
    super("Short code is locked after the first Work.");
    this.name = "ProjectShortCodeLockedError";
  }
}

export class ProjectWorkspaceNotFoundError extends Error {
  readonly code = "WORKSPACE_NOT_FOUND" as const;

  constructor(accountId: string) {
    super(`Workspace for Account ${accountId} was not found.`);
    this.name = "ProjectWorkspaceNotFoundError";
  }
}

export interface ProjectShellStore {
  create: (
    workspaceId: string,
    input: ProjectShellCreateRecord,
  ) => Promise<ProjectShellRecord>;
  find: (
    workspaceId: string,
    projectId: string,
  ) => Promise<ProjectShellRecord | null>;
  findWorkspaceId: (accountId: string) => Promise<string | null>;
  list: (workspaceId: string) => Promise<ProjectShellRecord[]>;
  recordFirstWork: (
    workspaceId: string,
    projectId: string,
  ) => Promise<ProjectShellRecord | null>;
  updateShortCode: (
    workspaceId: string,
    projectId: string,
    shortCode: string,
  ) => Promise<ProjectShellRecord | null>;
}

const SUGGESTION_ATTEMPTS = 10_000;

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function suggestionCandidate(base: string, attempt: number) {
  return attempt === 0 ? base : `${base}-${attempt + 1}`;
}

function toProfile(record: ProjectShellRecord): ProjectProfile {
  return {
    createdAt: record.createdAt,
    id: record.id,
    logo: record.logo,
    name: record.name,
    problem: record.problem,
    purpose: record.purpose,
    revision: record.revision,
    scope: record.scope,
    shortCode: record.shortCode,
    shortCodeLocked: record.workCount > 0,
    starterConfiguration: record.starterConfiguration,
    status: record.status,
    targetDate: record.targetDate,
    updatedAt: record.updatedAt,
  };
}

function createRecordInput(
  input: ParsedCreateProjectInput,
  shortCode: string,
): ProjectShellCreateRecord {
  return {
    logo: nullableText(input.logo),
    name: input.name,
    problem: nullableText(input.problem),
    purpose: nullableText(input.purpose),
    scope: nullableText(input.scope),
    shortCode,
    starterConfiguration: input.starterConfiguration,
    status: "Active",
    targetDate: input.targetDate ?? null,
  };
}

async function workspaceIdFor(store: ProjectShellStore, accountId: string) {
  const workspaceId = await store.findWorkspaceId(accountId);
  if (!workspaceId) {
    throw new ProjectWorkspaceNotFoundError(accountId);
  }
  return workspaceId;
}

export function createProjectShell({
  store,
}: {
  store: ProjectShellStore;
}): ProjectShellAccess {
  return {
    async create(accountId, input) {
      const workspaceId = await workspaceIdFor(store, accountId);
      const parsed = createProjectInputSchema.parse(input);
      const explicitShortCode = parsed.shortCode;
      const base = explicitShortCode ?? suggestProjectShortCode(parsed.name);

      for (let attempt = 0; attempt < SUGGESTION_ATTEMPTS; attempt += 1) {
        const shortCode = suggestionCandidate(base, attempt);
        try {
          return toProfile(
            // biome-ignore lint/performance/noAwaitInLoops: Short-code candidates must be attempted in order because each candidate depends on the prior reservation result.
            await store.create(
              workspaceId,
              createRecordInput(parsed, shortCodeSchema.parse(shortCode)),
            ),
          );
        } catch (error) {
          if (
            !(error instanceof ProjectShortCodeConflictError) ||
            explicitShortCode
          ) {
            throw error;
          }
        }
      }

      throw new Error("A unique Short code could not be suggested.");
    },

    async find(accountId, projectId) {
      const workspaceId = await workspaceIdFor(store, accountId);
      const record = await store.find(workspaceId, projectId);
      return record ? toProfile(record) : null;
    },

    async list(accountId) {
      const workspaceId = await workspaceIdFor(store, accountId);
      const records = await store.list(workspaceId);
      return records.map(toProfile);
    },

    async recordFirstWork(accountId, projectId) {
      const workspaceId = await workspaceIdFor(store, accountId);
      const record = await store.recordFirstWork(workspaceId, projectId);
      return record ? toProfile(record) : null;
    },

    async updateShortCode(accountId, projectId, shortCode) {
      const workspaceId = await workspaceIdFor(store, accountId);
      const parsedShortCode = shortCodeSchema.parse(shortCode);
      const record = await store.updateShortCode(
        workspaceId,
        projectId,
        parsedShortCode,
      );
      return record ? toProfile(record) : null;
    },
  };
}
