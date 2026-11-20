// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ProjectWallNarrativePanel as ProjectWallNarrativePanelUnderTest } from "../project-wall-narrative";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const cache = new QueryClient();

function ProjectWallNarrativePanel(
  props: ComponentProps<typeof ProjectWallNarrativePanelUnderTest>,
) {
  return (
    <QueryClientProvider client={cache}>
      <ProjectWallNarrativePanelUnderTest {...props} />
    </QueryClientProvider>
  );
}

test("Create Persistent Relation previews the chosen kind through the form submit", async () => {
  const onPreviewRelation = vi.fn().mockResolvedValue(undefined);
  const noop = vi.fn().mockResolvedValue(true);
  const wall = {
    cards: [
      { id: "c1", source: { recordId: "w1", title: "A" }, sourceType: "Work" },
      { id: "c2", source: { recordId: "w2", title: "B" }, sourceType: "Work" },
    ],
    groups: [],
    links: [{ fromCardId: "c1", id: "l1", label: "feeds", toCardId: "c2" }],
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ProjectWallNarrativePanel
        actions={{
          onCreateGroup: noop,
          onCreateRelation: noop,
          onDeleteGroup: noop,
          onDrawLink: noop,
          onPreviewRelation,
          onToggleGroup: noop,
          onUnbindLink: noop,
        }}
        wall={wall as never}
      />,
    ),
  );
  const form = host
    .querySelector('li form select[aria-label="Relation kind"]')
    ?.closest("form");
  await act(() => {
    form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    return Promise.resolve();
  });

  expect(onPreviewRelation).toHaveBeenCalledWith({
    kind: expect.any(String),
    linkId: "l1",
  });
  await act(async () => root.unmount());
  host.remove();
});
