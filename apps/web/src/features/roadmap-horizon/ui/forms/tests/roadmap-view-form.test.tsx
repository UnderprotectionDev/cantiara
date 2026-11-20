// @vitest-environment happy-dom

import type { RoadmapView } from "@cantiara/api/roadmap-horizon";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

import RoadmapViewEditor from "../roadmap-view-form";

const saveNamedView = vi.hoisted(() => vi.fn());
vi.mock("@/utils/orpc", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/orpc")>()),
  client: { saveRoadmapView: saveNamedView },
}));

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

test("Save named view sends one write while submission is pending", async () => {
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  const projectId = crypto.randomUUID();
  const view = { ...savedView, id: crypto.randomUUID(), projectId };
  const pending = Promise.withResolvers<RoadmapView>();
  const onSaved = vi.fn();
  saveNamedView.mockReturnValue(pending.promise);
  const queryClient = new QueryClient();
  const host = document.createElement("div");
  const root = createRoot(host);

  try {
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <RoadmapViewEditor
            onSaved={onSaved}
            presentationMode={false}
            projectId={projectId}
            renderResults={renderCurrentView}
            saved={view}
          />
        </QueryClientProvider>,
      );
    });
    const form = host.querySelector("form");
    await act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true }));
      form?.dispatchEvent(new Event("submit", { bubbles: true }));
      return Promise.resolve();
    });

    expect(saveNamedView).toHaveBeenCalledTimes(1);
    await act(() => {
      pending.resolve(view);
      return pending.promise;
    });
    expect(onSaved).toHaveBeenCalledExactlyOnceWith(view.id);
  } finally {
    act(() => root.unmount());
    queryClient.clear();
  }
});
