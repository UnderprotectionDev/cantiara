// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createProjectWall,
  ProjectWallCardNotFoundError,
  ProjectWallGroupNotFoundError,
  ProjectWallLinkNotFoundError,
  ProjectWallRelationPreviewRequiredError,
} from "../project-wall";
import {
  createFakeProjectWallRelations,
  createFakeProjectWallStore,
} from "../project-wall-test-support";

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

type Seam = ReturnType<typeof setup>["seam"];

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
    const { relations, seam, sourceSnapshot } = setup();
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
    const { seam } = setup();
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
    const { relations, seam, sourceSnapshot } = setup();
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
    const { seam } = setup();
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
    const { relations, seam } = setup();
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
    const { relations, seam } = setup();
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
    const { relations, seam } = setup();
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
    const { seam } = setup();
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
    const { relations, seam } = setup();
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
    const { relations, seam, sourceSnapshot } = setup();
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
    const { seam } = setup();
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
    const { seam } = setup();
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
    const { editSource, seam, setSourceLifecycle, sourceSnapshot } = setup();
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
    const { seam } = setup();
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
    const { seam } = setup();
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
    const { seam } = setup();
    const { link } = await drawn(seam);
    expect(Object.keys(link).sort()).toEqual([
      "fromCardId",
      "id",
      "label",
      "toCardId",
    ]);
  });
});
