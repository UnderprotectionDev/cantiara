// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: test stubs bind inline handlers.
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  updateDocument: vi.fn(),
}));
const current = {
  id: "doc",
  projectId: "project",
  revision: 3,
  title: "Current",
  body: "current",
  type: "General",
};
const draft = {
  id: "draft",
  projectId: "project",
  baseRevision: 2,
  title: "Draft",
  body: "draft",
  type: "General",
};

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => ({
  client: { updateDocument: mocks.updateDocument },
  invalidateSmartCollectionMembership: mocks.membership,
  orpc: {
    documentConflictDrafts: {
      queryOptions: () => ({
        queryKey: ["drafts"],
        queryFn: async () => [draft],
      }),
    },
    document: {
      queryOptions: () => ({
        queryKey: ["document"],
        queryFn: async () => current,
      }),
    },
  },
}));
vi.mock("../../forms/document-conflict-result-form", () => ({
  default: ({ onApply }: { onApply: (v: object) => void }) => (
    <button
      onClick={() => onApply({ title: "T", body: "B", type: "General" })}
      type="button"
    >
      Apply parts
    </button>
  ),
}));
vi.mock("../../forms/document-conflict-independent-form", () => ({
  default: () => null,
}));

import DocumentConflictDrafts from "../document-conflict-drafts";

test("resolving a Conflict Draft refreshes Smart Collection membership because the Document content changed", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  mocks.membership.mockReset();
  mocks.membership.mockReturnValue([Promise.resolve()]);
  mocks.updateDocument.mockReset();
  mocks.updateDocument.mockResolvedValue(current);
  const queryClient = new QueryClient();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    await Promise.resolve();
    root.render(
      <QueryClientProvider client={queryClient}>
        <DocumentConflictDrafts
          disabled={false}
          documentId="doc"
          onResolved={() => undefined}
          rejected={null}
        />
      </QueryClientProvider>,
    );
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  const press = async (label: string) => {
    const button = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === label,
    );
    await act(async () => {
      await Promise.resolve();
      button?.click();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
  };
  await press("Compare");
  await press("Apply parts");
  expect(mocks.updateDocument).toHaveBeenCalledOnce();
  expect(mocks.membership).toHaveBeenCalledWith(queryClient);
  await act(async () => root.unmount());
});
