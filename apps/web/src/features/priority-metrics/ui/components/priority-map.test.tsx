import type {
  PriorityMetric,
  PriorityMetricProjectValues,
} from "@cantiara/api/priority-metrics";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { orpc } from "@/utils/orpc";
import PriorityMap from "./priority-map";

const projectId = "project-1";
const metrics: PriorityMetric[] = [
  {
    createdAt: "2026-09-20T09:00:00.000Z",
    enabled: true,
    id: "customer-value",
    name: "Customer value",
    projectId,
    rankDescriptions: {
      High: "High customer value.",
      Low: "Low customer value.",
      Medium: "Medium customer value.",
      "Very high": "Very high customer value.",
      "Very low": "Very low customer value.",
    },
    revision: 0,
    shortDescription: "Expected customer value.",
    trashedAt: null,
    updatedAt: "2026-09-20T09:00:00.000Z",
  },
  {
    createdAt: "2026-09-20T09:01:00.000Z",
    enabled: true,
    id: "confidence",
    name: "Confidence",
    projectId,
    rankDescriptions: {
      High: "High confidence.",
      Low: "Low confidence.",
      Medium: "Medium confidence.",
      "Very high": "Very high confidence.",
      "Very low": "Very low confidence.",
    },
    revision: 0,
    shortDescription: "Confidence in the outcome.",
    trashedAt: null,
    updatedAt: "2026-09-20T09:01:00.000Z",
  },
  {
    createdAt: "2026-09-20T09:02:00.000Z",
    enabled: false,
    id: "evidence-strength",
    name: "Evidence strength",
    projectId,
    rankDescriptions: {
      High: "Repeated direct evidence.",
      Low: "Limited evidence.",
      Medium: "Some evidence.",
      "Very high": "Strong validated evidence.",
      "Very low": "No supporting evidence.",
    },
    revision: 0,
    shortDescription: "How strongly evidence supports this Work.",
    trashedAt: null,
    updatedAt: "2026-09-20T09:02:00.000Z",
  },
];

const works: WorkProfile[] = [
  {
    archivedAt: null,
    captureProvenance: null,
    checklist: [],
    closureReason: null,
    closureResult: null,
    createdAt: "2026-09-20T09:03:00.000Z",
    description: null,
    effort: null,
    featureHealthHistory: [],
    id: "work-1",
    key: "CAT-1",
    number: 1,
    primaryFeatureId: null,
    primarySpecId: null,
    projectId,
    recreatedFrom: null,
    reappearDate: null,
    revision: 0,
    status: "Not Started",
    statusChangedAt: "2026-09-20T09:03:00.000Z",
    targetDate: null,
    title: "Improve checkout recovery",
    type: "Task",
    updatedAt: "2026-09-20T09:03:00.000Z",
  },
  {
    archivedAt: null,
    captureProvenance: null,
    checklist: [],
    closureReason: null,
    closureResult: null,
    createdAt: "2026-09-20T09:04:00.000Z",
    description: null,
    effort: null,
    featureHealthHistory: [],
    id: "work-2",
    key: "CAT-2",
    number: 2,
    primaryFeatureId: null,
    primarySpecId: null,
    projectId,
    recreatedFrom: null,
    reappearDate: null,
    revision: 0,
    status: "Not Started",
    statusChangedAt: "2026-09-20T09:04:00.000Z",
    targetDate: null,
    title: "Document cancellation behavior",
    type: "Task",
    updatedAt: "2026-09-20T09:04:00.000Z",
  },
];

const projectValues: PriorityMetricProjectValues = {
  definitions: metrics,
  valueRevisions: [],
  values: [
    {
      createdAt: "2026-09-20T09:05:00.000Z",
      id: "value-1",
      metricId: "customer-value",
      projectId,
      rank: "High",
      revision: 1,
      updatedAt: "2026-09-20T09:05:00.000Z",
      workId: "work-1",
    },
    {
      createdAt: "2026-09-20T09:06:00.000Z",
      id: "value-2",
      metricId: "confidence",
      projectId,
      rank: "Very high",
      revision: 1,
      updatedAt: "2026-09-20T09:06:00.000Z",
      workId: "work-1",
    },
  ],
};

function renderMap() {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.projectWorks.queryOptions({
      input: { archived: false, projectId },
    }).queryKey,
    works,
  );
  queryClient.setQueryData(
    orpc.priorityMetricProjectValues.queryOptions({
      input: { projectId },
    }).queryKey,
    projectValues,
  );
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(PriorityMap, { projectId }),
    ),
  );
}

describe("Priority Map", () => {
  test("places evaluated Work on both selected axes and keeps missing values in Unevaluated", () => {
    const html = renderMap();

    expect(html).toContain('aria-label="Priority Map"');
    expect(html).toContain(">Horizontal axis</label>");
    expect(html).toContain(">Vertical axis</label>");
    expect(html).toContain(
      'aria-label="Customer value: High; Confidence: Very high"',
    );
    expect(html).toContain("CAT-1");
    expect(html).toContain("Improve checkout recovery");
    expect(html).toContain("Unevaluated");
    expect(html).toContain("CAT-2");
    expect(html).toContain("Document cancellation behavior");
    expect(html).not.toContain("Evidence strength");
  });

  test("keeps evidence context opt-in and edits axis values through an explicit action", () => {
    const html = renderMap();

    expect(html).toContain("Show evidence signals");
    expect(html).toContain('aria-label="Edit axis values for CAT-1"');
    expect(html).not.toContain("Unique Contact");
    expect(html).not.toContain("Unique Company");
  });

  test("does not turn position into a score, quadrant, saved order, or Work status", () => {
    const html = renderMap();

    for (const forbidden of [
      "Score",
      "Quadrant",
      "Save map",
      "Backlog order",
      "Work status",
    ]) {
      expect(html).not.toContain(forbidden);
    }
    expect(html).not.toContain('draggable="true"');
  });
});
