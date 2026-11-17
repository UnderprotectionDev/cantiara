// @vitest-environment happy-dom
import type { ScreenRecord } from "@cantiara/api/screens";
import { createEmptyWireframeDocument } from "@cantiara/api/wireframe-document";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const read = vi.hoisted(() => vi.fn());

vi.mock("@/utils/orpc", () => ({
  orpc: {
    screenWireframe: {
      queryOptions: ({ input }: { input: unknown }) => ({
        queryFn: () => read(input),
        queryKey: ["wireframe", input],
      }),
    },
  },
}));
vi.mock("../presentation-mode", () => ({
  PresentationMode: ({ snapshots }: { snapshots: { version: number }[] }) => (
    <p>presenting v{snapshots[0]?.version}</p>
  ),
}));

import ScreensOutputSurface from "../screens-output-surface";

test("Presentation Mode reads the chosen Wireframe version through the query client", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  read.mockResolvedValue({
    document: createEmptyWireframeDocument(),
    version: 2,
  });
  const screens = [
    {
      id: "s1",
      lifecycle: "Active",
      title: "Checkout",
      wireframeVersions: [
        { createdAt: "2026-10-01T09:00:00.000Z", version: 1 },
        { createdAt: "2026-10-02T09:00:00.000Z", version: 2 },
      ],
    },
  ] as ScreenRecord[];
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <ScreensOutputSurface projectId="p1" screens={screens} />
      </QueryClientProvider>,
    ),
  );
  await act(async () =>
    host.querySelector<HTMLElement>("#screens-output-s1")?.click(),
  );
  await act(() => {
    [...host.querySelectorAll("button")]
      .find((item) => item.textContent === "Presentation Mode")
      ?.click();
    return Promise.resolve();
  });
  expect(read).toHaveBeenCalledWith({
    projectId: "p1",
    screenId: "s1",
    version: 2,
  });
  expect(host.textContent).toContain("presenting v2");
  await act(async () => root.unmount());
  host.remove();
});
