import {
  applyTagInputSchema,
  createTagInputSchema,
  removeTagInputSchema,
  type TagStore,
  type TagsAccess,
  tagRecordsInputSchema,
  tagsInputSchema,
} from "@cantiara/api/tags";

export class TagNameConflictError extends Error {
  readonly code = "TAG_NAME_CONFLICT" as const;

  constructor(name: string) {
    super(`A Tag named ${name} already exists in this Workspace.`);
    this.name = "TagNameConflictError";
  }
}

export class TagProjectNotFoundError extends Error {
  readonly code = "TAG_PROJECT_NOT_FOUND" as const;

  constructor(projectId: string) {
    super(`Project ${projectId} was not found.`);
    this.name = "TagProjectNotFoundError";
  }
}

export class TagNotFoundError extends Error {
  readonly code = "TAG_NOT_FOUND" as const;

  constructor(tagId: string) {
    super(`Tag ${tagId} was not found.`);
    this.name = "TagNotFoundError";
  }
}

export class TagRecordNotFoundError extends Error {
  readonly code = "TAG_RECORD_NOT_FOUND" as const;

  constructor(recordId: string) {
    super(`Record ${recordId} was not found.`);
    this.name = "TagRecordNotFoundError";
  }
}

async function workspaceIdFor(store: TagStore, accountId: string) {
  const workspaceId = await store.findWorkspaceId(accountId);
  if (!workspaceId) {
    throw new TagProjectNotFoundError("unknown");
  }
  return workspaceId;
}

export function createTags({ store }: { store: TagStore }): TagsAccess {
  return {
    async apply(accountId, input) {
      const parsed = applyTagInputSchema.parse(input);
      const workspaceId = await workspaceIdFor(store, accountId);
      return store.apply(workspaceId, parsed);
    },

    async create(accountId, input) {
      const parsed = createTagInputSchema.parse(input);
      const workspaceId = await workspaceIdFor(store, accountId);
      return store.create(workspaceId, parsed);
    },

    async list(accountId, projectId) {
      const parsed = tagsInputSchema.parse({ projectId });
      const workspaceId = await store.findWorkspaceId(accountId);
      if (!workspaceId) {
        return null;
      }
      const suggestions = await store.list(workspaceId, parsed.projectId);
      return suggestions
        ? [...suggestions].sort(
            (left, right) =>
              right.projectUsageCount - left.projectUsageCount ||
              left.tag.name.localeCompare(right.tag.name, "en-US") ||
              left.tag.createdAt.localeCompare(right.tag.createdAt),
          )
        : null;
    },

    async records(accountId, input) {
      const parsed = tagRecordsInputSchema.parse(input);
      const workspaceId = await store.findWorkspaceId(accountId);
      if (!workspaceId) {
        return null;
      }
      return store.listRecords(workspaceId, parsed);
    },

    async remove(accountId, input) {
      const parsed = removeTagInputSchema.parse(input);
      const workspaceId = await workspaceIdFor(store, accountId);
      return store.remove(workspaceId, parsed);
    },
  };
}
