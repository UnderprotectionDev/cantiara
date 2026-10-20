// biome-ignore-all lint/performance/noAwaitInLoops: Seam calls are sequential by design.
import {
  PROJECT_WALL_DENSITIES,
  PROJECT_WALL_DENSITY_FIELDS,
  PROJECT_WALL_HIGHLIGHTS,
} from "@cantiara/api/project-wall";
import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createProjectWall,
  ProjectWallCardDuplicateError,
  ProjectWallCardNotFoundError,
  ProjectWallNotFoundError,
  ProjectWallProjectNotFoundError,
  ProjectWallProjectReadOnlyError,
  ProjectWallSourceUnavailableError,
} from "./project-wall";
import { createFakeProjectWallStore } from "./project-wall-test-support";

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
      "highlight",
      "id",
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
