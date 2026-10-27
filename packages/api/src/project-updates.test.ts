import { describe, expect, test } from "vitest";

import { PROJECT_OVERVIEW_MODULE_NAMES } from "./project-overview";
import {
  CREATE_PROJECT_UPDATE_LABEL,
  createProjectUpdateInputSchema,
  PROJECT_UPDATE_LABEL,
  PROJECT_UPDATE_MARKS,
  PROJECT_UPDATE_OPEN_SOURCE_LABEL,
} from "./project-updates";
import { WORKSPACE_OVERVIEW_MODULE_NAMES } from "./workspace-overview";

const OVERVIEW_JUDGMENT = /update|health|mark/i;
const WORKSPACE_JUDGMENT = /update|health|mission/i;

const snapshot = {
  blocks: [
    {
      name: "Risks",
      records: [{ id: "r1", status: "Open", targetDate: null, title: "Slip" }],
    },
  ],
  lifecycle: "Active",
  purpose: null,
  targetDate: null,
};
const valid = {
  links: [{ targetId: "r1", targetType: "Risk" }],
  mark: "At Risk",
  narrative: "Scope grew.",
  projectId: "p1",
  snapshot,
  updateId: "u1",
};

describe("Project Update contract", () => {
  test("uses the exact English labels and the three closed marks", () => {
    expect(PROJECT_UPDATE_LABEL).toBe("Project Update");
    expect(CREATE_PROJECT_UPDATE_LABEL).toBe("Create Project Update");
    expect(PROJECT_UPDATE_OPEN_SOURCE_LABEL).toBe("Open source record");
    expect([...PROJECT_UPDATE_MARKS]).toEqual([
      "On Track",
      "At Risk",
      "Off Track",
    ]);
  });

  test("accepts a mark, a narrative, links and a snapshot", () => {
    expect(createProjectUpdateInputSchema.parse(valid).mark).toBe("At Risk");
  });

  test("rejects an open mark, an empty narrative and duplicate links", () => {
    expect(
      createProjectUpdateInputSchema.safeParse({ ...valid, mark: "Healthy" })
        .success,
    ).toBe(false);
    expect(
      createProjectUpdateInputSchema.safeParse({ ...valid, narrative: "  " })
        .success,
    ).toBe(false);
    expect(
      createProjectUpdateInputSchema.safeParse({
        ...valid,
        links: [valid.links[0], valid.links[0]],
      }).success,
    ).toBe(false);
  });

  test("takes no score, health or revision input", () => {
    for (const extra of [
      { score: 90 },
      { health: "good" },
      { baseRevision: 1 },
    ]) {
      expect(
        createProjectUpdateInputSchema.safeParse({ ...valid, ...extra })
          .success,
      ).toBe(false);
    }
  });

  test("leaves the Project overview independent of dated updates", () => {
    expect(
      PROJECT_OVERVIEW_MODULE_NAMES.filter((name) =>
        OVERVIEW_JUDGMENT.test(name),
      ),
    ).toEqual([]);
    expect(
      WORKSPACE_OVERVIEW_MODULE_NAMES.filter((name) =>
        WORKSPACE_JUDGMENT.test(name),
      ),
    ).toEqual([]);
  });
});
