import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import RoadmapCanvas from "./roadmap-canvas";

const datedWork = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-27T09:00:00.000Z",
  description: "",
  effort: null,
  featureHealthHistory: [],
  id: "dated-work",
  key: "RMP-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  statusChangedAt: "2026-09-27T09:00:00.000Z",
  targetDate: "2026-10-15",
  title: "Inspect date-only target",
  type: "Research",
  updatedAt: "2026-09-27T09:00:00.000Z",
} satisfies WorkProfile;

test("Roadmap canvas displays Work planned only by target date", () => {
  const html = renderToStaticMarkup(
    <RoadmapCanvas
      milestones={[]}
      origins={[]}
      projectId="project-1"
      view={null}
      works={[datedWork]}
    />,
  );
  expect(html).not.toContain("No planned Work matches this view.");
});

test("Roadmap canvas shows the empty state for an unplanned Work", () => {
  const html = renderToStaticMarkup(
    <RoadmapCanvas
      milestones={[]}
      origins={[]}
      projectId="project-1"
      view={null}
      works={[{ ...datedWork, targetDate: null }]}
    />,
  );
  expect(html).toContain("No planned Work matches this view.");
});
