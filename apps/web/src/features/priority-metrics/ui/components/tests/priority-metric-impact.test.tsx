import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { PriorityMetricTrashImpact } from "../priority-metric-impact";

describe("Priority metric Trash impact", () => {
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
});
