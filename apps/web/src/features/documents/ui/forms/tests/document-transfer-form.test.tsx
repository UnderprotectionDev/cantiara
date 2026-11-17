// @vitest-environment happy-dom
import type { Document } from "@cantiara/api/documents";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({ export: vi.fn(), preview: vi.fn() }));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => ({
  client: {
    exportDocument: rpc.export,
    previewDocumentTransfer: rpc.preview,
  },
  orpc: {
    documentVersions: {
      queryOptions: () => ({ queryFn: async () => [], queryKey: ["versions"] }),
    },
    fileAttachments: {
      queryOptions: () => ({ queryFn: async () => [], queryKey: ["files"] }),
    },
    projects: {
      queryOptions: () => ({ queryFn: async () => [], queryKey: ["projects"] }),
    },
  },
}));

import DocumentTransferForm from "../document-transfer-form";

const committed = async () => undefined;

test("Export previews the validated export request through the form submit", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  rpc.export.mockReset();
  rpc.export.mockResolvedValue({
    content: "# Doc",
    format: "Markdown",
    markdown: "# Doc",
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () =>
    root.render(
      <QueryClientProvider client={new QueryClient()}>
        <DocumentTransferForm
          disabled={false}
          documents={[]}
          onCommitted={committed}
          record={{ id: "doc", projectId: "p", revision: 4 } as Document}
        />
      </QueryClientProvider>,
    ),
  );
  await act(async () =>
    [...host.querySelectorAll("button")]
      .find((item) => item.textContent === "Export")
      ?.click(),
  );
  await act(() => {
    document.body
      .querySelector("form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    return Promise.resolve();
  });
  expect(rpc.export).toHaveBeenCalledWith({
    documentId: "doc",
    format: "Markdown",
    revision: 4,
  });
  expect(document.body.textContent).toContain("# Doc");
  await act(async () => root.unmount());
  host.remove();
});
