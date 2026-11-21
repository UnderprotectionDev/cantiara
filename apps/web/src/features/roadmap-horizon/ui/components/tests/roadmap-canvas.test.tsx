// @vitest-environment happy-dom
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { act, type ReactNode, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import RoadmapCanvas from "../roadmap-canvas";

const placement = vi.hoisted(() => ({
  fitView: vi.fn<() => Promise<boolean>>(),
}));

vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: ReactNode }) => children,
  useReactFlow: () => ({ fitView: placement.fitView }),
  ReactFlow: ({ onInit }: { onInit: (flow: typeof placement) => void }) => {
    const initialized = useRef<boolean>(false);
    useEffect(() => {
      if (!initialized.current) {
        initialized.current = true;
        onInit(placement);
      }
    }, [onInit]);
    return null;
  },
}));

const datedWork = {
  archivedAt: null,
  captureProvenance: null,
  checklist: [],
  closureReason: null,
  closureResult: null,
  createdAt: "2026-09-27T09:00:00.000Z",
  description: "",
  effort: null,
  featureHealthHistory: [],
  id: "dated-work",
  key: "RMP-1",
  number: 1,
  primaryFeatureId: null,
  primarySpecId: null,
  projectId: "project-1",
  reappearDate: null,
  recreatedFrom: null,
  revision: 1,
  status: "Not Started",
  statusChangedAt: "2026-09-27T09:00:00.000Z",
  targetDate: "2026-10-15",
  title: "Inspect date-only target",
  type: "Research",
  updatedAt: "2026-09-27T09:00:00.000Z",
} satisfies WorkProfile;

test("Roadmap canvas displays Work planned only by target date", () => {
  const html = renderToStaticMarkup(
    <RoadmapCanvas
      milestones={[]}
      origins={[]}
      projectId="project-1"
      view={null}
      works={[datedWork]}
    />,
  );
  expect(html).not.toContain("No planned Work matches this view.");
});

test("Roadmap canvas shows the empty state for an unplanned Work", () => {
  const html = renderToStaticMarkup(
    <RoadmapCanvas
      milestones={[]}
      origins={[]}
      projectId="project-1"
      view={null}
      works={[{ ...datedWork, targetDate: null }]}
    />,
  );
  expect(html).toContain("No planned Work matches this view.");
});

test("Return to Work waits for the initial Roadmap viewport and ignores an unmounted canvas", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const first = Promise.withResolvers<boolean>();
  const second = Promise.withResolvers<boolean>();
  placement.fitView.mockReset();
  placement.fitView
    .mockReturnValueOnce(first.promise)
    .mockReturnValue(second.promise);
  const ready = vi.fn();
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function render(projectId: string) {
    act(() =>
      root.render(
        <RoadmapCanvas
          milestones={[]}
          onReady={ready}
          origins={[]}
          projectId={projectId}
          view={null}
          works={[datedWork]}
        />,
      ),
    );
  }
  try {
    render("project-1");
    expect(placement.fitView).toHaveBeenCalledTimes(1);
    expect(ready).not.toHaveBeenCalled();
    render("project-2");
    await act(async () => first.resolve(true));
    expect(ready).not.toHaveBeenCalled();
    await act(async () => second.resolve(true));
    expect(ready).toHaveBeenCalledOnce();
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
});
