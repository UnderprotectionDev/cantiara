// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  createProjectSourceRecord: vi.fn(),
  view: { props: null as null | { onSave: (...args: unknown[]) => unknown } },
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { createProjectSourceRecord: rpc.createProjectSourceRecord },
  };
});
vi.mock("../project-risks-view", () => ({
  ProjectRisksView: (props: { onSave: (...args: unknown[]) => unknown }) => {
    rpc.view.props = props;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import ProjectRisksSurface from "../project-risks-surface";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("Project Risks surface", () => {
  test("saving a Risk refreshes Smart Collection membership", async () => {
    rpc.createProjectSourceRecord.mockResolvedValue({});
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.projectRisks.queryOptions({ input: { projectId: "project-1" } })
        .queryKey,
      { readOnly: false, records: [] } as never,
    );
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <ProjectRisksSurface projectId="project-1" />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await rpc.view.props?.onSave({
        description: "",
        impact: "",
        life: "Open",
        probability: "",
        rationale: "",
        response: "",
        title: "Vendor lock-in",
      });
    });
    expect(rpc.createProjectSourceRecord).toHaveBeenCalledTimes(1);
    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(orpc.smartCollectionViews.key());
  });
});
