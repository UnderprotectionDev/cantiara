// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createProjectWall,
  ProjectWallCardNotFoundError,
  ProjectWallNotFoundError,
} from "./project-wall";
import {
  createFakeProjectWallStore,
  createFakeSnapshotRenderer,
} from "./project-wall-test-support";

const VIEWPORT_WORDS = /zoom|center|collapsed/;
const ACCOUNT = "account-1";
const OTHER_ACCOUNT = "account-2";
const PROJECT = "project-1";

const viewport: ProjectWallViewport = {
  center: { x: 300, y: 40 },
  collapsed: [],
  zoom: 1.25,
};

function setup(extraWorks = 0) {
  const memory = createFakeProjectWallStore({
    projects: [{ id: PROJECT, ownerAccountId: ACCOUNT }],
    sources: [
      ...["work-1", "work-2", "work-3"].map((id) => ({
        id,
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work" as const,
        status: "In Progress",
        title: `Title ${id}`,
        values: { Key: id.toUpperCase(), Type: "Task" },
      })),
      ...Array.from({ length: extraWorks }, (_, index) => ({
        id: `bulk-${index}`,
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work" as const,
        status: "In Progress",
        title: `Bulk ${index}`,
        values: {},
      })),
    ],
  });
  const snapshots = createFakeSnapshotRenderer();
  let sequence = 0;
  const seam = createProjectWall(memory.store, {
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    renderer: snapshots.renderer,
  });
  return { ...memory, seam, snapshots };
}

async function wallWithCards() {
  const ctx = setup();
  const wall = await ctx.seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Story",
  });
  let view = wall;
  for (const [index, sourceId] of ["work-1", "work-2", "work-3"].entries()) {
    view = await ctx.seam.addCard(ACCOUNT, {
      position: { x: index * 300, y: 0 },
      projectId: PROJECT,
      sourceId,
      sourceType: "Work",
      wallId: wall.id,
    });
  }
  const group = await ctx.seam.createGroup(ACCOUNT, {
    projectId: PROJECT,
    title: "Onboarding",
    wallId: wall.id,
  });
  return { ...ctx, groupId: group.groups[0]?.id ?? "", view, wallId: wall.id };
}

describe("personal viewport", () => {
  test("is empty before anything was saved", async () => {
    const { seam, wallId } = await wallWithCards();
    expect(await seam.viewport(ACCOUNT, PROJECT, wallId)).toBeNull();
  });

  test("is restored for the account that saved it", async () => {
    const { seam, wallId } = await wallWithCards();
    await seam.saveViewport(ACCOUNT, { projectId: PROJECT, viewport, wallId });
    expect(await seam.viewport(ACCOUNT, PROJECT, wallId)).toEqual(viewport);
  });

  test("is not another user's view and is refused for a wall the account does not own", async () => {
    const { seam, wallId } = await wallWithCards();
    await seam.saveViewport(ACCOUNT, { projectId: PROJECT, viewport, wallId });
    await expect(
      seam.viewport(OTHER_ACCOUNT, PROJECT, wallId),
    ).rejects.toBeInstanceOf(ProjectWallNotFoundError);
    await expect(
      seam.saveViewport(OTHER_ACCOUNT, {
        projectId: PROJECT,
        viewport,
        wallId,
      }),
    ).rejects.toBeInstanceOf(ProjectWallNotFoundError);
  });

  test("keeps one viewport per account and wall in the store", async () => {
    const { store, wallId } = await wallWithCards();
    await store.saveViewport(ACCOUNT, wallId, viewport);
    await store.saveViewport(OTHER_ACCOUNT, wallId, { ...viewport, zoom: 0.5 });
    expect((await store.findViewport(ACCOUNT, wallId))?.zoom).toBe(1.25);
    expect((await store.findViewport(OTHER_ACCOUNT, wallId))?.zoom).toBe(0.5);
    expect(await store.findViewport(ACCOUNT, "another-wall")).toBeNull();
  });

  test("is this canvas only: another wall of the Project has its own", async () => {
    const { seam, wallId } = await wallWithCards();
    const other = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Other wall",
    });
    await seam.saveViewport(ACCOUNT, { projectId: PROJECT, viewport, wallId });
    expect(await seam.viewport(ACCOUNT, PROJECT, other.id)).toBeNull();
  });

  test("is not content: the wall, its cards, the sources and the Snapshot do not carry it", async () => {
    const ctx = await wallWithCards();
    const { groupId, seam, wallId } = ctx;
    const before = await seam.get(ACCOUNT, PROJECT, wallId);
    const sourcesBefore = ctx.sourceSnapshot();
    await seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      viewport: { ...viewport, collapsed: [groupId] },
      wallId,
    });
    const after = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(after).toEqual(before);
    expect(JSON.stringify(after)).not.toContain("zoom");
    // Collapse has no field on the wall view's groups; it is viewport-only.
    expect(JSON.stringify(after.groups)).not.toContain("collapsed");
    expect(ctx.sourceSnapshot()).toEqual(sourcesBefore);

    const cardIds = after.cards.map(({ id }) => id);
    const preview = await seam.previewSnapshot(ACCOUNT, {
      cardIds,
      projectId: PROJECT,
      wallId,
    });
    expect(JSON.stringify(preview)).not.toMatch(VIEWPORT_WORDS);
    await seam.exportSnapshot(ACCOUNT, {
      cardIds,
      format: "PNG",
      projectId: PROJECT,
      wallId,
    });
    expect(JSON.stringify(ctx.snapshots.rendered)).not.toMatch(VIEWPORT_WORDS);
  });

  test("carries no selection, inspector, edit mode or unsaved operations", async () => {
    const { seam, wallId } = await wallWithCards();
    await expect(
      seam.saveViewport(ACCOUNT, {
        projectId: PROJECT,
        viewport: { ...viewport, selection: ["a"] } as never,
        wallId,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await seam.viewport(ACCOUNT, PROJECT, wallId)).toBeNull();
  });

  test("rejects a zoom outside the canvas range and a non-finite center", async () => {
    const { seam, wallId } = await wallWithCards();
    const bad = [
      { ...viewport, zoom: 0 },
      { ...viewport, zoom: 99 },
      { ...viewport, center: { x: Number.NaN, y: 0 } },
    ];
    await Promise.all(
      bad.map((candidate) =>
        expect(
          seam.saveViewport(ACCOUNT, {
            projectId: PROJECT,
            viewport: candidate,
            wallId,
          }),
        ).rejects.toBeInstanceOf(ZodError),
      ),
    );
  });

  test("drops the collapse of a group that no longer exists", async () => {
    const { groupId, seam, wallId } = await wallWithCards();
    await seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      viewport: { ...viewport, collapsed: [groupId, "ghost"] },
      wallId,
    });
    expect((await seam.viewport(ACCOUNT, PROJECT, wallId))?.collapsed).toEqual([
      groupId,
    ]);
    await seam.deleteGroup(ACCOUNT, { groupId, projectId: PROJECT, wallId });
    expect((await seam.viewport(ACCOUNT, PROJECT, wallId))?.collapsed).toEqual(
      [],
    );
  });
});

describe("reorder (Outline order and z-order)", () => {
  test("writes the order of cards without touching positions or sources", async () => {
    const ctx = await wallWithCards();
    const { seam, view, wallId } = ctx;
    const [a, b, c] = view.cards.map(({ id }) => id);
    const sources = ctx.sourceSnapshot();
    const reordered = await seam.reorderCards(ACCOUNT, {
      cardIds: [c ?? "", a ?? "", b ?? ""],
      projectId: PROJECT,
      wallId,
    });
    expect(reordered.cards.map(({ id }) => id)).toEqual([c, a, b]);
    expect(reordered.cards.map(({ position }) => position.x)).toEqual([
      600, 0, 300,
    ]);
    expect(ctx.sourceSnapshot()).toEqual(sources);
    expect(
      (await seam.get(ACCOUNT, PROJECT, wallId)).cards.map(({ id }) => id),
    ).toEqual([c, a, b]);
  });

  test("needs every card exactly once", async () => {
    const { seam, view, wallId } = await wallWithCards();
    const [a, b] = view.cards.map(({ id }) => id);
    await expect(
      seam.reorderCards(ACCOUNT, {
        cardIds: [a ?? ""],
        projectId: PROJECT,
        wallId,
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardNotFoundError);
    // A duplicate id is rejected by the contract itself; it can never
    // degrade into a misleading not-found naming an existing card.
    await expect(
      seam.reorderCards(ACCOUNT, {
        cardIds: [a ?? "", a ?? "", b ?? ""],
        projectId: PROJECT,
        wallId,
      }),
    ).rejects.toMatchObject({ name: "ZodError" });
    await expect(
      seam.reorderCards(ACCOUNT, {
        cardIds: ["ghost", "ghost-2", "ghost-3"],
        projectId: PROJECT,
        wallId,
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardNotFoundError);
  });

  test("a Lock Position card keeps its position while the order changes", async () => {
    const { seam, view, wallId } = await wallWithCards();
    const ids = view.cards.map(({ id }) => id);
    await seam.setCardLock(ACCOUNT, {
      cardId: ids[0] ?? "",
      locked: true,
      projectId: PROJECT,
      wallId,
    });
    const reordered = await seam.reorderCards(ACCOUNT, {
      cardIds: [...ids].reverse(),
      projectId: PROJECT,
      wallId,
    });
    expect(reordered.cards.find(({ id }) => id === ids[0])?.position).toEqual({
      x: 0,
      y: 0,
    });
  });
});

describe("500 visible / 750 link hard scene and 2,000 / 3,000", () => {
  async function seedScene(cards: number, links: number) {
    const ctx = setup(cards);
    const wall = await ctx.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Scene",
    });
    for (let index = 0; index < cards; index += 1) {
      await ctx.store.addCard(ACCOUNT, {
        density: "Compact",
        diagramViewId: null,
        id: `c${index}`,
        placedAt: "2026-01-01T00:00:00.000Z",
        position: { x: (index % 50) * 260, y: Math.floor(index / 50) * 180 },
        projectId: PROJECT,
        sourceId: `bulk-${index}`,
        sourceType: "Work",
        wallId: wall.id,
      });
    }
    for (let index = 0; index < links; index += 1) {
      await ctx.store.addLink(ACCOUNT, {
        fromCardId: `c${index % cards}`,
        id: `l${index}`,
        label: "leads to",
        projectId: PROJECT,
        toCardId: `c${(index * 7 + 1) % cards}`,
        wallId: wall.id,
      });
    }
    return { ...ctx, wallId: wall.id };
  }

  test("500 is not a create cap: a card beyond 500 is placed", async () => {
    const ctx = await seedScene(500, 750);
    const view = await ctx.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: ctx.wallId,
    });
    expect(view.cards).toHaveLength(501);
  });

  test("2,000 cards and 3,000 links stay whole through move, reorder and a viewport save", async () => {
    const ctx = await seedScene(2000, 3000);
    const { seam, wallId } = ctx;
    const loaded = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(loaded.cards).toHaveLength(2000);
    expect(loaded.links).toHaveLength(3000);

    const moved = await seam.moveCards(ACCOUNT, {
      moves: loaded.cards.map(({ id }) => ({
        cardId: id,
        position: { x: 1, y: 2 },
      })),
      projectId: PROJECT,
      wallId,
    });
    expect(moved.cards.every(({ position }) => position.x === 1)).toBe(true);

    const order = loaded.cards.map(({ id }) => id).reverse();
    const reordered = await seam.reorderCards(ACCOUNT, {
      cardIds: order,
      projectId: PROJECT,
      wallId,
    });
    expect(reordered.cards.map(({ id }) => id)).toEqual(order);
    expect(reordered.links).toHaveLength(3000);

    await seam.saveViewport(ACCOUNT, {
      projectId: PROJECT,
      viewport: { center: { x: 0, y: 0 }, collapsed: [], zoom: 0.02 },
      wallId,
    });
    const after = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(after.cards).toHaveLength(2000);
    expect(after.links).toHaveLength(3000);
    expect(after.cards.map(({ source }) => source.recordId).sort()).toEqual(
      loaded.cards.map(({ source }) => source.recordId).sort(),
    );
  }, 60_000);
});
