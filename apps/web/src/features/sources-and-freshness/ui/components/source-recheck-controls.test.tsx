// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { SourceRecheckControls } from "./source-recheck-controls";

const rpc = vi.hoisted(() => ({
  recheckSource: vi.fn(),
  decideSourceCheck: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: rpc,
  orpc: {
    sourceEvidenceUses: {
      queryOptions: () => ({ queryKey: ["uses"], queryFn: async () => null }),
    },
    sourceChecks: {
      queryOptions: () => ({ queryKey: ["checks"], queryFn: async () => [] }),
    },
    source: {
      queryOptions: () => ({ queryKey: ["source"], queryFn: async () => null }),
    },
    projectSources: {
      queryOptions: () => ({
        queryKey: ["sources"],
        queryFn: async () => null,
      }),
    },
  },
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
    capturedContent: "Finding.",
    provider: null,
    externalRecordType: null,
    externalId: null,
  },
};

test("opening Source Check previews the URL and third-party fetch before any explicit recheck", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  rpc.recheckSource.mockReset().mockResolvedValue(null);
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <SourceRecheckControls
            preferences={DEFAULT_ACCOUNT_PREFERENCES}
            readOnly={false}
            source={source}
          />
        </QueryClientProvider>,
      ),
    );
    expect(rpc.recheckSource).not.toHaveBeenCalled();
    await act(async () => container.querySelector("button")?.click());
    expect(container.textContent).toContain("https://example.org/research");
    expect(container.textContent).toContain("Version 1");
    expect(container.textContent).toContain("third-party server");
    expect(rpc.recheckSource).not.toHaveBeenCalled();
    const button = Array.from(container.querySelectorAll("button")).find(
      (value) => value.textContent === "Recheck source",
    );
    expect(button).toBeDefined();
    await act(async () => button?.click());
    expect(rpc.recheckSource).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "source-1",
        expectedSourceRevision: 1,
      }),
    );
    expect(rpc.decideSourceCheck).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    cache.clear();
    container.remove();
  }
});
