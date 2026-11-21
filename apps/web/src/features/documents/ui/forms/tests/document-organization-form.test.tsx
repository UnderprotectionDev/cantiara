// @vitest-environment happy-dom
import type { Document } from "@cantiara/api/documents";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ organize: vi.fn(), preview: vi.fn() }));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", async (load) => ({
  ...(await load<typeof import("@/utils/orpc")>()),
  client: {
    organizeDocument: rpc.organize,
    previewDocumentOrganization: rpc.preview,
  },
}));

import DocumentOrganizationControls from "../../components/document-organization-controls";

test("previews an archive change, then applies it with one save identity", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  rpc.preview.mockReset();
  rpc.organize.mockReset();
  rpc.preview.mockResolvedValue({
    allowed: true,
    depth: 0,
    descendants: [],
    reason: null,
  });
  rpc.organize
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValue({ id: "doc" });
  const onCommitted = vi.fn(async () => undefined);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  function button(name: string) {
    const found = Array.from(document.body.querySelectorAll("button")).find(
      (item) => item.textContent === name,
    );
    if (!found) {
      throw new Error(`${name} control required`);
    }
    return found;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={queryClient}>
          <DocumentOrganizationControls
            disabled={false}
            documents={[]}
            onCommitted={onCommitted}
            record={{ id: "doc", revision: 3 } as Document}
          />
        </QueryClientProvider>,
      ),
    );
    await act(async () => button("Archive").click());
    await act(async () => {
      button("Preview").click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(rpc.preview).toHaveBeenCalledWith({
      action: "archive",
      archived: true,
      documentId: "doc",
    });
    await vi.waitFor(() => expect(button("Apply").disabled).toBe(false));
    await act(async () => button("Apply").click());
    expect(rpc.organize).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "archive",
        archived: true,
        baseRevision: 3,
        documentId: "doc",
      }),
    );
    await vi.waitFor(() =>
      expect(
        document.querySelector('[role="dialog"] [role="alert"]')?.textContent,
      ).toBe("Connection interrupted"),
    );
    await act(async () => button("Apply").click());
    expect(rpc.organize).toHaveBeenCalledTimes(2);
    expect(rpc.organize.mock.calls[1]).toEqual(rpc.organize.mock.calls[0]);
    expect(onCommitted).toHaveBeenCalledWith({ id: "doc" });
    await vi.waitFor(() =>
      expect(document.querySelector("[role=dialog]")).toBeNull(),
    );
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
