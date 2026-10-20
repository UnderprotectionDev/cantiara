import { describe, expect, test } from "vitest";

import {
  createProjectWallInputSchema,
  type ProjectWallSkeleton,
  projectWallSkeletonHeadings,
  reorderProjectWallCardsInputSchema,
} from "./project-wall";

const UNKNOWN_SKELETON = /Unknown Project Wall starter skeleton/;

describe("Project Wall contract", () => {
  test("skeleton headings come from the shell catalog, in order", () => {
    expect(projectWallSkeletonHeadings("Sitemap")).toEqual([
      "Primary Navigation",
      "Secondary Navigation",
      "Utility",
      "External",
    ]);
    expect(projectWallSkeletonHeadings("Customer Journey")).toEqual([
      "Awareness",
      "Consideration",
      "Onboarding",
      "Core Use",
      "Retention",
    ]);
  });

  test("an unknown skeleton fails loudly instead of headingless walls", () => {
    expect(() =>
      projectWallSkeletonHeadings("Ghost" as ProjectWallSkeleton),
    ).toThrowError(UNKNOWN_SKELETON);
  });

  test("the reorder order lists every card exactly once", () => {
    const ok = reorderProjectWallCardsInputSchema.safeParse({
      projectId: "p1",
      wallId: "w1",
      cardIds: ["card-1", "card-2", "card-1"],
    });
    expect(ok.success).toBe(false);
    const once = reorderProjectWallCardsInputSchema.safeParse({
      projectId: "p1",
      wallId: "w1",
      cardIds: ["card-1", "card-2"],
    });
    expect(once.success).toBe(true);
  });

  test("a wall title is trimmed by the contract as stored", () => {
    const parsed = createProjectWallInputSchema.parse({
      projectId: "p1",
      title: "  Launch story  ",
    });
    expect(parsed.title).toBe("Launch story");
  });
});
