import type { CreateProjectUpdateInput } from "@cantiara/api/project-updates";
import { describe, expect, test } from "vitest";

import { createProjectUpdates } from "../project-updates";
import { createMemoryProjectUpdates } from "../project-updates-memory-store";

const ACCOUNT = "account-1";
const HEALTH_JUDGMENT = /health|score|mission control|draft|current/i;

function setup(options: { archived?: boolean } = {}) {
  let tick = 0;
  const nextTime = () => {
    tick += 1;
    return new Date(Date.UTC(2026, 9, 1, 0, 0, tick - 1));
  };
  const harness = createMemoryProjectUpdates({
    accountId: ACCOUNT,
    projects: new Map([
      [
        "project-1",
        {
          archived: options.archived,
          records: new Map([
            ["Risk:r1", { label: "Slip", status: "Open", unavailable: false }],
            [
              "Milestone:m1",
              { label: "Alpha", status: "Planned", unavailable: false },
            ],
            [
              "Decision:d1",
              { label: "Use SQLite", status: "Active", unavailable: true },
            ],
          ]),
        },
      ],
    ]),
  });
  const access = createProjectUpdates(harness.store, {
    now: nextTime,
  });
  return { ...harness, access };
}

function input(
  overrides: Partial<CreateProjectUpdateInput> = {},
): CreateProjectUpdateInput {
  return {
    links: [],
    mark: "On Track",
    narrative: "Shipping steadily.",
    projectId: "project-1",
    snapshot: {
      blocks: [
        {
          name: "Risks",
          records: [
            { id: "r1", status: "Open", targetDate: null, title: "Slip" },
          ],
        },
      ],
      lifecycle: "Active",
      purpose: "Ship",
      targetDate: null,
    },
    updateId: "u1",
    ...overrides,
  };
}

describe("Manual Project Updates", () => {
  test("records a mark, narrative and links to live records", async () => {
    const { access } = setup();
    const created = await access.create(
      ACCOUNT,
      input({
        links: [
          { targetId: "r1", targetType: "Risk" },
          { targetId: "m1", targetType: "Milestone" },
        ],
        mark: "At Risk",
      }),
    );
    expect(created).toMatchObject({
      mark: "At Risk",
      narrative: "Shipping steadily.",
    });
    expect(created?.links.map((link) => link.label)).toEqual(["Slip", "Alpha"]);
    expect(created?.links.every((link) => !link.unavailable)).toBe(true);
    // Reads return the canonical link order the database store produces.
    const overview = await access.overview(ACCOUNT, "project-1");
    expect(overview?.updates[0]?.links.map((link) => link.label)).toEqual([
      "Alpha",
      "Slip",
    ]);
  });

  test("freezes the summary blocks at the save moment", async () => {
    const { access, entries } = setup();
    const draft = input();
    const created = await access.create(ACCOUNT, draft);
    expect(created?.snapshot).toEqual(draft.snapshot);
    expect(created?.savedAt).toBe("2026-10-01T00:00:00.000Z");
    // The caller's later change of its own object cannot reach the saved entry.
    draft.snapshot.blocks[0]?.records.push({
      id: "r2",
      status: null,
      targetDate: null,
      title: "Later",
    });
    const overview = await access.overview(ACCOUNT, "project-1");
    expect(overview?.updates[0]?.snapshot.blocks[0]?.records).toHaveLength(1);
    expect(entries).toHaveLength(1);
  });

  test("keeps linked records live instead of copying them into the entry", async () => {
    const { access } = setup();
    await access.create(
      ACCOUNT,
      input({ links: [{ targetId: "r1", targetType: "Risk" }] }),
    );
    const overview = await access.overview(ACCOUNT, "project-1");
    expect(overview?.updates[0]?.links[0]).toMatchObject({
      label: "Slip",
      status: "Open",
      targetId: "r1",
      targetType: "Risk",
    });
  });

  test("appends: an older entry is still listed after a new save, newest first", async () => {
    const { access } = setup();
    await access.create(ACCOUNT, input({ updateId: "u1", mark: "On Track" }));
    await access.create(ACCOUNT, input({ updateId: "u2", mark: "Off Track" }));
    const overview = await access.overview(ACCOUNT, "project-1");
    expect(overview?.updates.map((update) => update.id)).toEqual(["u2", "u1"]);
    expect(overview?.updates.map((update) => update.mark)).toEqual([
      "Off Track",
      "On Track",
    ]);
  });

  test("rejects an in-place rewrite of a saved entry and keeps it as it was", async () => {
    const { access } = setup();
    await access.create(ACCOUNT, input());
    await expect(
      access.create(
        ACCOUNT,
        input({ mark: "Off Track", narrative: "Rewritten." }),
      ),
    ).rejects.toMatchObject({ code: "PROJECT_UPDATE_CONFLICT" });
    const overview = await access.overview(ACCOUNT, "project-1");
    expect(overview?.updates).toHaveLength(1);
    expect(overview?.updates[0]).toMatchObject({
      mark: "On Track",
      narrative: "Shipping steadily.",
    });
  });

  test("replays the same save instead of adding a second entry", async () => {
    const { access } = setup();
    const first = await access.create(ACCOUNT, input());
    const again = await access.create(ACCOUNT, input());
    expect(again?.savedAt).toBe(first?.savedAt);
    expect((await access.overview(ACCOUNT, "project-1"))?.updates).toHaveLength(
      1,
    );
  });

  test("replays a retried save even when the stored snapshot key order differs", async () => {
    // The database store reads jsonb snapshots back with canonicalized object
    // key order; the replay comparison must not depend on the client's order.
    const { access, entries } = setup();
    await access.create(
      ACCOUNT,
      input({
        snapshot: {
          blocks: [],
          lifecycle: "Active",
          purpose: null,
          targetDate: null,
        },
      }),
    );
    const [stored] = entries;
    expect(stored).toBeDefined();
    if (stored) {
      stored.snapshot = {
        blocks: [],
        // Deliberately different key order than the schema's field order.
        targetDate: null,
        purpose: null,
        lifecycle: "Active",
      };
    }
    await expect(
      access.create(
        ACCOUNT,
        input({
          snapshot: {
            blocks: [],
            lifecycle: "Active",
            purpose: null,
            targetDate: null,
          },
        }),
      ),
    ).resolves.toMatchObject({ id: "u1" });
    expect(entries).toHaveLength(1);
  });

  test("the same client id in another Project is an independent save", async () => {
    const { access, entries } = setup();
    await access.create(ACCOUNT, input({ updateId: "u1" }));
    const secondProject = createMemoryProjectUpdates({
      accountId: ACCOUNT,
      projects: new Map([["project-2", { records: new Map<string, never>() }]]),
    });
    const secondAccess = createProjectUpdates(secondProject.store, {});
    await expect(
      secondAccess.create(ACCOUNT, { ...input(), projectId: "project-2" }),
    ).resolves.toMatchObject({ id: "u1" });
    expect(entries).toHaveLength(1);
  });

  test("emits no live health judgment, only dated entries", async () => {
    const { access } = setup();
    await access.create(ACCOUNT, input());
    const overview = await access.overview(ACCOUNT, "project-1");
    expect(Object.keys(overview ?? {}).sort()).toEqual(["readOnly", "updates"]);
    expect(Object.keys(overview?.updates[0] ?? {}).sort()).toEqual([
      "id",
      "links",
      "mark",
      "narrative",
      "projectId",
      "savedAt",
      "snapshot",
    ]);
    expect(Object.keys(overview ?? {}).join(" ")).not.toMatch(HEALTH_JUDGMENT);
  });

  test("refuses a link to a record outside the Project or no longer live", async () => {
    const { access } = setup();
    await expect(
      access.create(
        ACCOUNT,
        input({ links: [{ targetId: "other", targetType: "Risk" }] }),
      ),
    ).rejects.toMatchObject({ code: "PROJECT_UPDATE_LINK_INVALID" });
    await expect(
      access.create(
        ACCOUNT,
        input({ links: [{ targetId: "d1", targetType: "Decision" }] }),
      ),
    ).rejects.toMatchObject({ code: "PROJECT_UPDATE_LINK_INVALID" });
  });

  test("keeps updates readable but takes no new one in an archived Project", async () => {
    const { access } = setup({ archived: true });
    await expect(access.create(ACCOUNT, input())).rejects.toMatchObject({
      code: "PROJECT_UPDATE_READ_ONLY",
    });
    expect((await access.overview(ACCOUNT, "project-1"))?.readOnly).toBe(true);
  });

  test("does not serve or accept another account's Project", async () => {
    const { access } = setup();
    expect(await access.overview("account-2", "project-1")).toBeNull();
    expect(await access.create("account-2", input())).toBeNull();
  });
});
