import { getProjectShellConfiguration } from "@cantiara/api/project-shell";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import WorkContextCardLayoutEditor from "./work-context-card-layout-editor";

describe("Work Context Card layout editor", () => {
  test("exposes the closed catalog and preview/confirm seam in Configuration Mode", () => {
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <WorkContextCardLayoutEditor
          baseRevision={1}
          configuration={getProjectShellConfiguration("Blank Project")}
          disabled={false}
          error={null}
          projectId="project-1"
        />
      </QueryClientProvider>,
    );

    expect(html).toContain("Work type");
    expect(html).toContain("Add custom section");
    expect(html).toContain("Record type");
    expect(html).toContain("Relation");
    expect(html).toContain("Evidence Role");
    expect(html).toContain("Preview");
    expect(html).toContain("Confirm");
  });
});
