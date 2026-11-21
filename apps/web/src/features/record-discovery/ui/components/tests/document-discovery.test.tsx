// @vitest-environment happy-dom
import {
  recordDiscoveryIndexLabels,
  type UniversalSearchResult,
} from "@cantiara/api/record-discovery";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";
import DocumentDiscovery, {
  DiscoveryContent,
  discoveryIndexFailed,
  discoveryScopeValue,
  parseDiscoveryScope,
  parseDiscoveryView,
} from "../document-discovery";

const search =
  vi.fn<
    (query: string, signal: AbortSignal) => Promise<UniversalSearchResult[]>
  >();
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useMatches: () => [],
  useRouteContext: () => ({ session: { data: { user: { id: "account-1" } } } }),
}));
vi.mock("@/components/app-link", () => ({ AppLink: () => null }));
vi.mock("@/utils/orpc", () => ({
  orpc: {},
  universalSearchQueryOptions: (account: string, input: { query: string }) => ({
    queryKey: ["search", account, input],
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      search(input.query, signal),
  }),
}));

function hit(title: string): UniversalSearchResult {
  return {
    archived: false,
    category: null,
    closureResult: null,
    id: title,
    key: null,
    matchCount: 1,
    ownerDocumentId: null,
    projectArchivedAt: null,
    projectId: "project-1",
    projectName: "Project",
    recordType: "Document",
    scopeName: "Project",
    scopeType: "Project",
    snippet: title,
    status: "Draft",
    title,
    updatedAt: "2026-10-01T00:00:00.000Z",
  };
}

test("Search delays typing, discards superseded results, and cancels pending work when closed", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const older = Promise.withResolvers<UniversalSearchResult[]>();
  let oldSignal: AbortSignal | undefined;
  search.mockImplementation((query, signal) => {
    if (query === "old") {
      oldSignal = signal;
      return older.promise;
    }
    return Promise.resolve([hit("Fresh result")]);
  });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const cache = new QueryClient();
  const advance = (ms: number) =>
    act(() => vi.advanceTimersByTimeAsync(ms).then(() => undefined));

  try {
    await act(() =>
      root.render(
        <QueryClientProvider client={cache}>
          <DocumentDiscovery />
        </QueryClientProvider>,
      ),
    );
    await act(() => host.querySelector("button")?.click());
    const field = document.querySelector<HTMLInputElement>(
      '[id="discovery-query"]',
    );
    if (!field) {
      throw new Error("Search field is missing");
    }
    const type = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });

    await type("o");
    await advance(100);
    expect(search).not.toHaveBeenCalled();
    await type("old");
    expect(field.value).toBe("old");
    await advance(260);
    expect(search.mock.calls.map(([query]) => query)).toEqual(["old"]);

    await type("fresh");
    expect(oldSignal?.aborted).toBe(true);
    await act(() => older.resolve([hit("Superseded result")]));
    await advance(100);
    expect(document.body.textContent).not.toContain("Superseded result");
    await advance(160);
    await advance(10);
    expect(document.body.textContent).toContain("Fresh result");

    await type("discarded");
    await act(() =>
      field.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      ),
    );
    await advance(300);
    expect(search.mock.calls.map(([query]) => query)).toEqual(["old", "fresh"]);
  } finally {
    await act(() => root.unmount());
    cache.clear();
    host.remove();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  }
});

test("scope controls round-trip exact homes and reject invalid selections", () => {
  const scopes = [
    { kind: "all" } as const,
    { kind: "wiki" } as const,
    { kind: "project", projectId: "project:one" } as const,
  ];
  for (const scope of scopes) {
    expect(parseDiscoveryScope(discoveryScopeValue(scope))).toEqual(scope);
  }
  for (const value of ["unknown", "project:", "other:project-one"]) {
    expect(() => parseDiscoveryScope(value)).toThrow();
  }
  expect(parseDiscoveryView("Search")).toBe("Search");
  expect(parseDiscoveryView("All Documents")).toBe("All Documents");
  expect(parseDiscoveryView("Table")).toBe("Table");
  expect(() => parseDiscoveryView("unknown")).toThrow();
});

test("exposes the closed zero-setup index list in the discovery selector", () => {
  expect(recordDiscoveryIndexLabels).toEqual([
    "All Work",
    "All Documents",
    "All Decisions",
    "All Risks",
    "All Research Sessions",
    "All Tests",
    "All Designs",
    "All Technical Diagrams",
    "All Project Releases",
    "All Sources",
    "All Files",
  ]);
  for (const label of recordDiscoveryIndexLabels) {
    expect(parseDiscoveryView(label)).toBe(label);
  }
});

test("treats required index lookup failures as unavailable", () => {
  expect(
    discoveryIndexFailed({
      index: "All Work",
      inventoryFailed: false,
      projectsFailed: true,
      resultsFailed: false,
    }),
  ).toBe(true);
  expect(
    discoveryIndexFailed({
      index: "All Files",
      inventoryFailed: true,
      projectsFailed: false,
      resultsFailed: false,
    }),
  ).toBe(true);
  expect(
    discoveryIndexFailed({
      index: "All Work",
      inventoryFailed: true,
      projectsFailed: false,
      resultsFailed: false,
    }),
  ).toBe(false);
});

test("uses the prepared index empty state instead of search wording", () => {
  const markup = renderToStaticMarkup(
    DiscoveryContent({
      data: [],
      failed: false,
      index: "All Tests",
      onOpenSource: () => undefined,
      pending: false,
    }),
  );

  expect(markup).toContain("No records in this index.");
  expect(markup).not.toContain("No matching records.");
});
