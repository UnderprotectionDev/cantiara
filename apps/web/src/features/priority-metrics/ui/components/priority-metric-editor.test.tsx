import {
  PRIORITY_METRIC_RANKS,
  type PriorityMetric,
  type PriorityMetricValueListItem,
} from "@cantiara/api/priority-metrics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import { orpc } from "@/utils/orpc";
import PriorityMetricEditor from "./priority-metric-editor";
import PriorityMetricValuesForm from "./priority-metric-values-form";

const metric: PriorityMetric = {
  createdAt: "2026-09-20T09:00:00.000Z",
  enabled: false,
  id: "metric-1",
  name: "Evidence strength",
  projectId: "project-1",
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
  updatedAt: "2026-09-20T09:00:00.000Z",
};

function renderEditor(metrics: PriorityMetric[]) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(
    orpc.priorityMetrics.queryOptions({ input: { projectId: "project-1" } })
      .queryKey,
    metrics,
  );
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(PriorityMetricEditor, { projectId: "project-1" }),
    ),
  );
}

function renderValues(items: PriorityMetricValueListItem[]) {
  const queryClient = new QueryClient();
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(PriorityMetricValuesForm, {
        items,
        projectId: "project-1",
        workId: "work-1",
        workKey: "PAY-1",
      }),
    ),
  );
}

describe("Priority metric editor", () => {
  test("shows the five fixed ranks and keeps Evidence strength disabled by default", () => {
    const html = renderEditor([metric]);

    for (const rank of PRIORITY_METRIC_RANKS) {
      expect(html).toContain(rank);
    }
    expect(html).toContain("Evidence strength");
    expect(html).toContain("Disabled");
    expect(html).toContain(">Enable<");
    for (const forbidden of ["Score", "WSJF", "Formula", "Trash"]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("starts Work values at Unevaluated with no selected rank", () => {
    const html = renderValues([
      { definition: { ...metric, enabled: true }, value: null },
    ]);

    expect(html).toContain("Priority metrics");
    expect(html).toContain("Unevaluated");
    for (const rank of PRIORITY_METRIC_RANKS) {
      expect(html).toContain(rank);
    }
    expect(html).toContain('value=""');
  });
});
