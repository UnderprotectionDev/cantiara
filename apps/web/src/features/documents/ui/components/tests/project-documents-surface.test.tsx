// @vitest-environment happy-dom
// biome-ignore-all lint/performance/noJsxPropsBind: test stubs bind inline handlers.
import { expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  membership: vi.fn(),
  navigate: vi.fn(async () => undefined),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
  useSearch: () => false,
}));
vi.mock("@/utils/orpc", () => ({
  invalidateSmartCollectionMembership: mocks.membership,
  orpc: {
    documents: {
      key: () => ["documents"],
      queryOptions: ({ input }: { input: unknown }) => ({
        queryKey: ["documents", input],
        queryFn: async () => [],
      }),
    },
  },
}));
vi.mock("../../forms/document-templates-form", () => ({
  default: ({
    onCreated,
  }: {
    onCreated: (document: { id: string }) => Promise<void>;
  }) => (
    <button onClick={() => onCreated({ id: "created" })} type="button">
      Template created
    </button>
  ),
}));
vi.mock("../../forms/document-create-form", () => ({ default: () => null }));
vi.mock("../../forms/document-editor-form", () => ({ default: () => null }));
vi.mock("../document-navigation", () => ({ default: () => null }));

import DocumentsSurface from "../project-documents-surface";

test("a Document created from a Document Template refreshes every Document list and live collection membership", async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const { QueryClient, QueryClientProvider } = await import(
    "@tanstack/react-query"
  );
  const { act } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  mocks.membership.mockReset();
  mocks.membership.mockReturnValue([Promise.resolve()]);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    await Promise.resolve();
    root.render(
      <QueryClientProvider client={queryClient}>
        <DocumentsSurface projectId="project" starterSkeletons={[]} />
      </QueryClientProvider>,
    );
  });
  invalidate.mockClear();
  const button = [...container.querySelectorAll("button")].find(
    (item) => item.textContent === "Template created",
  );
  await act(async () => {
    await Promise.resolve();
    button?.click();
  });
  expect(mocks.navigate).toHaveBeenCalledWith(
    expect.objectContaining({ hash: "document-created" }),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["documents"] });
  expect(mocks.membership).toHaveBeenCalledWith(queryClient);
  await act(async () => root.unmount());
});
