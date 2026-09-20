import type { TagRecord, TagStore, TagSuggestion } from "@cantiara/api/tags";
import { describe, expect, test } from "vitest";

import { createTags, TagNameConflictError } from "./tags";

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
  let sequence = 0;

  function tagForId(tagId: string) {
    const tag = tags.get(tagId);
    if (!tag) {
      throw new Error("Tag was not found.");
    }
    return tag;
  }

  const store: TagStore = {
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
  };

  return store;
}

describe("Tags Workspace namespace", () => {
  test("creates one flat identity, applies and removes it without deleting the identity", async () => {
    const tags = createTags({ store: createMemoryStore() });
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
    const tags = createTags({ store: createMemoryStore() });
    await tags.create("account-1", { name: "Audience" });

    await expect(
      tags.create("account-1", { name: " audience " }),
    ).rejects.toBeInstanceOf(TagNameConflictError);
  });

  test("ranks tags used in the current Project first without changing their scope", async () => {
    const tags = createTags({ store: createMemoryStore() });
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
});
