import type { RoadmapView } from "@cantiara/api/roadmap-horizon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import RoadmapViewEditor from "./roadmap-view-editor";

const savedView: RoadmapView = {
  groupBy: "Type",
  horizons: ["Later"],
  id: "view-1",
  markBy: "Horizon",
  name: "Saved tasks",
  projectId: "project-1",
  revision: 1,
  types: ["Task"],
};

const ignoreSavedView = vi.fn();

function renderCurrentView(view: RoadmapView, presentationMode: boolean) {
  return (
    <p>
      {view.name}/{view.horizons.join("/")}/{view.types.join("/")}/
      {presentationMode ? "Presentation" : "Editable"}
    </p>
  );
}

describe("Roadmap view presentation", () => {
  test("keeps the current view results while hiding view configuration", () => {
    const queryClient = new QueryClient();
    const html = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <RoadmapViewEditor
          onSaved={ignoreSavedView}
          presentationMode
          projectId="project-1"
          renderResults={renderCurrentView}
          saved={savedView}
        />
      </QueryClientProvider>,
    );

    expect(html).toContain('hidden=""');
    expect(html).toContain("Saved tasks/Later/Task/Presentation");
  });
});
