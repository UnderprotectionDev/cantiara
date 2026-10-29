import { TrashRestoreConflictError } from "@cantiara/api/trash-configuration";
import { describe, expect, test } from "vitest";

import { createTrash, type TrashConfigurationPort } from "../trash";
import { createMemoryTrash } from "./trash-memory-store";

const ACCOUNT = "account-1";
const PROJECT = "project-1";
const NOW = new Date("2026-03-01T10:00:00.000Z");

/** The founder-visible facts the configuration port reports. */
function setup(conflictsFor: string[] = []) {
  const harness = createMemoryTrash({
    accountId: ACCOUNT,
    projects: new Map([
      [
        PROJECT,
        {
          records: new Map([
            ["Custom Field:cf1", { label: "Effort band", revision: 2 }],
            ["Smart Collection:sc1", { label: "Open bugs", revision: 1 }],
            ["Automation Rule:ar1", { label: "Done stamps", revision: 1 }],
            ["Work Template:wt1", { label: "Bug intake", revision: 1 }],
            ["Document Template:dt1", { label: "PRD skeleton", revision: 1 }],
          ]),
          workspaceId: "workspace-1",
        },
      ],
    ]),
  });
  let counter = 0;
  const configuration: TrashConfigurationPort = {
    impact: () =>
      Promise.resolve({
        dependents: [{ id: "wt1", kind: "Work Template", label: "Bug intake" }],
        storedValues: [{ count: 12, label: "Custom field values on records" }],
      }),
    restoreConflicts: (_project, ref) =>
      Promise.resolve(
        conflictsFor.includes(ref.id)
          ? [
              {
                dependencyId: "cf-gone",
                dependencyKind: "Custom Field",
                label: "Custom Field cf-gone",
                reason: "Permanently deleted" as const,
              },
            ]
          : [],
      ),
  };
  const trash = createTrash(harness.store, {
    configuration,
    newId: () => {
      counter += 1;
      return `entry-${counter}`;
    },
    now: () => NOW,
  });
  return { ...harness, trash };
}

const move = (kind: string, id: string, baseRevision: number) =>
  ({
    baseRevision,
    clientIdempotencyKey: `move-${id}`,
    projectId: PROJECT,
    recordId: id,
    recordKind: kind,
  }) as never;

const restoreInput = (entryId: string, baseRevision: number) =>
  ({
    baseRevision,
    clientIdempotencyKey: `restore-${entryId}`,
    entryId,
    projectId: PROJECT,
  }) as never;

describe("Trash seam: Configuration Trash", () => {
  test.each([
    ["Custom Field", "cf1", 2],
    ["Smart Collection", "sc1", 1],
    ["Automation Rule", "ar1", 1],
    ["Work Template", "wt1", 1],
    ["Document Template", "dt1", 1],
  ] as const)(
    "a %s shares the 30-day clock and is no living member while in Trash",
    async (kind, id, revision) => {
      const { trash } = setup();

      const entry = await trash.move(ACCOUNT, move(kind, id, revision));

      expect(entry?.recordId).toBe(id);
      expect(entry?.expiresAt).toBe("2026-03-31T10:00:00.000Z");
      expect(await trash.living(ACCOUNT, PROJECT, [{ id, kind }])).toEqual([]);
    },
  );

  test("the delete preview shows affected stored values and dependents", async () => {
    const { trash } = setup();

    const preview = await trash.preview(ACCOUNT, {
      projectId: PROJECT,
      recordId: "cf1",
      recordKind: "Custom Field",
    });

    expect(preview?.configuration).toEqual({
      dependents: [{ id: "wt1", kind: "Work Template", label: "Bug intake" }],
      storedValues: [{ count: 12, label: "Custom field values on records" }],
    });
  });

  test("restore returns the same id and definition with no conflict", async () => {
    const { trash } = setup();
    const entry = await trash.move(ACCOUNT, move("Work Template", "wt1", 1));

    const preview = await trash.restorePreview(ACCOUNT, {
      entryId: entry?.id ?? "",
      projectId: PROJECT,
    });
    const restored = await trash.restore(
      ACCOUNT,
      restoreInput(entry?.id ?? "", entry?.revision ?? -1),
    );

    expect(preview).toMatchObject({ conflicts: [], restorable: true });
    expect(restored?.records).toEqual([
      { recordId: "wt1", recordKind: "Work Template", revision: 3 },
    ]);
    expect(
      await trash.living(ACCOUNT, PROJECT, [
        { id: "wt1", kind: "Work Template" },
      ]),
    ).toHaveLength(1);
  });

  test("a permanently deleted dependency is a conflict preview and restore does not rebind", async () => {
    const { trash } = setup(["wt1"]);
    const entry = await trash.move(ACCOUNT, move("Work Template", "wt1", 1));

    const preview = await trash.restorePreview(ACCOUNT, {
      entryId: entry?.id ?? "",
      projectId: PROJECT,
    });

    expect(preview?.restorable).toBe(false);
    expect(preview?.conflicts).toEqual([
      expect.objectContaining({
        dependencyId: "cf-gone",
        reason: "Permanently deleted",
      }),
    ]);
    await expect(
      trash.restore(
        ACCOUNT,
        restoreInput(entry?.id ?? "", entry?.revision ?? -1),
      ),
    ).rejects.toBeInstanceOf(TrashRestoreConflictError);
    expect(
      await trash.living(ACCOUNT, PROJECT, [
        { id: "wt1", kind: "Work Template" },
      ]),
    ).toEqual([]);
  });

  test("restore preview never opens another account's entry", async () => {
    const { trash } = setup();
    const entry = await trash.move(ACCOUNT, move("Custom Field", "cf1", 2));

    expect(
      await trash.restorePreview("other", {
        entryId: entry?.id ?? "",
        projectId: PROJECT,
      }),
    ).toBeNull();
  });
});
