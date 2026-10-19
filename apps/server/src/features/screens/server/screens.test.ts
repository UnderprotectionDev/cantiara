import {
  type ParsedSetScreenLifecycleInput,
  planScreenLifecycle,
  type ScreenRecord,
  type ScreenStore,
} from "@cantiara/api/screens";
import { screen, screenWireframeVersion } from "@cantiara/db/schema/screen";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import {
  createScreens,
  ScreenLifecycleInvalidError,
  ScreenNotFoundError,
  ScreenProjectNotFoundError,
  ScreenRevisionConflictError,
} from "./screens";

const timestamp = "2026-10-01T09:00:00.000Z";
const accountId = "account-1";

/** In-memory Screens store; Wireframe versions live only inside their Screen record. */
function createMemoryStore() {
  const records = new Map<string, ScreenRecord>();
  const archived = new Set<string>();
  const trashed = new Set<string>();
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
    attachWireframeVersion: async (account, projectId, screenId) => {
      await Promise.resolve();
      const current = records.get(screenId);
      if (
        !(current && owns(account, projectId)) ||
        trashed.has(screenId) ||
        current.projectId !== projectId
      ) {
        return null;
      }
      const next: ScreenRecord = {
        ...current,
        wireframeVersions: [
          ...current.wireframeVersions,
          {
            createdAt: timestamp,
            id: nextId("version"),
            version: current.wireframeVersions.length + 1,
          },
        ],
      };
      records.set(screenId, next);
      return withLifecycle(next);
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
  return { screens: createScreens(store), store };
}

describe("Screens and Wireframes seam", () => {
  test("creates a Screen from a title alone, without any visual design", async () => {
    const { screens } = createMemoryStore();

    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "  Checkout  ",
    });

    expect(record).toMatchObject({
      lifecycle: "Active",
      projectId: "project-1",
      title: "Checkout",
      wireframeVersions: [],
    });
    expect((await screens.list(accountId, "project-1")).screens).toHaveLength(
      1,
    );
  });

  test("rejects an empty title, a Wireframe or design in create, and unknown Projects", async () => {
    const { screens } = createMemoryStore();

    await expect(
      screens.create(accountId, { projectId: "project-1", title: "   " }),
    ).rejects.toThrow("Title is required.");
    await expect(
      screens.create(accountId, {
        projectId: "project-1",
        title: "Home",
        wireframe: { blocks: [] },
      } as never),
    ).rejects.toThrow();
    await expect(
      screens.create(accountId, { projectId: "elsewhere", title: "Home" }),
    ).rejects.toBeInstanceOf(ScreenProjectNotFoundError);
    await expect(
      screens.create("stranger", { projectId: "project-1", title: "Home" }),
    ).rejects.toBeInstanceOf(ScreenProjectNotFoundError);
  });

  test("Wireframe has no identity, scope or lifecycle apart from its Screen", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });

    // The version table carries no Project scope and no archive or trash column.
    const versionColumns = Object.keys(getTableColumns(screenWireframeVersion));
    expect(versionColumns.sort()).toEqual(
      ["createdAt", "id", "screenId", "version"].sort(),
    );
    expect(Object.keys(getTableColumns(screen))).toEqual(
      expect.arrayContaining(["archivedAt", "trashedAt", "projectId"]),
    );
    // A lifecycle command addresses a Screen; a Wireframe id is not accepted.
    await expect(
      screens.setLifecycle(accountId, {
        action: "archive",
        projectId: "project-1",
        screenId: record.id,
        wireframeId: "w1",
      } as never),
    ).rejects.toThrow();
  });

  test("exact Wireframe versions stay on the Screen through archive, trash and restore", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    await screens.attachWireframeVersion(accountId, "project-1", record.id);
    const withTwo = await screens.attachWireframeVersion(
      accountId,
      "project-1",
      record.id,
    );
    const versions = withTwo.wireframeVersions;
    expect(versions.map(({ version }) => version)).toEqual([1, 2]);

    const run = async (action: "archive" | "trash" | "restore" | "unarchive") =>
      (
        await screens.setLifecycle(accountId, {
          action,
          projectId: "project-1",
          screenId: record.id,
        })
      ).wireframeVersions;

    expect(await run("archive")).toEqual(versions);
    expect(await run("trash")).toEqual(versions);
    expect(await run("restore")).toEqual(versions);
    expect(await run("unarchive")).toEqual(versions);
  });

  test("archive, trash and restore follow the common master-record contract", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    const act = (
      action: "archive" | "unarchive" | "trash" | "restore",
      expectedRevision?: number,
    ) =>
      screens.setLifecycle(accountId, {
        action,
        expectedRevision,
        projectId: "project-1",
        screenId: record.id,
      });

    const archivedRecord = await act("archive");
    expect(archivedRecord).toMatchObject({
      lifecycle: "Archived",
      revision: 2,
    });
    // Repeating a command is a no-op and writes no revision.
    expect(await act("archive")).toMatchObject({ revision: 2 });

    // Move to Trash keeps the Archive; Restore returns the same Screen to it.
    expect(await act("trash")).toMatchObject({
      id: record.id,
      lifecycle: "In Trash",
      revision: 3,
    });
    await expect(act("unarchive")).rejects.toBeInstanceOf(
      ScreenLifecycleInvalidError,
    );
    await expect(act("archive")).rejects.toBeInstanceOf(
      ScreenLifecycleInvalidError,
    );
    expect(await act("restore")).toMatchObject({
      id: record.id,
      lifecycle: "Archived",
      revision: 4,
    });
    expect(await act("unarchive")).toMatchObject({
      id: record.id,
      lifecycle: "Active",
      revision: 5,
    });

    await expect(act("trash", 1)).rejects.toBeInstanceOf(
      ScreenRevisionConflictError,
    );
    await expect(
      screens.setLifecycle(accountId, {
        action: "trash",
        projectId: "project-1",
        screenId: "missing",
      }),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });

  test("a Screen in Trash is a broken target and is never retargeted", async () => {
    const { screens } = createMemoryStore();
    const first = await screens.create(accountId, {
      projectId: "project-1",
      title: "Settings",
    });
    const lookalike = await screens.create(accountId, {
      projectId: "project-1",
      title: "Settings",
    });

    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: first.id,
      }),
    ).toEqual({
      lifecycle: "Active",
      screenId: first.id,
      state: "resolved",
      title: "Settings",
    });

    await screens.setLifecycle(accountId, {
      action: "trash",
      projectId: "project-1",
      screenId: first.id,
    });
    const broken = await screens.resolveTarget(accountId, {
      projectId: "project-1",
      screenId: first.id,
    });
    expect(broken).toEqual({
      reason: "In Trash",
      screenId: first.id,
      state: "broken",
    });
    // Nothing of the lookalike or of the trashed Screen leaks into the target.
    expect(JSON.stringify(broken)).not.toContain(lookalike.id);
    expect(JSON.stringify(broken)).not.toContain("Settings");

    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: "unknown-screen",
      }),
    ).toEqual({
      reason: "No access",
      screenId: "unknown-screen",
      state: "broken",
    });

    await screens.setLifecycle(accountId, {
      action: "restore",
      projectId: "project-1",
      screenId: first.id,
    });
    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: first.id,
      }),
    ).toMatchObject({ screenId: first.id, state: "resolved" });
  });

  test("an Archived Screen still resolves and is marked Archived", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Profile",
    });
    await screens.setLifecycle(accountId, {
      action: "archive",
      projectId: "project-1",
      screenId: record.id,
    });

    expect(
      await screens.resolveTarget(accountId, {
        projectId: "project-1",
        screenId: record.id,
      }),
    ).toMatchObject({ lifecycle: "Archived", state: "resolved" });
  });

  test("a Screen in Trash accepts no new Wireframe version until restored", async () => {
    const { screens } = createMemoryStore();
    const record = await screens.create(accountId, {
      projectId: "project-1",
      title: "Home",
    });
    await screens.setLifecycle(accountId, {
      action: "trash",
      projectId: "project-1",
      screenId: record.id,
    });

    await expect(
      screens.attachWireframeVersion(accountId, "project-1", record.id),
    ).rejects.toBeInstanceOf(ScreenNotFoundError);
  });
});
