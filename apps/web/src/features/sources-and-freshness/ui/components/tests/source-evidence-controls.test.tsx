// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SourceEvidenceControls } from "../source-evidence-controls";

const rpc = vi.hoisted(() => ({
  reviewSourceEvidence: vi.fn(),
  bindSourceEvidence: vi.fn(),
}));
const listing = vi.hoisted(() => ({
  signal: {
    id: "source-version-in-use:source-1",
    type: "source-version-in-use" as const,
    sourceId: "source-1",
    versionRevision: 2,
    useIds: ["use-1"],
  },
  uses: [
    {
      accessedAt: "2026-10-01T09:00:00Z",
      id: "use-1",
      newerVersionExists: true,
      pin: {
        source: { sourceId: "source-1", revision: 1 },
        start: 0,
        end: 8,
        excerpt: "Original",
      },
      readOnly: false,
      reviewedAt: null,
      reviewedBy: null,
      reviewedSourceRevision: null,
      revision: 1,
      role: "Unspecified",
      target: { type: "Work", id: "work-1" },
      targetTitle: "Live Work source",
    },
  ],
}));
vi.mock("@/utils/orpc", () => ({
  client: rpc,
  orpc: {
    sourceEvidenceUses: {
      queryOptions: () => ({
        queryKey: ["uses"],
        queryFn: async () => listing,
      }),
    },
  },
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => unknown) => write(),
}));

const source = {
  id: "source-1",
  projectId: "project-1",
  sourceType: "Source" as const,
  revision: 1,
  createdAt: "2026-10-01T09:00:00Z",
  updatedAt: "2026-10-01T09:00:00Z",
  version: {
    sourceId: "source-1",
    revision: 1,
    title: "Original",
    url: "https://example.org/research",
    accessedAt: "2026-10-01T09:00:00Z",
    savedAt: "2026-10-01T09:00:00Z",
    capturedContent: "Original",
    provider: null,
    externalRecordType: null,
    externalId: null,
  },
};

test("keeping the current version waits until the Source record reaches the revision the uses already report", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  rpc.reviewSourceEvidence.mockReset().mockResolvedValue({});
  const render = (revision: number) =>
    root.render(
      <QueryClientProvider client={cache}>
        <SourceEvidenceControls
          preferences={DEFAULT_ACCOUNT_PREFERENCES}
          readOnly={false}
          source={{ ...source, revision }}
        />
      </QueryClientProvider>,
    );
  const keep = () =>
    Array.from(container.querySelectorAll("button")).find(
      (value) => value.textContent === "Reviewed; keep current version",
    );
  try {
    await act(async () => render(1));
    await act(async () => container.querySelector("button")?.click());
    await vi.waitFor(() => expect(keep()).toBeDefined());
    expect(keep()?.disabled).toBe(true);
    await act(async () => keep()?.click());
    expect(rpc.reviewSourceEvidence).not.toHaveBeenCalled();
    await act(async () => render(2));
    expect(keep()?.disabled).toBe(false);
    await act(async () => keep()?.click());
    expect(rpc.reviewSourceEvidence).toHaveBeenCalledWith(
      expect.objectContaining({ expectedSourceRevision: 2 }),
    );
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    container.remove();
  }
});
