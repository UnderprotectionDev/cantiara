// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import {
  PROJECT_WALL_COLLECTION_SUMMARY_LIMIT,
  PROJECT_WALL_DENSITIES,
  PROJECT_WALL_DENSITY_FIELDS,
  PROJECT_WALL_HIGHLIGHTS,
} from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_SNAPSHOT_LABELS,
  projectWallPresentationSequence,
} from "@cantiara/api/project-wall-presentation";
import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";
import {
  createProjectWall,
  ProjectWallCardDuplicateError,
  ProjectWallCardNotFoundError,
  ProjectWallGroupNotFoundError,
  ProjectWallLinkNotFoundError,
  ProjectWallNotFoundError,
  ProjectWallProjectNotFoundError,
  ProjectWallProjectReadOnlyError,
  ProjectWallRelationPreviewRequiredError,
  ProjectWallSkeletonNotSelectedError,
  ProjectWallSnapshotError,
  ProjectWallSourceUnavailableError,
} from "../project-wall";
import {
  createFakeProjectWallCollections,
  createFakeProjectWallDiagrams,
  createFakeProjectWallRelations,
  createFakeProjectWallStore,
  createFakeSnapshotRenderer,
} from "./project-wall-test-support";

const ACCOUNT = "account-1";
const STRANGER = "account-2";
const PROJECT = "project-1";
const OTHER_PROJECT = "project-2";

function setup() {
  const memory = createFakeProjectWallStore({
    projects: [
      { id: PROJECT, ownerAccountId: ACCOUNT },
      { id: OTHER_PROJECT, ownerAccountId: ACCOUNT },
      { archived: true, id: "project-archived", ownerAccountId: ACCOUNT },
    ],
    sources: [
      {
        id: "work-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work",
        status: "In Progress",
        title: "Ship onboarding",
        values: {
          Description: "Walk a new founder through the first Project.",
          Key: "CAN-1",
          Type: "Task",
        },
      },
      {
        id: "decision-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Decision",
        status: "Valid",
        title: "Use a flat wall",
        values: { Decision: "Walls never nest." },
      },
      {
        id: "risk-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Risk",
        status: "Open",
        title: "Scope creep",
        values: { Impact: "High", Probability: "Medium" },
      },
      {
        id: "work-other",
        ownerAccountId: ACCOUNT,
        projectId: OTHER_PROJECT,
        sourceType: "Work",
        status: "Not Started",
        title: "Other Project work",
      },
      {
        id: "work-archived",
        archived: true,
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work",
        status: "Done",
        title: "Archived work",
      },
    ],
  });
  let sequence = 0;
  const seam = createProjectWall(memory.store, {
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    now: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  return { ...memory, seam };
}

async function newWall(
  seam: ReturnType<typeof setup>["seam"],
  title = "Story",
) {
  return await seam.create(ACCOUNT, { projectId: PROJECT, title });
}

describe("Project Wall: flat, named, Project-scoped walls", () => {
  test("a Project keeps several named walls with no nesting", async () => {
    const { seam } = setup();
    const first = await newWall(seam, "Launch story");
    const second = await newWall(seam, "Onboarding story");

    expect(first.title).toBe("Launch story");
    expect(first.projectId).toBe(PROJECT);
    expect(first.id).not.toBe(second.id);
    expect(await seam.list(ACCOUNT, PROJECT)).toEqual([
      expect.objectContaining({ cardCount: 0, title: "Launch story" }),
      expect.objectContaining({ cardCount: 0, title: "Onboarding story" }),
    ]);
    expect(await seam.list(ACCOUNT, OTHER_PROJECT)).toEqual([]);
  });

  test("a wall cannot be nested or owned by a Workspace", async () => {
    const { seam } = setup();
    const parent = await newWall(seam);

    await expect(
      seam.create(ACCOUNT, {
        parentWallId: parent.id,
        projectId: PROJECT,
        title: "Child",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.create(ACCOUNT, {
        title: "Workspace wall",
        workspaceId: "workspace-1",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    expect(await seam.list(ACCOUNT, PROJECT)).toHaveLength(1);
  });

  test("a wall needs a name and can be renamed or deleted", async () => {
    const { seam } = setup();
    await expect(
      seam.create(ACCOUNT, { projectId: PROJECT, title: "   " }),
    ).rejects.toBeInstanceOf(ZodError);
    const wall = await newWall(seam);

    const renamed = await seam.rename(ACCOUNT, {
      projectId: PROJECT,
      title: "Renamed",
      wallId: wall.id,
    });
    expect(renamed.title).toBe("Renamed");

    await seam.delete(ACCOUNT, PROJECT, wall.id);
    await expect(seam.get(ACCOUNT, PROJECT, wall.id)).rejects.toBeInstanceOf(
      ProjectWallNotFoundError,
    );
  });

  test("another account and an unknown Project see no wall", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);

    await expect(seam.get(STRANGER, PROJECT, wall.id)).rejects.toBeInstanceOf(
      ProjectWallNotFoundError,
    );
    await expect(seam.list(STRANGER, PROJECT)).rejects.toBeInstanceOf(
      ProjectWallProjectNotFoundError,
    );
    await expect(
      seam.create(ACCOUNT, { projectId: "nope", title: "X" }),
    ).rejects.toBeInstanceOf(ProjectWallProjectNotFoundError);
  });

  test("an archived Project is read-only", async () => {
    const { seam } = setup();
    await expect(
      seam.create(ACCOUNT, { projectId: "project-archived", title: "X" }),
    ).rejects.toBeInstanceOf(ProjectWallProjectReadOnlyError);
  });
});

describe("Project Wall: live card identity equals the source id", () => {
  test("a card keeps the source id and type and creates no copy record", async () => {
    const { seam, sourceSnapshot } = setup();
    const sourcesBefore = sourceSnapshot();
    const wall = await newWall(seam);

    const view = await seam.addCard(ACCOUNT, {
      position: { x: 40, y: 80 },
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });

    expect(view.cards).toHaveLength(1);
    const [card] = view.cards;
    expect(card?.source.recordId).toBe("work-1");
    expect(card?.sourceType).toBe("Work");
    expect(card?.source.title).toBe("Ship onboarding");
    expect(card?.source.openPath).toBe(`/projects/${PROJECT}#work-work-1`);
    expect(card?.position).toEqual({ x: 40, y: 80 });
    expect(card?.density).toBe("Preview");
    expect(sourceSnapshot()).toEqual(sourcesBefore);
  });

  test("the same record is a card on many walls and shows one live title", async () => {
    const { editSource, seam } = setup();
    const first = await newWall(seam, "One");
    const second = await newWall(seam, "Two");
    for (const wall of [first, second]) {
      await seam.addCard(ACCOUNT, {
        projectId: PROJECT,
        sourceId: "decision-1",
        sourceType: "Decision",
        wallId: wall.id,
      });
    }

    editSource("Decision", "decision-1", "Use flat walls");

    for (const wall of [first, second]) {
      const view = await seam.get(ACCOUNT, PROJECT, wall.id);
      expect(view.cards[0]?.source.recordId).toBe("decision-1");
      expect(view.cards[0]?.source.title).toBe("Use flat walls");
    }
  });

  test("one record is one card per wall", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    const input = {
      projectId: PROJECT,
      sourceId: "risk-1",
      sourceType: "Risk",
      wallId: wall.id,
    } as const;
    await seam.addCard(ACCOUNT, input);
    await expect(seam.addCard(ACCOUNT, input)).rejects.toBeInstanceOf(
      ProjectWallCardDuplicateError,
    );
  });

  test("only an active record of the same Project can become a card", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    for (const sourceId of ["work-other", "work-archived", "missing"]) {
      await expect(
        seam.addCard(ACCOUNT, {
          projectId: PROJECT,
          sourceId,
          sourceType: "Work",
          wallId: wall.id,
        }),
      ).rejects.toBeInstanceOf(ProjectWallSourceUnavailableError);
    }
    expect((await seam.get(ACCOUNT, PROJECT, wall.id)).cards).toEqual([]);
  });

  test("a permanently deleted source is a broken target, not a copy", async () => {
    const { removeSource, seam } = setup();
    const wall = await newWall(seam);
    await seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });
    removeSource("Work", "work-1");

    const [card] = (await seam.get(ACCOUNT, PROJECT, wall.id)).cards;
    expect(card?.source.recordId).toBe("work-1");
    expect(card?.source.title).toBeNull();
    expect(card?.source.broken?.reason).toBe("Permanently deleted");
    expect(card?.source.openPath).toBeNull();
    expect(card?.fields).toEqual([]);
  });
});

describe("Project Wall: layout and density never write the source", () => {
  test("move, density, highlight and remove leave every source record unchanged", async () => {
    const { seam, sourceSnapshot } = setup();
    const wall = await newWall(seam);
    for (const [sourceType, sourceId] of [
      ["Work", "work-1"],
      ["Decision", "decision-1"],
      ["Risk", "risk-1"],
    ] as const) {
      await seam.addCard(ACCOUNT, {
        projectId: PROJECT,
        sourceId,
        sourceType,
        wallId: wall.id,
      });
    }
    const sourcesBefore = sourceSnapshot();
    const [work, decision] = (await seam.get(ACCOUNT, PROJECT, wall.id)).cards;

    const moved = await seam.moveCards(ACCOUNT, {
      moves: [
        { cardId: work?.id ?? "", position: { x: 300, y: -20 } },
        { cardId: decision?.id ?? "", position: { x: 10, y: 10 } },
      ],
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(moved.cards[0]?.position).toEqual({ x: 300, y: -20 });
    expect(moved.cards[1]?.position).toEqual({ x: 10, y: 10 });

    const dense = await seam.setCardDensity(ACCOUNT, {
      cardId: work?.id ?? "",
      density: "Detailed",
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(dense.cards[0]?.density).toBe("Detailed");

    const lit = await seam.setCardHighlight(ACCOUNT, {
      cardId: work?.id ?? "",
      highlight: "amber",
      projectId: PROJECT,
      wallId: wall.id,
    });
    expect(lit.cards[0]?.highlight).toBe("amber");

    await seam.removeCard(ACCOUNT, {
      cardId: decision?.id ?? "",
      projectId: PROJECT,
      wallId: wall.id,
    });
    await seam.delete(ACCOUNT, PROJECT, wall.id);

    expect(sourceSnapshot()).toEqual(sourcesBefore);
  });

  test("density never changes the source status; highlight is not a status", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    const view = await seam.addCard(ACCOUNT, {
      density: "Compact",
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });
    const cardId = view.cards[0]?.id ?? "";
    for (const density of PROJECT_WALL_DENSITIES) {
      const next = await seam.setCardDensity(ACCOUNT, {
        cardId,
        density,
        projectId: PROJECT,
        wallId: wall.id,
      });
      expect(next.cards[0]?.source.status).toBe("In Progress");
    }
    await seam.setCardHighlight(ACCOUNT, {
      cardId,
      highlight: "red",
      projectId: PROJECT,
      wallId: wall.id,
    });
    const after = await seam.get(ACCOUNT, PROJECT, wall.id);
    expect(after.cards[0]?.source.status).toBe("In Progress");
  });

  test("an unknown card is refused and nothing moves", async () => {
    const { seam, wallRows } = setup();
    const wall = await newWall(seam);
    const before = wallRows();
    await expect(
      seam.moveCards(ACCOUNT, {
        moves: [{ cardId: "nope", position: { x: 1, y: 1 } }],
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardNotFoundError);
    expect(wallRows()).toEqual(before);
  });

  test("the highlight palette and densities are closed", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    const view = await seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });
    const cardId = view.cards[0]?.id ?? "";
    expect(PROJECT_WALL_HIGHLIGHTS.length).toBeLessThanOrEqual(6);
    await expect(
      seam.setCardHighlight(ACCOUNT, {
        cardId,
        highlight: "#ff00ff" as never,
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.setCardDensity(ACCOUNT, {
        cardId,
        density: "Huge" as never,
        projectId: PROJECT,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});

describe("Project Wall: no wall-only content", () => {
  test("a card takes no note, task, file, title or custom style", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    for (const extra of [
      { note: "wall-only note" },
      { title: "Wall-only task" },
      { fileAttachmentId: "file-1" },
      { css: "color: red" },
      { fields: ["Status"] },
    ]) {
      await expect(
        seam.addCard(ACCOUNT, {
          projectId: PROJECT,
          sourceId: "work-1",
          sourceType: "Work",
          wallId: wall.id,
          ...extra,
        } as never),
      ).rejects.toBeInstanceOf(ZodError);
    }
    await expect(
      seam.addCard(ACCOUNT, {
        projectId: PROJECT,
        sourceId: "free-text",
        sourceType: "Note" as never,
        wallId: wall.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    expect((await seam.get(ACCOUNT, PROJECT, wall.id)).cards).toEqual([]);
  });

  test("a stored card holds only the reference and view state", async () => {
    const { seam, wallRows } = setup();
    const wall = await newWall(seam);
    await seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });
    const [row] = wallRows();
    expect(Object.keys(row?.items[0] ?? {}).sort()).toEqual([
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
});

describe("Project Wall: product-chosen fields per density", () => {
  test("Compact, Preview and Detailed read the fields the product chose", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    const view = await seam.addCard(ACCOUNT, {
      density: "Compact",
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: wall.id,
    });
    const cardId = view.cards[0]?.id ?? "";
    const names = async (density: "Compact" | "Detailed" | "Preview") => {
      const next = await seam.setCardDensity(ACCOUNT, {
        cardId,
        density,
        projectId: PROJECT,
        wallId: wall.id,
      });
      return next.cards[0]?.fields.map(({ name }) => name);
    };
    expect(await names("Compact")).toEqual(["Key"]);
    expect(await names("Preview")).toEqual(["Key", "Status", "Type"]);
    expect(await names("Detailed")).toEqual([
      "Key",
      "Status",
      "Type",
      "Description",
    ]);
    expect(PROJECT_WALL_DENSITY_FIELDS.Work.Detailed).toEqual([
      "Key",
      "Status",
      "Type",
      "Description",
    ]);
  });

  test("Decision and Risk cards read their own fields live", async () => {
    const { seam } = setup();
    const wall = await newWall(seam);
    await seam.addCard(ACCOUNT, {
      density: "Detailed",
      projectId: PROJECT,
      sourceId: "decision-1",
      sourceType: "Decision",
      wallId: wall.id,
    });
    const view = await seam.addCard(ACCOUNT, {
      density: "Detailed",
      projectId: PROJECT,
      sourceId: "risk-1",
      sourceType: "Risk",
      wallId: wall.id,
    });
    expect(view.cards[0]?.fields).toEqual([
      { name: "Status", value: "Valid" },
      { name: "Decision", value: "Walls never nest." },
    ]);
    expect(view.cards[1]?.fields).toEqual([
      { name: "Status", value: "Open" },
      { name: "Probability", value: "Medium" },
      { name: "Impact", value: "High" },
    ]);
  });
});

describe("Project Wall: source options", () => {
  test("lists only active records of this Project", async () => {
    const { seam } = setup();
    const options = await seam.sourceOptions(ACCOUNT, PROJECT);
    expect(options.map(({ id }) => id).sort()).toEqual([
      "decision-1",
      "risk-1",
      "work-1",
    ]);
  });
});

function setupProjectWallLinks() {
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
        id: "decision-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Decision",
        status: "Valid",
        title: "Use a flat wall",
      },
      {
        id: "risk-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Risk",
        status: "Open",
        title: "Scope creep",
      },
    ],
  });
  const relations = createFakeProjectWallRelations();
  let sequence = 0;
  const seam = createProjectWall(memory.store, {
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    relations: relations.relations,
  });
  return { ...memory, relations, seam };
}

type Seam = ReturnType<typeof setupProjectWallLinks>["seam"];

/** A wall with a Work card and a Decision card, ready for a Visual link. */
async function wallWithTwoCards(seam: Seam) {
  const wall = await seam.create(ACCOUNT, {
    projectId: PROJECT,
    title: "Story",
  });
  await seam.addCard(ACCOUNT, {
    projectId: PROJECT,
    sourceId: "work-1",
    sourceType: "Work",
    wallId: wall.id,
  });
  const view = await seam.addCard(ACCOUNT, {
    position: { x: 300, y: 0 },
    projectId: PROJECT,
    sourceId: "decision-1",
    sourceType: "Decision",
    wallId: wall.id,
  });
  const [from, to] = view.cards;
  if (!(from && to)) {
    throw new Error("Two cards expected.");
  }
  return { from, to, wallId: wall.id };
}

async function drawn(seam: Seam) {
  const { from, to, wallId } = await wallWithTwoCards(seam);
  const view = await seam.drawLink(ACCOUNT, {
    fromCardId: from.id,
    label: "informs",
    projectId: PROJECT,
    toCardId: to.id,
    wallId,
  });
  const [link] = view.links;
  if (!link) {
    throw new Error("Link expected.");
  }
  return { from, link, to, wallId };
}

const ENVELOPE = { baseRevision: 0, clientIdempotencyKey: "key-12345678" };

describe("Project Wall: a Visual link is not a relation", () => {
  test("drawing a directed labeled line writes no relation row", async () => {
    const { relations, seam, sourceSnapshot } = setupProjectWallLinks();
    const sourcesBefore = sourceSnapshot();
    const { from, to, wallId } = await wallWithTwoCards(seam);

    const view = await seam.drawLink(ACCOUNT, {
      fromCardId: from.id,
      label: "  informs  ",
      projectId: PROJECT,
      toCardId: to.id,
      wallId,
    });

    expect(view.links).toEqual([
      {
        fromCardId: from.id,
        id: expect.any(String),
        label: "informs",
        toCardId: to.id,
      },
    ]);
    expect(relations.rows()).toEqual([]);
    expect(relations.calls).toEqual({ create: 0, preview: 0 });
    expect(sourceSnapshot()).toEqual(sourcesBefore);
  });

  test("a line needs a label, two different cards of this wall and nothing else", async () => {
    const { seam } = setupProjectWallLinks();
    const { from, to, wallId } = await wallWithTwoCards(seam);
    const base = { projectId: PROJECT, wallId };

    await expect(
      seam.drawLink(ACCOUNT, {
        ...base,
        fromCardId: from.id,
        label: "  ",
        toCardId: to.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.drawLink(ACCOUNT, {
        ...base,
        fromCardId: from.id,
        label: "loop",
        toCardId: from.id,
      }),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.drawLink(ACCOUNT, {
        ...base,
        fromCardId: from.id,
        label: "x",
        relationKind: "Blocks",
        toCardId: to.id,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.drawLink(ACCOUNT, {
        ...base,
        fromCardId: from.id,
        label: "x",
        toCardId: "ghost",
      }),
    ).rejects.toBeInstanceOf(ProjectWallCardNotFoundError);
  });

  test("Unbind removes only the line", async () => {
    const { relations, seam, sourceSnapshot } = setupProjectWallLinks();
    const sourcesBefore = sourceSnapshot();
    const { link, wallId } = await drawn(seam);

    const view = await seam.unbindLink(ACCOUNT, {
      linkId: link.id,
      projectId: PROJECT,
      wallId,
    });

    expect(view.links).toEqual([]);
    expect(view.cards).toHaveLength(2);
    expect(relations.rows()).toEqual([]);
    expect(sourceSnapshot()).toEqual(sourcesBefore);
    await expect(
      seam.unbindLink(ACCOUNT, {
        linkId: link.id,
        projectId: PROJECT,
        wallId,
      }),
    ).rejects.toBeInstanceOf(ProjectWallLinkNotFoundError);
  });

  test("removing a card removes the lines that touch it", async () => {
    const { seam } = setupProjectWallLinks();
    const { from, wallId } = await drawn(seam);
    const view = await seam.removeCard(ACCOUNT, {
      cardId: from.id,
      projectId: PROJECT,
      wallId,
    });
    expect(view.links).toEqual([]);
  });
});

describe("Project Wall: Create Persistent Relation needs a preview", () => {
  test("preview names the catalog relation from the line direction and writes nothing", async () => {
    const { relations, seam } = setupProjectWallLinks();
    const { link, wallId } = await drawn(seam);

    const preview = await seam.previewPersistentRelation(ACCOUNT, {
      kind: "Related",
      linkId: link.id,
      projectId: PROJECT,
      wallId,
    });

    expect(preview.linkId).toBe(link.id);
    expect(preview.relation.kind).toBe("Related");
    expect(preview.relation.source).toMatchObject({
      recordId: "work-1",
      recordType: "Work",
    });
    expect(preview.relation.target).toMatchObject({
      recordId: "decision-1",
      recordType: "Decision",
    });
    expect(relations.rows()).toEqual([]);
    expect(relations.calls.create).toBe(0);
  });

  test("confirming with the previewed id writes exactly one relation", async () => {
    const { relations, seam } = setupProjectWallLinks();
    const { link, wallId } = await drawn(seam);
    const { relation } = await seam.previewPersistentRelation(ACCOUNT, {
      kind: "Related",
      linkId: link.id,
      projectId: PROJECT,
      wallId,
    });

    await seam.createPersistentRelation(ACCOUNT, {
      ...ENVELOPE,
      kind: "Related",
      linkId: link.id,
      previewId: relation.previewId,
      projectId: PROJECT,
      wallId,
    });

    expect(relations.rows()).toEqual([
      {
        kind: "Related",
        source: { recordId: "work-1", recordType: "Work" },
        target: { recordId: "decision-1", recordType: "Decision" },
      },
    ]);
  });

  test("a missing, stale or foreign preview id writes nothing", async () => {
    const { relations, seam } = setupProjectWallLinks();
    const { link, wallId } = await drawn(seam);
    const base = {
      ...ENVELOPE,
      kind: "Related" as const,
      linkId: link.id,
      projectId: PROJECT,
      wallId,
    };

    await expect(
      seam.createPersistentRelation(ACCOUNT, base as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.createPersistentRelation(ACCOUNT, {
        ...base,
        previewId: "Blocks|Work|work-1|Decision|decision-1",
      }),
    ).rejects.toBeInstanceOf(ProjectWallRelationPreviewRequiredError);
    await expect(
      seam.createPersistentRelation(ACCOUNT, {
        ...base,
        linkId: "ghost",
        previewId: "Related|Work|work-1|Decision|decision-1",
      }),
    ).rejects.toBeInstanceOf(ProjectWallLinkNotFoundError);

    expect(relations.rows()).toEqual([]);
    expect(relations.calls.create).toBe(0);
  });

  test("the line stays wall narrative after the relation is written", async () => {
    const { seam } = setupProjectWallLinks();
    const { link, wallId } = await drawn(seam);
    const { relation } = await seam.previewPersistentRelation(ACCOUNT, {
      kind: "Related",
      linkId: link.id,
      projectId: PROJECT,
      wallId,
    });
    await seam.createPersistentRelation(ACCOUNT, {
      ...ENVELOPE,
      kind: "Related",
      linkId: link.id,
      previewId: relation.previewId,
      projectId: PROJECT,
      wallId,
    });

    const view = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(view.links.map(({ id }) => id)).toEqual([link.id]);
  });
});

describe("Project Wall: proximity and group membership are not relations", () => {
  test("placing cards side by side or moving them together writes no relation", async () => {
    const { relations, seam } = setupProjectWallLinks();
    const { from, to, wallId } = await wallWithTwoCards(seam);

    await seam.moveCards(ACCOUNT, {
      moves: [
        { cardId: from.id, position: { x: 10, y: 10 } },
        { cardId: to.id, position: { x: 12, y: 10 } },
      ],
      projectId: PROJECT,
      wallId,
    });

    const view = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(view.links).toEqual([]);
    expect(relations.rows()).toEqual([]);
    expect(relations.calls).toEqual({ create: 0, preview: 0 });
  });

  test("a named single-level group holds cards without a relation or a source write", async () => {
    const { relations, seam, sourceSnapshot } = setupProjectWallLinks();
    const sourcesBefore = sourceSnapshot();
    const { from, to, wallId } = await wallWithTwoCards(seam);

    const created = await seam.createGroup(ACCOUNT, {
      projectId: PROJECT,
      title: "Onboarding",
      wallId,
    });
    const [group] = created.groups;
    expect(group).toEqual({
      id: expect.any(String),
      title: "Onboarding",
    });
    for (const card of [from, to]) {
      await seam.setCardGroup(ACCOUNT, {
        cardId: card.id,
        groupId: group?.id ?? "",
        projectId: PROJECT,
        wallId,
      });
    }
    const grouped = await seam.get(ACCOUNT, PROJECT, wallId);

    expect(grouped.cards.map((card) => card.groupId)).toEqual([
      group?.id,
      group?.id,
    ]);
    expect(grouped.links).toEqual([]);
    expect(relations.rows()).toEqual([]);
    expect(relations.calls).toEqual({ create: 0, preview: 0 });
    expect(sourceSnapshot()).toEqual(sourcesBefore);
  });

  test("groups never nest and deleting one keeps its cards", async () => {
    const { seam } = setupProjectWallLinks();
    const { from, wallId } = await wallWithTwoCards(seam);
    const created = await seam.createGroup(ACCOUNT, {
      projectId: PROJECT,
      title: "A",
      wallId,
    });
    const groupId = created.groups[0]?.id ?? "";

    await expect(
      seam.createGroup(ACCOUNT, {
        parentGroupId: groupId,
        projectId: PROJECT,
        title: "B",
        wallId,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.createGroup(ACCOUNT, {
        kind: "Epic",
        projectId: PROJECT,
        title: "B",
        wallId,
      } as never),
    ).rejects.toBeInstanceOf(ZodError);

    await seam.setCardGroup(ACCOUNT, {
      cardId: from.id,
      groupId,
      projectId: PROJECT,
      wallId,
    });
    const view = await seam.deleteGroup(ACCOUNT, {
      groupId,
      projectId: PROJECT,
      wallId,
    });
    expect(view.groups).toEqual([]);
    expect(view.cards).toHaveLength(2);
    expect(view.cards.every((card) => card.groupId === null)).toBe(true);
    await expect(
      seam.setCardGroup(ACCOUNT, {
        cardId: from.id,
        groupId,
        projectId: PROJECT,
        wallId,
      }),
    ).rejects.toBeInstanceOf(ProjectWallGroupNotFoundError);
  });
});

describe("Project Wall: Lock Position is view-local", () => {
  test("a locked card does not move in manual drag, others do", async () => {
    const { seam } = setupProjectWallLinks();
    const { from, to, wallId } = await wallWithTwoCards(seam);
    await seam.setCardLock(ACCOUNT, {
      cardId: from.id,
      locked: true,
      projectId: PROJECT,
      wallId,
    });

    const view = await seam.moveCards(ACCOUNT, {
      moves: [
        { cardId: from.id, position: { x: 500, y: 500 } },
        { cardId: to.id, position: { x: 600, y: 600 } },
      ],
      projectId: PROJECT,
      wallId,
    });

    const [lockedCard, freeCard] = view.cards;
    expect(lockedCard?.locked).toBe(true);
    expect(lockedCard?.position).toEqual(from.position);
    expect(freeCard?.position).toEqual({ x: 600, y: 600 });

    const unlocked = await seam.setCardLock(ACCOUNT, {
      cardId: from.id,
      locked: false,
      projectId: PROJECT,
      wallId,
    });
    expect(unlocked.cards[0]?.locked).toBe(false);
    const moved = await seam.moveCards(ACCOUNT, {
      moves: [{ cardId: from.id, position: { x: 5, y: 5 } }],
      projectId: PROJECT,
      wallId,
    });
    expect(moved.cards[0]?.position).toEqual({ x: 5, y: 5 });
  });

  test("locking writes no source and leaves the source edit and lifecycle free", async () => {
    const { editSource, seam, setSourceLifecycle, sourceSnapshot } =
      setupProjectWallLinks();
    const { from, wallId } = await wallWithTwoCards(seam);
    const sourcesBefore = sourceSnapshot();

    await seam.setCardLock(ACCOUNT, {
      cardId: from.id,
      locked: true,
      projectId: PROJECT,
      wallId,
    });
    expect(sourceSnapshot()).toEqual(sourcesBefore);

    // The owning feature edits and archives the source while the card is locked.
    editSource("Work", "work-1", "Ship onboarding v2");
    setSourceLifecycle("Work", "work-1", { archived: true });
    const archived = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(archived.cards[0]?.source.title).toBe("Ship onboarding v2");
    expect(archived.cards[0]?.source.broken?.reason).toBe("Archived");
    expect(archived.cards[0]?.locked).toBe(true);

    setSourceLifecycle("Work", "work-1", { archived: false, trashed: true });
    const trashed = await seam.get(ACCOUNT, PROJECT, wallId);
    expect(trashed.cards[0]?.source.broken?.reason).toBe("In Trash");
  });

  test("a locked card can still be removed from the wall", async () => {
    const { seam } = setupProjectWallLinks();
    const { from, wallId } = await wallWithTwoCards(seam);
    await seam.setCardLock(ACCOUNT, {
      cardId: from.id,
      locked: true,
      projectId: PROJECT,
      wallId,
    });
    const view = await seam.removeCard(ACCOUNT, {
      cardId: from.id,
      projectId: PROJECT,
      wallId,
    });
    expect(view.cards).toHaveLength(1);
  });
});

describe("Project Wall: no freehand drawing or Sketch card", () => {
  test("a card takes only a master record: no sketch type, strokes or drawing", async () => {
    const { seam } = setupProjectWallLinks();
    const wall = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Story",
    });
    const base = { projectId: PROJECT, wallId: wall.id };

    await expect(
      seam.addCard(ACCOUNT, {
        ...base,
        sourceId: "sketch-1",
        sourceType: "Sketch",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.addCard(ACCOUNT, {
        ...base,
        sourceId: "work-1",
        sourceType: "Work",
        strokes: [[0, 0]],
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.drawLink(ACCOUNT, {
        ...base,
        fromCardId: "a",
        label: "x",
        path: [[0, 0]],
        toCardId: "b",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);

    const view = await seam.get(ACCOUNT, PROJECT, wall.id);
    expect(Object.keys(view).sort()).toEqual([
      "cards",
      "createdAt",
      "focusOrder",
      "groups",
      "id",
      "links",
      "projectId",
      "title",
      "updatedAt",
    ]);
  });

  test("a Visual link carries a label, never a stroke", async () => {
    const { seam } = setupProjectWallLinks();
    const { link } = await drawn(seam);
    expect(Object.keys(link).sort()).toEqual([
      "fromCardId",
      "id",
      "label",
      "toCardId",
    ]);
  });
});

const FROZEN_COPY = /Frozen copy/;
const NOT_A_SHARE_GRANT = /not a share grant/;
const NO_WIDER_SCOPE = /does not widen share scope/;
const SHARE_OR_PUBLISH = /share|publish/i;
const NODE_OR_DIAGRAM = /node|diagram/i;
const NOT_ACTIVE = /not an active/;

function setupProjectWallPresentation() {
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

type Setup = ReturnType<typeof setupProjectWallPresentation>;

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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
    const wall = await wallWithCards(context);
    expect(wall.focusOrder).toEqual([]);
    expect(
      projectWallPresentationSequence(wall.cards, wall.focusOrder),
    ).toEqual(wall.cards);
  });

  test("a Focus order step must be a card of this wall, once", async () => {
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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
    const context = setupProjectWallPresentation();
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

const BLANK = "project-blank";

const SITEMAP_HEADINGS = [
  "Primary Navigation",
  "Secondary Navigation",
  "Utility",
  "External",
];
const JOURNEY_HEADINGS = [
  "Awareness",
  "Consideration",
  "Onboarding",
  "Core Use",
  "Retention",
];

function setupProjectWallSkeletons() {
  const memory = createFakeProjectWallStore({
    projects: [
      {
        id: PROJECT,
        ownerAccountId: ACCOUNT,
        starterSkeletons: ["Sitemap", "Customer Journey"],
      },
      { id: BLANK, ownerAccountId: ACCOUNT },
      {
        archived: true,
        id: "project-archived",
        ownerAccountId: ACCOUNT,
        starterSkeletons: ["Sitemap"],
      },
    ],
    sources: [
      {
        id: "work-1",
        ownerAccountId: ACCOUNT,
        projectId: PROJECT,
        sourceType: "Work",
        status: "In Progress",
        title: "Ship onboarding",
      },
    ],
  });
  let sequence = 0;
  const seam = createProjectWall(memory.store, {
    generateId: () => {
      sequence += 1;
      return `generated-${sequence}`;
    },
    now: () => new Date("2026-02-01T10:00:00.000Z"),
  });
  return { ...memory, seam };
}

describe("Project Wall: Sitemap and Customer Journey skeletons", () => {
  test("Sitemap builds exactly the golden empty headings, in order", async () => {
    const { seam } = setupProjectWallSkeletons();
    const wall = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Sitemap",
    });

    expect(wall.title).toBe("Sitemap");
    expect(wall.groups.map(({ title }) => title)).toEqual(SITEMAP_HEADINGS);
    expect(wall.groups.every((group) => Object.keys(group).length === 2)).toBe(
      true,
    );
  });

  test("Customer Journey builds exactly the golden empty headings, in order", async () => {
    const { seam } = setupProjectWallSkeletons();
    const wall = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Customer Journey",
    });

    expect(wall.title).toBe("Customer Journey");
    expect(wall.groups.map(({ title }) => title)).toEqual(JOURNEY_HEADINGS);
  });

  test("a skeleton carries no sample card, link, task, decision or record", async () => {
    const { seam, sourceSnapshot } = setupProjectWallSkeletons();
    const before = sourceSnapshot();
    const wall = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Sitemap",
    });

    expect(wall.cards).toEqual([]);
    expect(wall.links).toEqual([]);
    expect(Object.keys(wall).sort()).toEqual([
      "cards",
      "createdAt",
      "focusOrder",
      "groups",
      "id",
      "links",
      "projectId",
      "title",
      "updatedAt",
    ]);
    expect(await seam.list(ACCOUNT, PROJECT)).toEqual([
      expect.objectContaining({ cardCount: 0, title: "Sitemap" }),
    ]);
    expect(sourceSnapshot()).toEqual(before);
  });

  test("after creation it is an ordinary wall", async () => {
    const { seam } = setupProjectWallSkeletons();
    const created = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Customer Journey",
    });

    const renamed = await seam.rename(ACCOUNT, {
      projectId: PROJECT,
      title: "Signup story",
      wallId: created.id,
    });
    expect(renamed.title).toBe("Signup story");

    const added = await seam.addCard(ACCOUNT, {
      projectId: PROJECT,
      sourceId: "work-1",
      sourceType: "Work",
      wallId: created.id,
    });
    const [awareness] = added.groups;
    expect(added.cards).toHaveLength(1);

    const grouped = await seam.setCardGroup(ACCOUNT, {
      cardId: added.cards[0]?.id ?? "",
      groupId: awareness?.id ?? null,
      projectId: PROJECT,
      wallId: created.id,
    });
    expect(grouped.cards[0]?.groupId).toBe(awareness?.id);

    const afterDelete = await seam.deleteGroup(ACCOUNT, {
      groupId: awareness?.id ?? "",
      projectId: PROJECT,
      wallId: created.id,
    });
    expect(afterDelete.groups.map(({ title }) => title)).toEqual(
      JOURNEY_HEADINGS.slice(1),
    );
    expect(afterDelete.cards[0]?.groupId).toBeNull();

    const withExtra = await seam.createGroup(ACCOUNT, {
      projectId: PROJECT,
      title: "Advocacy",
      wallId: created.id,
    });
    expect(withExtra.groups.at(-1)?.title).toBe("Advocacy");

    await seam.delete(ACCOUNT, PROJECT, created.id);
    expect(await seam.list(ACCOUNT, PROJECT)).toEqual([]);
  });

  test("the same skeleton can be created again as another ordinary wall", async () => {
    const { seam } = setupProjectWallSkeletons();
    const first = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Sitemap",
    });
    const second = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Sitemap",
    });

    expect(first.id).not.toBe(second.id);
    expect(first.groups.map(({ id }) => id)).not.toEqual(
      second.groups.map(({ id }) => id),
    );
    expect(await seam.list(ACCOUNT, PROJECT)).toHaveLength(2);
  });

  test("lists only the skeletons the Project shell selected", async () => {
    const { seam } = setupProjectWallSkeletons();

    expect(await seam.skeletons(ACCOUNT, PROJECT)).toEqual([
      "Sitemap",
      "Customer Journey",
    ]);
    expect(await seam.skeletons(ACCOUNT, BLANK)).toEqual([]);
    await expect(seam.skeletons(STRANGER, PROJECT)).rejects.toBeInstanceOf(
      ProjectWallProjectNotFoundError,
    );
  });

  test("an unselected skeleton creates nothing", async () => {
    const { seam } = setupProjectWallSkeletons();

    await expect(
      seam.createFromSkeleton(ACCOUNT, {
        projectId: BLANK,
        skeleton: "Sitemap",
      }),
    ).rejects.toBeInstanceOf(ProjectWallSkeletonNotSelectedError);
    expect(await seam.list(ACCOUNT, BLANK)).toEqual([]);
  });

  test("the shell selection alone creates no Project Wall", async () => {
    const { seam } = setupProjectWallSkeletons();

    // The Project selected both skeletons, yet no wall exists until the
    // founder asks this feature to materialize one.
    expect(await seam.skeletons(ACCOUNT, PROJECT)).toHaveLength(2);
    expect(await seam.list(ACCOUNT, PROJECT)).toEqual([]);
  });

  test("rejects unknown skeletons, foreign Projects and archived Projects", async () => {
    const { seam } = setupProjectWallSkeletons();

    await expect(
      seam.createFromSkeleton(ACCOUNT, {
        projectId: PROJECT,
        skeleton: "Persona",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.createFromSkeleton(ACCOUNT, {
        extra: true,
        projectId: PROJECT,
        skeleton: "Sitemap",
      } as never),
    ).rejects.toBeInstanceOf(ZodError);
    await expect(
      seam.createFromSkeleton(STRANGER, {
        projectId: PROJECT,
        skeleton: "Sitemap",
      }),
    ).rejects.toBeInstanceOf(ProjectWallProjectNotFoundError);
    await expect(
      seam.createFromSkeleton(ACCOUNT, {
        projectId: "project-archived",
        skeleton: "Sitemap",
      }),
    ).rejects.toBeInstanceOf(ProjectWallProjectReadOnlyError);
  });
});

const VIEWPORT_WORDS = /zoom|center|collapsed/;
const OTHER_ACCOUNT = "account-2";

const viewport: ProjectWallViewport = {
  center: { x: 300, y: 40 },
  collapsed: [],
  zoom: 1.25,
};

function setupProjectWallViewport(extraWorks = 0) {
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

async function wallWithCardsProjectWallViewport() {
  const ctx = setupProjectWallViewport();
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
    const { seam, wallId } = await wallWithCardsProjectWallViewport();
    expect(await seam.viewport(ACCOUNT, PROJECT, wallId)).toBeNull();
  });

  test("is restored for the account that saved it", async () => {
    const { seam, wallId } = await wallWithCardsProjectWallViewport();
    await seam.saveViewport(ACCOUNT, { projectId: PROJECT, viewport, wallId });
    expect(await seam.viewport(ACCOUNT, PROJECT, wallId)).toEqual(viewport);
  });

  test("is not another user's view and is refused for a wall the account does not own", async () => {
    const { seam, wallId } = await wallWithCardsProjectWallViewport();
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
    const { store, wallId } = await wallWithCardsProjectWallViewport();
    await store.saveViewport(ACCOUNT, wallId, viewport);
    await store.saveViewport(OTHER_ACCOUNT, wallId, { ...viewport, zoom: 0.5 });
    expect((await store.findViewport(ACCOUNT, wallId))?.zoom).toBe(1.25);
    expect((await store.findViewport(OTHER_ACCOUNT, wallId))?.zoom).toBe(0.5);
    expect(await store.findViewport(ACCOUNT, "another-wall")).toBeNull();
  });

  test("is this canvas only: another wall of the Project has its own", async () => {
    const { seam, wallId } = await wallWithCardsProjectWallViewport();
    const other = await seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Other wall",
    });
    await seam.saveViewport(ACCOUNT, { projectId: PROJECT, viewport, wallId });
    expect(await seam.viewport(ACCOUNT, PROJECT, other.id)).toBeNull();
  });

  test("is not content: the wall, its cards, the sources and the Snapshot do not carry it", async () => {
    const ctx = await wallWithCardsProjectWallViewport();
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
    const { seam, wallId } = await wallWithCardsProjectWallViewport();
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
    const { seam, wallId } = await wallWithCardsProjectWallViewport();
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
    const { groupId, seam, wallId } = await wallWithCardsProjectWallViewport();
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
    const ctx = await wallWithCardsProjectWallViewport();
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
    const { seam, view, wallId } = await wallWithCardsProjectWallViewport();
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
    const { seam, view, wallId } = await wallWithCardsProjectWallViewport();
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
    const ctx = setupProjectWallViewport(cards);
    const wall = await ctx.seam.create(ACCOUNT, {
      projectId: PROJECT,
      title: "Scene",
    });
    for (let index = 0; index < cards; index += 1) {
      await ctx.store.addCard(ACCOUNT, {
        density: "Compact",
        diagramVersionId: null,
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
