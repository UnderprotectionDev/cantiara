// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  createProjectSourceRecord: vi.fn(),
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
  test("a Risk keeps its draft and command after a failed save and refreshes only affected queries", async () => {
    rpc.createProjectSourceRecord
      .mockRejectedValueOnce(new Error("Connection interrupted"))
      .mockResolvedValueOnce({});
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
    function button(label: string) {
      const control = Array.from(host?.querySelectorAll("button") ?? []).find(
        (item) => item.textContent === label,
      );
      if (!control) {
        throw new Error(`Missing ${label}`);
      }
      return control;
    }
    await act(async () => button("Create").click());
    const title = host.querySelector<HTMLInputElement>("#risk-title");
    if (!title) {
      throw new Error("Missing Title");
    }
    await act(() => {
      Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      )?.set?.call(title, "Vendor lock-in");
      title.dispatchEvent(new Event("input", { bubbles: true }));
      button("Save").click();
    });
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(host?.querySelector('[role="alert"]')?.textContent).toContain(
        "could not be saved",
      );
    });
    expect(title.value).toBe("Vendor lock-in");
    await act(async () => button("Save").click());
    await vi.waitFor(async () => {
      await act(async () => undefined);
      expect(host?.querySelector('[role="status"]')?.textContent).toBe(
        "Risk saved.",
      );
    });
    expect(rpc.createProjectSourceRecord).toHaveBeenCalledTimes(2);
    expect(rpc.createProjectSourceRecord.mock.calls[1]).toEqual(
      rpc.createProjectSourceRecord.mock.calls[0],
    );
    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(orpc.smartCollectionViews.key());
  });
});
