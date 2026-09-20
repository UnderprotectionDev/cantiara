import type { Context } from "@cantiara/api/context";
import { appRouter } from "@cantiara/api/routers/index";
import type {
  Tag,
  TagAssignment,
  TagRecord,
  TagsAccess,
} from "@cantiara/api/tags";
import { createRouterClient } from "@orpc/server";
import { describe, expect, test } from "vitest";

const tag: Tag = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "tag-1",
  name: "roadmap/next",
  revision: 0,
  updatedAt: "2026-09-20T09:00:00.000Z",
};

const assignment: TagAssignment = {
  createdAt: "2026-09-20T09:00:00.000Z",
  id: "assignment-1",
  recordId: "work-1",
  recordType: "Work",
  tagId: tag.id,
};

const record: TagRecord = {
  archivedAt: null,
  id: "work-1",
  key: "PAY-1",
  projectId: "project-1",
  recordType: "Work",
  tags: [tag],
  title: "Prepare launch",
};

function createContext(tags: TagsAccess): Context {
  return {
    accountAccess: {
      listSessions: async () => [],
      revokeOtherSessions: async () => undefined,
      revokeSession: async () => undefined,
    },
    accountPreferences: {
      get: () => Promise.reject(new Error("Not part of this test.")),
    },
    auth: null,
    db: {} as Context["db"],
    githubAvailability: { getStatus: () => "available" },
    session: {
      session: { id: "session-1" },
      user: { id: "account-1" },
    } as Context["session"],
    tags,
  };
}

function createAccess(): TagsAccess {
  return {
    apply: () => Promise.resolve(assignment),
    create: () => Promise.resolve(tag),
    list: () => Promise.resolve([{ projectUsageCount: 1, tag }]),
    records: () => Promise.resolve([record]),
    remove: () => Promise.resolve({ status: true as const }),
  };
}

describe("Tags RPC", () => {
  test("exposes the Tags seam for create, apply, filter, and remove", async () => {
    const client = createRouterClient(appRouter, {
      context: createContext(createAccess()),
    });

    await expect(client.createTag({ name: tag.name })).resolves.toEqual(tag);
    await expect(client.tags({ projectId: "project-1" })).resolves.toEqual([
      { projectUsageCount: 1, tag },
    ]);
    await expect(
      client.applyTag({
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
        tagId: tag.id,
      }),
    ).resolves.toEqual(assignment);
    await expect(
      client.tagRecords({ projectId: "project-1", tagId: tag.id }),
    ).resolves.toEqual([record]);
    await expect(
      client.removeTag({
        projectId: "project-1",
        recordId: "work-1",
        recordType: "Work",
        tagId: tag.id,
      }),
    ).resolves.toEqual({ status: true });
  });

  test("maps a Workspace name conflict to the public conflict error", async () => {
    const access: TagsAccess = {
      ...createAccess(),
      create: () =>
        Promise.reject(
          Object.assign(new Error("Duplicate Tag"), {
            code: "TAG_NAME_CONFLICT",
          }),
        ),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(client.createTag({ name: tag.name })).rejects.toThrow(
      "Duplicate Tag",
    );
  });

  test("maps a missing Workspace to the public not-found error", async () => {
    const access: TagsAccess = {
      ...createAccess(),
      create: () =>
        Promise.reject(
          Object.assign(new Error("Missing Workspace"), {
            code: "TAG_WORKSPACE_NOT_FOUND",
          }),
        ),
    };
    const client = createRouterClient(appRouter, {
      context: createContext(access),
    });

    await expect(client.createTag({ name: tag.name })).rejects.toThrow(
      "Workspace is unavailable.",
    );
  });
});
