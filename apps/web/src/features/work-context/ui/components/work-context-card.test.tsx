import type { WorkStatusLabel } from "@cantiara/api/project-shell";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import WorkContextCard from "./work-context-card";

const workStatusLabels = [
  { label: "Queued", semantic: "Not Started" },
  { label: "Doing", semantic: "In Progress" },
  { label: "Waiting", semantic: "Blocked" },
  { label: "Done", semantic: "Closed" },
] satisfies readonly WorkStatusLabel[];

const work: WorkProfile = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  description: null,
  featureHealthHistory: [],
  id: "work-1",
  key: "PAY-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  recreatedFrom: null,
  revision: 1,
  status: "In Progress",
  title: "Checkout work",
  type: "Task",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("Work Context Card initial fields", () => {
  test("shows the Project-configured status label instead of the raw semantic status", () => {
    const html = renderToStaticMarkup(
      <WorkContextCard work={work} workStatusLabels={workStatusLabels} />,
    );

    expect(html).toContain("Doing");
    expect(html).not.toContain("In Progress");
  });

  test("falls back to the protected semantic status without a configured label", () => {
    const html = renderToStaticMarkup(
      <WorkContextCard work={work} workStatusLabels={[]} />,
    );

    expect(html).toContain("In Progress");
  });
});
