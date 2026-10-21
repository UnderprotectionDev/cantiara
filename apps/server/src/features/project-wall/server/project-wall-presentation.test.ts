// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import { PROJECT_WALL_COLLECTION_SUMMARY_LIMIT } from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_SNAPSHOT_LABELS,
  projectWallPresentationSequence,
} from "@cantiara/api/project-wall-presentation";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createProjectWall,
  ProjectWallCardNotFoundError,
  ProjectWallGroupNotFoundError,
  ProjectWallSnapshotError,
} from "./project-wall";
import {
  createFakeProjectWallCollections,
  createFakeProjectWallDiagrams,
  createFakeProjectWallRelations,
  createFakeProjectWallStore,
  createFakeSnapshotRenderer,
} from "./project-wall-test-support";

const FROZEN_COPY = /Frozen copy/;
const NOT_A_SHARE_GRANT = /not a share grant/;
const NO_WIDER_SCOPE = /does not widen share scope/;
const SHARE_OR_PUBLISH = /share|publish/i;
const NODE_OR_DIAGRAM = /node|diagram/i;
const NOT_ACTIVE = /not an active/;

const ACCOUNT = "account-1";
const PROJECT = "project-1";

function setup() {
  const memory = createFakeProjectWallStore({
    projects: [{ id: PROJECT, ownerAccountId: ACCOUNT }],
    sources: [
      {
        id: "work-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work",
        status: "In Progress",
        title: "Ship onboarding",
        values: { Key: "CAN-1", Type: "Task" },
      },
      {
        id: "work-2",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work",
        status: "Not Started",
        title: "Write the launch note",
        values: { Key: "CAN-2", Type: "Task" },
      },
    ],
  });
  const diagrams = createFakeProjectWallDiagrams([
    {
      id: "diagram-1",
      model: {
        links: [
          { from: "api", kind: "Reads from", label: "reads", to: "db" },
          { from: "api", kind: "Publishes to", label: null, to: "queue" },
        ],
        nodes: [
          { id: "api", kind: "Service", label: "API" },
          { id: "db", kind: "Datastore", label: "Postgres" },
          { id: "queue", kind: "Queue/Event Bus", label: "Jobs" },
        ],
      },
      ownerAccountId: ACCOUNT,
      projectId: PROJECT,
      title: "Platform architecture",
      versions: [
        {
          authorityMode: "Product-authored Model",
          createdAt: "2026-01-01T00:00:00.000Z",
          diagramId: "diagram-1",
          id: "version-1",
          model: {
            links: [{ from: "api", kind: "Calls", label: null, to: "db" }],
            nodes: [
              { id: "api", kind: "Service", label: "Gateway" },
              { id: "db", kind: "Datastore", label: "Postgres" },
            ],
          },
          name: "Launch",
          number: 1,
          revision: 1,
          type: "Technical Architecture",
        },
      ],
      views: [
        { id: "view-core", name: "Core", selectedNodeIds: ["api", "db"] },
      ],
    },
  ]);
  const collections = createFakeProjectWallCollections([
    {
      id: "view-open",
      name: "Open work",
      ownerAccountId: ACCOUNT,
      projectId: PROJECT,
      works: Array.from({ length: 8 }, (_, index) => ({
        id: `work-${index + 1}`,
        key: `CAN-${index + 1}`,
        status: "Not Started",
        title: `Collected work ${index + 1}`,
      })),
    },
  ]);
  const renderer = createFakeSnapshotRenderer();
  const relations = createFakeProjectWallRelations();
  let sequence = 0;
  const seam = createProjectWall(memory.store, {
    collections: collections.access,
    diagrams: diagrams.access,
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    now: () => new Date("2026-02-01T10:00:00.000Z"),
    relations: relations.relations,
    renderer: renderer.renderer,
  });
  return { ...memory, collections, diagrams, relations, renderer, seam };
}

type Setup = ReturnType<typeof setup>;

async function wallWithCards(
  context: Setup,
  cards: Array<{ sourceId: string; sourceType: "Work" }> = [
    { sourceId: "work-1", sourceType: "Work" },
    { sourceId: "work-2", sourceType: "Work" },
  ],
) {
  let wall = await context.seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Story",
  });
  for (const [index, card] of cards.entries()) {
    wall = await context.seam.addCard(ACCOUNT, {
      ...card,
      position: { x: index * 300, y: 40 },
      projectId: PROJECT,
      wallId: wall.id,
    });
  }
  return wall;
}

describe("Project Wall: Presentation Mode and Focus order are view metadata", () => {
  test("Focus order lists existing cards only and creates no content copy", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    const sourcesBefore = context.sourceSnapshot();
    const itemsBefore = structuredClone(
      context.wallRows().flatMap((row) => row.items),
    );
    const [first, second] = wall.cards;

    const view = await context.seam.setFocusOrder(ACCOUNT, {
      cardIds: [second?.id ?? "", first?.id ?? ""],
      projectId: PROJECT,
      wallId: wall.id,
    });

    expect(view.focusOrder).toEqual([second?.id, first?.id]);
    // Only the order was written: same walls, same cards, same sources.
    expect(context.wallRows()).toHaveLength(1);
    expect(context.wallRows().flatMap((row) => row.items)).toEqual(itemsBefore);
    expect(context.sourceSnapshot()).toEqual(sourcesBefore);
    expect(
      projectWallPresentationSequence(view.cards, view.focusOrder).map(
        ({ id }) => id,
      ),
    ).toEqual([second?.id, first?.id]);
  });

  test("without a Focus order Presentation Mode walks the wall's own cards", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    expect(wall.focusOrder).toEqual([]);
    expect(
      projectWallPresentationSequence(wall.cards, wall.focusOrder),
    ).toEqual(wall.cards);
  });

  test("a Focus order step must be a card of this wall, once", async () => {
    const context = setup();
    const wall = await wallWithCards(context);

    await expect(
      context.seam.setFocusOrder(ACCOUNT, {
        cardIds: ["unknown-card"],
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardNotFoundError);
    await expect(
      context.seam.setFocusOrder(ACCOUNT, {
        cardIds: [wall.cards[0]?.id ?? "", wall.cards[0]?.id ?? ""],
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      context.seam.setFocusOrder(ACCOUNT, {
        cardIds: [],
        extra: "slide body",
        projectId: PROJECT,
        wallId: wall.id,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
  });

  test("removing a card drops its Focus order step; an empty order clears it", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    const ids = wall.cards.map(({ id }) => id);
    await context.seam.setFocusOrder(ACCOUNT, {
      cardIds: ids,
      projectId: PROJECT,
      wallId: wall.id,
    });

    const removed = await context.seam.removeCard(ACCOUNT, {
      cardId: ids[0] ?? "",
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(removed.focusOrder).toEqual([ids[1]]);

    const cleared = await context.seam.setFocusOrder(ACCOUNT, {
      cardIds: [],
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(cleared.focusOrder).toEqual([]);
  });
});

describe("Project Wall: group or region Snapshot is a dated frozen copy", () => {
  test("a snapshot stays as it was while the live card shows the change", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    const cardIds = wall.cards.map(({ id }) => id);

    const output = await context.seam.exportSnapshot(ACCOUNT, {
      cardIds,
      format: "PNG",
      projectId: PROJECT,
      wallId: wall.id,
    });
    context.editSource("Work", "work-1", "Ship onboarding v2");

    const [frozen] = context.renderer.rendered;
    expect(frozen?.cards.map(({ title }) => title)).toContain(
      "Ship onboarding",
    );
    expect(JSON.stringify(frozen)).not.toContain("v2");
    expect(output.files[0]?.mimeType).toBe("image/png");
    expect(output.files[0]?.fileName).toContain("2026-02-01");
    expect(output.generatedAt).toBe("2026-02-01T10:00:00.000Z");

    const live = await context.seam.get(ACCOUNT, PROJECT, wall.id);
    expect(live.cards[0]?.source.title).toBe("Ship onboarding v2");
  });

  test("a group snapshot exports PDF of that group's cards only", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    const grouped = await context.seam.createGroup(ACCOUNT, {
      projectId: PROJECT,
      title: "Launch",
      wallId: wall.id,
    });
    const [group] = grouped.groups;
    await context.seam.setCardGroup(ACCOUNT, {
      cardId: wall.cards[0]?.id ?? "",
      groupId: group?.id ?? null,
      projectId: PROJECT,
      wallId: wall.id,
    });

    const output = await context.seam.exportSnapshot(ACCOUNT, {
      format: "PDF",
      groupId: group?.id,
      projectId: PROJECT,
      wallId: wall.id,
    });

    expect(output.files[0]?.mimeType).toBe("application/pdf");
    expect(output.files[0]?.fileName.endsWith(".pdf")).toBe(true);
    expect(context.renderer.rendered[0]?.cards).toHaveLength(1);
    expect(context.renderer.rendered[0]?.scopeLabel).toContain("Launch");
  });

  test("the Preview names a Frozen copy that is not a share grant", async () => {
    const context = setup();
    const wall = await wallWithCards(context);

    const preview = await context.seam.previewSnapshot(ACCOUNT, {
      cardIds: wall.cards.map(({ id }) => id),
      projectId: PROJECT,
      wallId: wall.id,
    });

    expect(preview.notices).toContain(
      PROJECT_WALL_SNAPSHOT_LABELS.frozenCopyNotice,
    );
    expect(PROJECT_WALL_SNAPSHOT_LABELS.frozenCopyNotice).toMatch(FROZEN_COPY);
    expect(PROJECT_WALL_SNAPSHOT_LABELS.frozenCopyNotice).toMatch(
      NOT_A_SHARE_GRANT,
    );
    expect(PROJECT_WALL_SNAPSHOT_LABELS.frozenCopyNotice).toMatch(
      NO_WIDER_SCOPE,
    );
    expect(preview.cardCount).toBe(2);
    expect(preview.moment).toContain("2026-02-01");
  });

  test("a snapshot writes no share grant, locks nothing and live cards keep working", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    const wallsBefore = context.wallRows();
    const sourcesBefore = context.sourceSnapshot();

    await context.seam.previewSnapshot(ACCOUNT, {
      cardIds: wall.cards.map(({ id }) => id),
      projectId: PROJECT,
      wallId: wall.id,
    });
    await context.seam.exportSnapshot(ACCOUNT, {
      cardIds: wall.cards.map(({ id }) => id),
      format: "PDF",
      projectId: PROJECT,
      wallId: wall.id,
    });

    // No wall row, share scope, lock or relation changed.
    expect(context.wallRows()).toEqual(wallsBefore);
    expect(context.sourceSnapshot()).toEqual(sourcesBefore);
    expect(context.relations.rows()).toEqual([]);
    // The seam has no sharing dependency at all: nothing could receive a grant.
    expect(
      Object.keys(context.seam).some((key) => SHARE_OR_PUBLISH.test(key)),
    ).toBe(false);

    const moved = await context.seam.moveCards(ACCOUNT, {
      moves: [{ cardId: wall.cards[0]?.id ?? "", position: { x: 7, y: 9 } }],
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(moved.cards[0]?.position).toEqual({ x: 7, y: 9 });
    expect(moved.cards.every((card) => !card.locked)).toBe(true);
  });

  test("the static output carries no live link", async () => {
    const context = setup();
    const wall = await wallWithCards(context);
    await context.seam.exportSnapshot(ACCOUNT, {
      cardIds: wall.cards.map(({ id }) => id),
      format: "PNG",
      projectId: PROJECT,
      wallId: wall.id,
    });
    const text = JSON.stringify(context.renderer.rendered[0]);
    expect(text).not.toContain("/projects/");
    expect(text).not.toContain("http");
  });

  test("a snapshot needs exactly one scope that exists on the wall", async () => {
    const context = setup();
    const wall = await wallWithCards(context);

    await expect(
      context.seam.previewSnapshot(ACCOUNT, {
        projectId: PROJECT,
        wallId: wall.id,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      context.seam.previewSnapshot(ACCOUNT, {
        cardIds: [wall.cards[0]?.id ?? ""],
        groupId: "group",
        projectId: PROJECT,
        wallId: wall.id,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      context.seam.previewSnapshot(ACCOUNT, {
        groupId: "missing-group",
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ProjectWallGroupNotFoundError);
    const emptyGroup = await context.seam.createGroup(ACCOUNT, {
      projectId: PROJECT,
      title: "Empty",
      wallId: wall.id,
    });
    await expect(
      context.seam.previewSnapshot(ACCOUNT, {
        groupId: emptyGroup.groups[0]?.id,
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ProjectWallSnapshotError);
    await expect(
      context.seam.previewSnapshot(ACCOUNT, {
        cardIds: ["unknown"],
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardNotFoundError);
  });
});

describe("Project Wall: read-only Technical Diagram card", () => {
  test("shows a live preview of the selected Diagram View, labeled Live", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Architecture",
    });

    const view = await context.seam.addCard(ACCOUNT, {
      diagramViewId: "view-core",
      projectId: PROJECT,
      sourceId: "diagram-1",
      sourceType: "Technical Diagram",
      wallId: wall.id,
    });

    const [card] = view.cards;
    expect(card?.source.recordId).toBe("diagram-1");
    expect(card?.source.title).toBe("Platform architecture");
    expect(card?.source.openPath).toBe(
      `/projects/${PROJECT}#technical-diagram-diagram-1`,
    );
    expect(card?.preview).toMatchObject({
      kind: "Technical Diagram",
      pin: "Live",
      viewName: "Core",
    });
    if (card?.preview?.kind !== "Technical Diagram") {
      throw new Error("Expected a Technical Diagram preview.");
    }
    expect(card.preview.nodes.map(({ id }) => id)).toEqual(["api", "db"]);
    expect(card.preview.links).toEqual([
      { from: "api", label: "reads", to: "db" },
    ]);
  });

  test("the diagram changes only through its own feature and the wall exposes no edit", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Architecture",
    });
    await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "diagram-1",
      sourceType: "Technical Diagram",
      wallId: wall.id,
    });
    const diagramBefore = context.diagrams.snapshot();

    // Moving and restyling the card never reaches the diagram.
    const [card] = (await context.seam.get(ACCOUNT, PROJECT, wall.id)).cards;
    await context.seam.moveCards(ACCOUNT, {
      moves: [{ cardId: card?.id ?? "", position: { x: 3, y: 4 } }],
      projectId: PROJECT,
      wallId: wall.id,
    });
    await context.seam.setCardDensity(ACCOUNT, {
      cardId: card?.id ?? "",
      density: "Detailed",
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(context.diagrams.snapshot()).toEqual(diagramBefore);

    // The seam the wall holds can only read a diagram.
    expect(Object.keys(context.diagrams.access).sort()).toEqual([
      "get",
      "getVersion",
      "list",
      "listViews",
    ]);
    // Node editing is not part of the wall interface or its card inputs.
    expect(
      Object.keys(context.seam).some((key) => NODE_OR_DIAGRAM.test(key)),
    ).toBe(false);
    await expect(
      context.seam.addCard(ACCOUNT, {
        model: { links: [], nodes: [] },
        projectId: PROJECT,
        sourceId: "diagram-1",
        sourceType: "Technical Diagram",
        wallId: wall.id,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);

    // A diagram edit by its own feature shows on the live card.
    context.diagrams.rename("diagram-1", "Platform architecture v2");
    const live = await context.seam.get(ACCOUNT, PROJECT, wall.id);
    expect(live.cards[0]?.source.title).toBe("Platform architecture v2");
  });

  test("an exact pin reads the Diagram Version, is labeled Exact and ignores later live edits", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Architecture",
    });
    const added = await context.seam.addCard(ACCOUNT, {
      diagramViewId: "view-core",
      projectId: PROJECT,
      sourceId: "diagram-1",
      sourceType: "Technical Diagram",
      wallId: wall.id,
    });
    const cardId = added.cards[0]?.id ?? "";
    const diagramBefore = context.diagrams.snapshot();

    const pinned = await context.seam.setCardPin(ACCOUNT, {
      cardId,
      diagramVersionId: "version-1",
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(pinned.cards[0]?.preview).toMatchObject({
      pin: "Exact",
      versionId: "version-1",
      versionName: "Launch",
      versionNumber: 1,
      viewName: "Core",
    });

    // A live edit never reaches the Exact card; the checkpoint is what shows.
    context.diagrams.editModel("diagram-1", { links: [], nodes: [] });
    const later = await context.seam.get(ACCOUNT, PROJECT, wall.id);
    const preview = later.cards[0]?.preview;
    if (preview?.kind !== "Technical Diagram") {
      throw new Error("Expected a Technical Diagram preview.");
    }
    expect(preview.pin).toBe("Exact");
    expect(preview.nodes.map(({ label }) => label)).toEqual([
      "Gateway",
      "Postgres",
    ]);
    // Pinning is wall view state: the diagram and its checkpoints are untouched.
    expect(context.diagrams.snapshot()[0]?.versions).toEqual(
      diagramBefore[0]?.versions,
    );

    // Unpinning returns the card to Live with the live model.
    const live = await context.seam.setCardPin(ACCOUNT, {
      cardId,
      diagramVersionId: null,
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(live.cards[0]?.preview).toMatchObject({
      pin: "Live",
      versionId: null,
    });
  });

  test("a pin must be a checkpoint of this very diagram and only a Technical Diagram card takes one", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Architecture",
    });
    const added = await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "diagram-1",
      sourceType: "Technical Diagram",
      wallId: wall.id,
    });
    await expect(
      context.seam.setCardPin(ACCOUNT, {
        cardId: added.cards[0]?.id ?? "",
        diagramVersionId: "no-such-version",
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toThrow(NOT_ACTIVE);
    await expect(
      context.seam.addCard(ACCOUNT, {
        diagramVersionId: "version-1",
        projectId: PROJECT,
        sourceId: "work-1",
        sourceType: "Work",
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    const exact = await context.seam.addCard(ACCOUNT, {
      diagramVersionId: "version-1",
      projectId: PROJECT,
      sourceId: "diagram-1",
      sourceType: "Technical Diagram",
      wallId: (
        await context.seam.create(ACCOUNT, {
          projectId: PROJECT,
          title: "Second",
        })
      ).id,
    });
    expect(exact.cards[0]?.preview).toMatchObject({ pin: "Exact" });
  });

  test("a diagram of another Project or a missing view cannot become a card", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Architecture",
    });
    await expect(
      context.seam.addCard(ACCOUNT, {
        diagramViewId: "no-such-view",
        projectId: PROJECT,
        sourceId: "diagram-1",
        sourceType: "Technical Diagram",
        wallId: wall.id,
      }),
    ).rejects.toThrow(NOT_ACTIVE);
    await expect(
      context.seam.addCard(ACCOUNT, {
        diagramViewId: "view-core",
        projectId: PROJECT,
        sourceId: "work-1",
        sourceType: "Work",
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("Project Wall: Smart Collection summary block", () => {
  test("shows a limited live summary and Open all in source, with no query of its own", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Backlog",
    });

    const view = await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "view-open",
      sourceType: "Smart Collection",
      wallId: wall.id,
    });

    const [card] = view.cards;
    if (card?.preview?.kind !== "Smart Collection") {
      throw new Error("Expected a Smart Collection preview.");
    }
    expect(card.preview.total).toBe(8);
    expect(card.preview.items).toHaveLength(
      PROJECT_WALL_COLLECTION_SUMMARY_LIMIT,
    );
    expect(card.preview.limit).toBe(PROJECT_WALL_COLLECTION_SUMMARY_LIMIT);
    expect(card.preview.openAllPath).toBe(
      `/projects/${PROJECT}#smart-collection-view-view-open`,
    );
    // The summary is read through the Smart Collections feature, read only.
    expect(context.collections.calls.every((call) => call.readOnly)).toBe(true);
    expect(Object.keys(context.collections.access).sort()).toEqual([
      "getView",
      "listViews",
    ]);
    // The wall row holds a reference, never members or a query.
    expect(context.wallRows()[0]?.items[0]).toMatchObject({
      sourceId: "view-open",
      sourceType: "Smart Collection",
    });
    expect(Object.keys(context.wallRows()[0]?.items[0] ?? {}).sort()).toEqual([
      "density",
      "diagramVersionId",
      "diagramViewId",
      "groupId",
      "highlight",
      "id",
      "locked",
      "placedAt",
      "position",
      "sourceId",
      "sourceType",
    ]);
  });

  test("the summary follows the collection's membership live", async () => {
    const context = setup();
    const wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Backlog",
    });
    await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "view-open",
      sourceType: "Smart Collection",
      wallId: wall.id,
    });
    context.collections.removeWork("view-open", "work-3");

    const live = await context.seam.get(ACCOUNT, PROJECT, wall.id);
    expect(live.cards[0]?.preview).toMatchObject({ total: 7 });
  });

  test("calls out a Shared source when a record is a card and inside the summary", async () => {
    const context = setup();
    let wall = await context.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Backlog",
    });
    wall = await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });
    wall = await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "view-open",
      sourceType: "Smart Collection",
      wallId: wall.id,
    });

    const workCard = wall.cards.find((card) => card.sourceType === "Work");
    const block = wall.cards.find(
      (card) => card.sourceType === "Smart Collection",
    );
    expect(workCard?.sharedSource).toBe(true);
    if (block?.preview?.kind !== "Smart Collection") {
      throw new Error("Expected a Smart Collection preview.");
    }
    const shared = block.preview.items.filter((item) => item.sharedWithCard);
    expect(shared.map(({ id }) => id)).toEqual(["work-1"]);
    // Still one record: both point at the same source id, no copy.
    expect(workCard?.source.recordId).toBe("work-1");
    expect(wall.cards).toHaveLength(2);
  });

  test("without a shared record there is no callout", async () => {
    const context = setup();
    const wall = await wallWithCards(context, [
      { sourceId: "work-2", sourceType: "Work" },
    ]);
    const withBlock = await context.seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "view-open",
      sourceType: "Smart Collection",
      wallId: wall.id,
    });
    // work-2 is in the collection (work-1..8): shared. Remove it and re-check.
    context.collections.removeWork("view-open", "work-2");
    const live = await context.seam.get(ACCOUNT, PROJECT, withBlock.id);
    expect(
      live.cards.find((card) => card.sourceType === "Work")?.sharedSource,
    ).toBe(false);
  });

  test("source options list diagrams per view and Smart Collections", async () => {
    const context = setup();
    const options = await context.seam.sourceOptions(ACCOUNT, PROJECT);
    expect(options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          diagramViewId: "view-core",
          id: "diagram-1",
          sourceType: "Technical Diagram",
        }),
        expect.objectContaining({
          id: "view-open",
          sourceType: "Smart Collection",
          title: "Open work",
        }),
      ]),
    );
  });
});
