import {
  PRIORITY_METRIC_RANKS,
  type PriorityMetric,
  type PriorityMetricProjectValues,
  type PriorityMetricValueListItem,
} from "@cantiara/api/priority-metrics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { priorityMetricItemsForWork } from "@/features/priority-metrics/hooks/use-priority-metrics";
import { orpc } from "@/utils/orpc";
import PriorityMetricEditor, {
  PriorityMetricPermanentDeleteConfirmation,
  PriorityMetricTrashImpact,
} from "./priority-metric-editor";
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
      createElement(PriorityMetricEditor, {
        projectId: "project-1",
        projectName: "Cantiara",
      }),
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
    expect(html).toContain("Add metric");
    expect(html).toContain("Short description");
    expect(html).toContain("Rank descriptions");
    expect(html).toContain("Move to Trash");
    for (const forbidden of [
      "Score",
      "WSJF",
      "Formula",
      "Permanently Delete",
    ]) {
      expect(html).not.toContain(forbidden);
    }
  });

  test("shows Disable for an enabled criterion", () => {
    const html = renderEditor([{ ...metric, enabled: true }]);

    expect(html).toContain(">Disable<");
  });

  test("shows the exact permanent-delete Project name confirmation label", () => {
    const html = renderToStaticMarkup(
      createElement(PriorityMetricPermanentDeleteConfirmation, {
        confirmationPending: false,
        deleteGrant: null,
        deleting: false,
        disabled: false,
        effect: {
          attachedExternalSurfaceCount: 0,
          dependentRuleCount: 0,
          dependentViewCount: 0,
          storedWorkValueCount: 0,
        },
        error: false,
        loading: false,
        onCancel: () => undefined,
        onRequestConfirmation: () => undefined,
        onSubmit: async () => undefined,
        projectName: "Cantiara",
        target: metric,
      }),
    );

    expect(html).toContain("Type the Project name to confirm");
  });

  test("offers restore and permanent delete for trashed metrics", () => {
    const html = renderEditor([
      {
        ...metric,
        enabled: true,
        revision: 2,
        trashedAt: "2026-09-21T09:00:00.000Z",
      },
    ]);

    expect(html).toContain("Trash");
    expect(html).toContain("Evidence strength");
    expect(html).toContain("Restore");
    expect(html).toContain("Permanently Delete");
    expect(html).not.toContain("Move to Trash");
    expect(html).not.toContain(">Edit<");
  });

  test("starts Work values at Unevaluated with no selected rank", () => {
    const html = renderValues([
      {
        definition: { ...metric, enabled: true },
        value: null,
        valueRevision: 0,
      },
    ]);

    expect(html).toContain("Priority metrics");
    expect(html).toContain("Unevaluated");
    for (const rank of PRIORITY_METRIC_RANKS) {
      expect(html).toContain(rank);
    }
    expect(html).toContain('value=""');
  });

  test("shows the saved Work value count in the permanent delete effect", () => {
    const html = renderToStaticMarkup(
      createElement(PriorityMetricTrashImpact, {
        effect: {
          attachedExternalSurfaceCount: 0,
          dependentRuleCount: 0,
          dependentViewCount: 0,
          storedWorkValueCount: 3,
        },
        mode: "permanent-delete",
        projectName: "Cantiara",
      }),
    );

    expect(html).toContain("3 saved Work values in Cantiara");
  });

  test("previews the recoverable Trash effect before moving a criterion", () => {
    const html = renderToStaticMarkup(
      createElement(PriorityMetricTrashImpact, {
        effect: {
          attachedExternalSurfaceCount: 0,
          dependentRuleCount: 0,
          dependentViewCount: 0,
          storedWorkValueCount: 1,
        },
        mode: "move-to-trash",
        projectName: "Cantiara",
      }),
    );

    expect(html).toContain(
      "1 saved Work value remains recoverable for 30 days",
    );
    expect(html).toContain("Dependent views: 0. Dependent rules: 0");
    expect(html).toContain("Attached External Surfaces: 0");
  });

  test("keeps the value revision after the value is Unevaluated", () => {
    const projectValues: PriorityMetricProjectValues = {
      definitions: [{ ...metric, enabled: true }],
      values: [],
      valueRevisions: [{ metricId: metric.id, revision: 2, workId: "work-1" }],
    };

    expect(priorityMetricItemsForWork(projectValues, "work-1")).toEqual([
      {
        definition: { ...metric, enabled: true },
        value: null,
        valueRevision: 2,
      },
    ]);
  });
});
