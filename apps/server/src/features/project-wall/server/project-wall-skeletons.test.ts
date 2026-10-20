import { describe, expect, test } from "vitest";
import { ZodError } from "zod";

import {
  createProjectWall,
  ProjectWallProjectNotFoundError,
  ProjectWallProjectReadOnlyError,
  ProjectWallSkeletonNotSelectedError,
} from "./project-wall";
import { createFakeProjectWallStore } from "./project-wall-test-support";

const ACCOUNT = "account-1";
const STRANGER = "account-2";
const PROJECT = "project-1";
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

function setup() {
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
    const { seam } = setup();
    const wall = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Sitemap",
    });

    expect(wall.title).toBe("Sitemap");
    expect(wall.groups.map(({ title }) => title)).toEqual(SITEMAP_HEADINGS);
    expect(wall.groups.every(({ collapsed }) => !collapsed)).toBe(true);
  });

  test("Customer Journey builds exactly the golden empty headings, in order", async () => {
    const { seam } = setup();
    const wall = await seam.createFromSkeleton(ACCOUNT, {
      projectId: PROJECT,
      skeleton: "Customer Journey",
    });

    expect(wall.title).toBe("Customer Journey");
    expect(wall.groups.map(({ title }) => title)).toEqual(JOURNEY_HEADINGS);
  });

  test("a skeleton carries no sample card, link, task, decision or record", async () => {
    const { seam, sourceSnapshot } = setup();
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
    const { seam } = setup();
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
    const { seam } = setup();
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
    const { seam } = setup();

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
    const { seam } = setup();

    await expect(
      seam.createFromSkeleton(ACCOUNT, {
        projectId: BLANK,
        skeleton: "Sitemap",
      }),
    ).rejects.toBeInstanceOf(ProjectWallSkeletonNotSelectedError);
    expect(await seam.list(ACCOUNT, BLANK)).toEqual([]);
  });

  test("the shell selection alone creates no Project Wall", async () => {
    const { seam } = setup();

    // The Project selected both skeletons, yet no wall exists until the
    // founder asks this feature to materialize one.
    expect(await seam.skeletons(ACCOUNT, PROJECT)).toHaveLength(2);
    expect(await seam.list(ACCOUNT, PROJECT)).toEqual([]);
  });

  test("rejects unknown skeletons, foreign Projects and archived Projects", async () => {
    const { seam } = setup();

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
