import type {
  ParsedRenameTagInput,
  TagRecord,
  TagStore,
  TagSuggestion,
} from "@cantiara/api/tags";
import { describe, expect, test } from "vitest";

import {
  createTags,
  TagNameConflictError,
  TagWorkspaceNotFoundError,
} from "./tags";

const timestamp = "2026-09-20T09:00:00.000Z";

function createMemoryStore() {
  const tags = new Map<string, TagSuggestion["tag"]>();
  const records = new Map<string, TagRecord>([
    [
      "work-1",
      {
        archivedAt: null,
        id: "work-1",
        key: "PAY-1",
        projectId: "project-1",
        recordType: "Work",
        tags: [],
        title: "Prepare launch",
      },
    ],
    [
      "work-2",
      {
        archivedAt: null,
        id: "work-2",
        key: "PAY-2",
        projectId: "project-1",
        recordType: "Work",
        tags: [],
        title: "Review launch",
      },
    ],
  ]);
  const assignments = new Map<string, Set<string>>();
  const inlineDocuments = new Map<
    string,
    { tagId: string; text: string; version: number }
  >();
  let failInlineRename = false;
  let sequence = 0;

  function tagForId(tagId: string) {
    const tag = tags.get(tagId);
    if (!tag) {
      throw new Error("Tag was not found.");
    }
    return tag;
  }

  const store: TagStore & {
    failInlineRename: boolean;
    inlineDocuments: typeof inlineDocuments;
    rename: (
      workspaceId: string,
      input: ParsedRenameTagInput,
    ) => Promise<TagSuggestion["tag"]>;
  } = {
    apply: async (_workspaceId, input) => {
      await Promise.resolve();
      const record = records.get(input.recordId);
      if (!record || record.projectId !== input.projectId) {
        return null;
      }
      tagForId(input.tagId);
      const recordAssignments = assignments.get(input.recordId) ?? new Set();
      recordAssignments.add(input.tagId);
      assignments.set(input.recordId, recordAssignments);
      const tag = tagForId(input.tagId);
      return {
        createdAt: timestamp,
        id: `${input.recordId}:${input.tagId}`,
        recordId: input.recordId,
        recordType: input.recordType,
        tagId: tag.id,
      };
    },
    create: async (_workspaceId, input) => {
      await Promise.resolve();
      const nameKey = input.name.toLocaleLowerCase("en-US");
      if (
        [...tags.values()].some(
          (candidate) => candidate.name.toLocaleLowerCase("en-US") === nameKey,
        )
      ) {
        throw new TagNameConflictError(input.name);
      }
      sequence += 1;
      const tag = {
        createdAt: timestamp,
        id: `tag-${sequence}`,
        name: input.name,
        revision: 0,
        updatedAt: timestamp,
      } as const;
      tags.set(tag.id, tag);
      return tag;
    },
    findWorkspaceId: async (accountId) => {
      await Promise.resolve();
      return accountId === "account-1" ? "workspace-1" : null;
    },
    list: async (_workspaceId, projectId) => {
      await Promise.resolve();
      if (projectId !== "project-1") {
        return null;
      }
      return [...tags.values()].map((tag) => ({
        projectUsageCount: [...assignments.values()].filter((tagIds) =>
          tagIds.has(tag.id),
        ).length,
        tag,
      }));
    },
    listRecords: async (_workspaceId, input) => {
      await Promise.resolve();
      if (input.projectId !== "project-1") {
        return null;
      }
      const { tagId } = input;
      return [...records.values()]
        .filter(
          (record) =>
            record.projectId === input.projectId &&
            (!tagId || assignments.get(record.id)?.has(tagId)),
        )
        .map((record) => ({
          ...record,
          tags: [...(assignments.get(record.id) ?? [])].map((id) =>
            tagForId(id),
          ),
        }));
    },
    remove: async (_workspaceId, input) => {
      await Promise.resolve();
      const record = records.get(input.recordId);
      if (!record || record.projectId !== input.projectId) {
        return null;
      }
      const recordAssignments = assignments.get(input.recordId);
      recordAssignments?.delete(input.tagId);
      return { status: true };
    },
    rename: async (_workspaceId, input) => {
      await Promise.resolve();
      const tag = tagForId(input.tagId);
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== tag.revision
      ) {
        throw new Error("Tag changed since it was loaded.");
      }
      const nextName = input.name;
      if (
        [...tags.values()].some(
          (candidate) =>
            candidate.id !== tag.id &&
            candidate.name.toLocaleLowerCase("en-US") ===
              nextName.toLocaleLowerCase("en-US"),
        )
      ) {
        throw new TagNameConflictError(nextName);
      }
      const previousTag = { ...tag };
      const previousDocuments = new Map(
        [...inlineDocuments.entries()].map(([id, document]) => [
          id,
          { ...document },
        ]),
      );
      try {
        if (failInlineRename) {
          throw new Error("Document rename failed.");
        }
        const renamed = {
          ...tag,
          name: nextName,
          revision: tag.revision + (tag.name === nextName ? 0 : 1),
        } as const;
        tags.set(tag.id, renamed);
        for (const [documentId, document] of inlineDocuments) {
          if (document.tagId === tag.id) {
            inlineDocuments.set(documentId, {
              ...document,
              text: `#${nextName}`,
              version: document.version + 1,
            });
          }
        }
        return renamed;
      } catch (error) {
        tags.set(tag.id, previousTag);
        inlineDocuments.clear();
        for (const [documentId, document] of previousDocuments) {
          inlineDocuments.set(documentId, document);
        }
        throw error;
      }
    },
    failInlineRename,
    inlineDocuments,
  };

  Object.defineProperty(store, "failInlineRename", {
    get: () => failInlineRename,
    set: (value: boolean) => {
      failInlineRename = value;
    },
  });

  return store;
}

describe("Tags Workspace namespace", () => {
  test("creates one flat identity, applies and removes it without deleting the identity", async () => {
    const store = createMemoryStore();
    const tags = createTags({ rename: store.rename, store });
    const tag = await tags.create("account-1", { name: "roadmap/next" });

    await tags.apply("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
      tagId: tag.id,
    });

    await expect(
      tags.records("account-1", { projectId: "project-1", tagId: tag.id }),
    ).resolves.toMatchObject([
      { id: "work-1", tags: [{ id: tag.id, name: "roadmap/next" }] },
    ]);

    await tags.remove("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
      tagId: tag.id,
    });

    await expect(tags.list("account-1", "project-1")).resolves.toMatchObject([
      { tag: { id: tag.id, name: "roadmap/next" } },
    ]);
    await expect(
      tags.records("account-1", { projectId: "project-1", tagId: tag.id }),
    ).resolves.toEqual([]);
  });

  test("rejects a second Workspace identity for the same visible name", async () => {
    const store = createMemoryStore();
    const tags = createTags({ rename: store.rename, store });
    await tags.create("account-1", { name: "Audience" });

    await expect(
      tags.create("account-1", { name: " audience " }),
    ).rejects.toBeInstanceOf(TagNameConflictError);
  });

  test("rejects writes for an Account without a Workspace", async () => {
    const store = createMemoryStore();
    const tags = createTags({ rename: store.rename, store });
    const applyInput = {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
      tagId: "tag-1",
    } as const;

    await expect(
      tags.create("account-without-workspace", { name: "Orphan" }),
    ).rejects.toBeInstanceOf(TagWorkspaceNotFoundError);
    await expect(
      tags.apply("account-without-workspace", applyInput),
    ).rejects.toBeInstanceOf(TagWorkspaceNotFoundError);
    await expect(
      tags.remove("account-without-workspace", applyInput),
    ).rejects.toBeInstanceOf(TagWorkspaceNotFoundError);
  });

  test("ranks tags used in the current Project first without changing their scope", async () => {
    const store = createMemoryStore();
    const tags = createTags({ rename: store.rename, store });
    const first = await tags.create("account-1", { name: "First" });
    const second = await tags.create("account-1", { name: "Second" });
    await tags.apply("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
      tagId: second.id,
    });
    await tags.apply("account-1", {
      projectId: "project-1",
      recordId: "work-2",
      recordType: "Work",
      tagId: second.id,
    });

    await expect(tags.list("account-1", "project-1")).resolves.toEqual([
      expect.objectContaining({
        projectUsageCount: 2,
        tag: expect.objectContaining({ id: second.id }),
      }),
      expect.objectContaining({
        projectUsageCount: 0,
        tag: expect.objectContaining({ id: first.id }),
      }),
    ]);
  });

  test("renames one identity across structured and inline uses and keeps filtering by identity", async () => {
    const store = createMemoryStore();
    const tags = createTags({ rename: store.rename, store });
    const tag = await tags.create("account-1", { name: "roadmap/next" });
    await tags.apply("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
      tagId: tag.id,
    });
    await tags.apply("account-1", {
      projectId: "project-1",
      recordId: "work-2",
      recordType: "Work",
      tagId: tag.id,
    });
    store.inlineDocuments.set("document-1", {
      tagId: tag.id,
      text: "#roadmap/next",
      version: 1,
    });

    const renamed = await tags.rename("account-1", {
      name: "launch/next",
      tagId: tag.id,
    });

    expect(renamed).toMatchObject({
      id: tag.id,
      name: "launch/next",
      revision: 1,
    });
    await expect(
      tags.records("account-1", { projectId: "project-1", tagId: tag.id }),
    ).resolves.toMatchObject([
      { id: "work-1", tags: [{ id: tag.id, name: "launch/next" }] },
      { id: "work-2", tags: [{ id: tag.id, name: "launch/next" }] },
    ]);
    expect(store.inlineDocuments.get("document-1")).toEqual({
      tagId: tag.id,
      text: "#launch/next",
      version: 2,
    });

    const undone = await tags.rename("account-1", {
      expectedRevision: renamed.revision,
      name: "roadmap/next",
      tagId: tag.id,
    });
    expect(undone).toMatchObject({
      id: tag.id,
      name: "roadmap/next",
      revision: 2,
    });
    expect(store.inlineDocuments.get("document-1")).toEqual({
      tagId: tag.id,
      text: "#roadmap/next",
      version: 3,
    });
  });

  test("leaves no mixed names when an inline Document update fails", async () => {
    const store = createMemoryStore();
    const tags = createTags({ rename: store.rename, store });
    const tag = await tags.create("account-1", { name: "roadmap/next" });
    await tags.apply("account-1", {
      projectId: "project-1",
      recordId: "work-1",
      recordType: "Work",
      tagId: tag.id,
    });
    store.inlineDocuments.set("document-1", {
      tagId: tag.id,
      text: "#roadmap/next",
      version: 1,
    });
    store.failInlineRename = true;

    await expect(
      tags.rename("account-1", { name: "launch/next", tagId: tag.id }),
    ).rejects.toThrow("Document rename failed.");
    await expect(tags.list("account-1", "project-1")).resolves.toMatchObject([
      { tag: { id: tag.id, name: "roadmap/next", revision: 0 } },
    ]);
    await expect(
      tags.records("account-1", { projectId: "project-1", tagId: tag.id }),
    ).resolves.toMatchObject([
      { id: "work-1", tags: [{ id: tag.id, name: "roadmap/next" }] },
    ]);
    expect(store.inlineDocuments.get("document-1")).toEqual({
      tagId: tag.id,
      text: "#roadmap/next",
      version: 1,
    });
  });
});
