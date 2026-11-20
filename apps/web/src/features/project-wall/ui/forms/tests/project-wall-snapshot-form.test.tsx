// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, type ComponentProps } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { ProjectWallSnapshotPanel as ProjectWallSnapshotPanelUnderTest } from "../project-wall-snapshot-form";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const cache = new QueryClient();

function ProjectWallSnapshotPanel(
  props: ComponentProps<typeof ProjectWallSnapshotPanelUnderTest>,
) {
  return (
    <QueryClientProvider client={cache}>
      <ProjectWallSnapshotPanelUnderTest {...props} />
    </QueryClientProvider>
  );
}

test("Preview submits a chosen group through the Snapshot form", async () => {
  const onPreviewSnapshot = vi.fn().mockResolvedValue(undefined);
  const wall = {
    cards: [{ id: "c1", source: { title: "A" }, sourceType: "Work" }],
    groups: [{ collapsed: false, id: "g1", title: "Launch" }],
  };
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <ProjectWallSnapshotPanel
        actions={{ onExportSnapshot: vi.fn(), onPreviewSnapshot }}
        wall={wall as never}
      />,
    ),
  );
  const submit = [...host.querySelectorAll("button")].find(
    (item) => item.type === "submit",
  );
  expect(submit?.disabled).toBe(true);
  const select = host.querySelector("select") as HTMLSelectElement;
  await act(() => {
    Object.getOwnPropertyDescriptor(
      HTMLSelectElement.prototype,
      "value",
    )?.set?.call(select, "g1");
    select.dispatchEvent(new Event("change", { bubbles: true }));
    return Promise.resolve();
  });
  await act(() => {
    host
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });

  expect(onPreviewSnapshot).toHaveBeenCalledWith({ groupId: "g1" });
  await act(() => root.unmount());
  host.remove();
});
