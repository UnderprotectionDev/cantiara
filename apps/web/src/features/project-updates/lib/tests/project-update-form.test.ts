import type { ProjectOverviewSources } from "@cantiara/api/project-overview";
import {
  getProjectShellConfiguration,
  type ProjectProfile,
} from "@cantiara/api/project-shell";
import { describe, expect, test } from "vitest";

import {
  buildProjectUpdateSnapshot,
  projectUpdateFormSchema,
  projectUpdateLinkCandidates,
  projectUpdateLinkFromKey,
  projectUpdateLinkKey,
} from "../project-update-form";

const project: ProjectProfile = {
  configuration: {
    ...getProjectShellConfiguration("Blank Project"),
    preparedStages: [
      { id: "build", name: "Build", status: "Active" },
      { id: "release", name: "Release", status: "Not Planned" },
    ],
  },
  createdAt: "2026-09-17T09:00:00.000Z",
  id: "project-1",
  logo: null,
  name: "Payment App",
  problem: null,
  purpose: "Collect payments.",
  revision: 1,
  scope: null,
  shortCode: "PAY",
  shortCodeLocked: false,
  starterConfiguration: "Blank Project",
  status: "Active",
  targetDate: "2026-09-30",
  updatedAt: "2026-09-17T09:00:00.000Z",
};

const sources: ProjectOverviewSources = {
  blockers: [{ id: "b1", title: "Not part of the snapshot" }],
  decisions: [{ id: "d1", status: "Valid", title: "Hosted checkout" }],
  milestones: [
    { id: "m1", status: "Planned", targetDate: "2026-09-25", title: "Beta" },
  ],
  risks: [{ id: "r1", status: "Open", title: "Provider delay" }],
};

describe("Project Update form helpers", () => {
  test("requires one of the three marks and a trimmed narrative", () => {
    expect(
      projectUpdateFormSchema.safeParse({
        links: [],
        mark: "On Track",
        narrative: "  ok  ",
      }),
    ).toMatchObject({ data: { narrative: "ok" }, success: true });
    expect(
      projectUpdateFormSchema.safeParse({
        links: [],
        mark: "",
        narrative: "ok",
      }).success,
    ).toBe(false);
    expect(
      projectUpdateFormSchema.safeParse({
        links: [],
        mark: "At Risk",
        narrative: "   ",
      }).success,
    ).toBe(false);
  });

  test("round-trips a link key whose id contains a colon", () => {
    const link = { targetId: "a:b", targetType: "Risk" as const };
    expect(projectUpdateLinkFromKey(projectUpdateLinkKey(link))).toEqual(link);
    expect(projectUpdateLinkFromKey("Bogus:x")).toBeNull();
  });

  test("offers Risk, Decision and Milestone records as link choices", () => {
    expect(
      projectUpdateLinkCandidates(sources).map((candidate) => candidate.key),
    ).toEqual(["Risk:r1", "Decision:d1", "Milestone:m1"]);
  });

  test("snapshots only the shown summary blocks from the overview sources", () => {
    const snapshot = buildProjectUpdateSnapshot(project, sources);
    expect(snapshot.blocks.map((block) => block.name)).toEqual([
      "Goals",
      "Stages",
      "Milestones",
      "Decisions",
      "Risks",
    ]);
    expect(
      snapshot.blocks.find((block) => block.name === "Stages")?.records,
    ).toEqual([
      { id: "build", status: "Active", targetDate: null, title: "Build" },
    ]);
    expect(snapshot).toMatchObject({
      lifecycle: "Active",
      purpose: "Collect payments.",
      targetDate: "2026-09-30",
    });
    expect(JSON.stringify(snapshot)).not.toContain("Not part of the snapshot");
  });
});
