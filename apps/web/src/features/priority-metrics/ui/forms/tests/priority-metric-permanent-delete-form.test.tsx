// @vitest-environment happy-dom

import type { PriorityMetric } from "@cantiara/api/priority-metrics";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { PriorityMetricPermanentDeleteConfirmation } from "../priority-metric-permanent-delete-form";

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

describe("Priority metric permanent delete form", () => {
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

  test("submits only the exact Project name and shows no message otherwise", async () => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    act(() => {
      root.render(
        createElement(PriorityMetricPermanentDeleteConfirmation, {
          confirmationPending: false,
          deleteGrant: "grant",
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
          onSubmit,
          projectName: "Cantiara",
          target: metric,
        }),
      );
    });
    const form = host.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
      await Promise.resolve();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')).toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
