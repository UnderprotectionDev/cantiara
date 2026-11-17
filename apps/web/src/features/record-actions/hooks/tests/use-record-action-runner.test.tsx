// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import type {
  RecordAction,
  RecordActionPreview,
} from "@cantiara/api/record-actions";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  applyRecordAction: vi.fn(),
  previewRecordAction: vi.fn(),
  undoRecordAction: vi.fn(),
  work: vi.fn(),
}));
vi.mock("@/features/web-macos-client/hooks/use-client-shell", () => ({
  useClientShellConnection: () => "online",
}));
vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/utils/orpc", () => {
  const options = (name: string) => ({
    queryOptions: ({ input }: { input?: unknown } = {}) => ({
      queryFn: () => (name === "work" ? rpc.work(input) : []),
      queryKey: [name, input],
    }),
  });
  return {
    client: rpc,
    invalidateSmartCollectionMembership: (queries: QueryClient) =>
      [["smartCollectionViews"]].map((queryKey) =>
        queries.invalidateQueries({ queryKey }),
      ),
    orpc: Object.fromEntries(
      [
        "customFieldProjectValues",
        "customFieldValues",
        "customFields",
        "dailyFocusDay",
        "projectWorks",
        "recordActions",
        "relations",
        "scopeTree",
        "usedIn",
        "work",
      ].map((name) => [name, options(name)]),
    ),
    projectWorksQueryPrefix: ["projectWorksPrefix"],
  };
});

import { useRecordActionRunner } from "../use-record-action-runner";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const work = {
  archivedAt: null,
  id: "w1",
  projectId: "p1",
  revision: 3,
} as WorkProfile;
const action = {
  id: "a1",
  steps: [
    { kind: "work-status", status: "Doing" },
    { kind: "daily-focus-membership", operation: "add" },
    {
      definitionId: "f1",
      kind: "custom-field-value",
      operation: "set",
      value: { kind: "text", value: "x" },
    },
  ],
} as unknown as RecordAction;
const preview = {
  actionId: "a1",
  actionRevision: 1,
  baseRevision: 3,
  focusDate: "2026-11-17",
  previewFingerprint: "a".repeat(64),
  runtimeInputs: {
    customFieldValues: {},
    relations: { i1: { recordId: "w2", recordType: "Work" } },
  },
  workId: "w1",
} as unknown as RecordActionPreview;

test("a committed Record Action refreshes every surface its steps can change", async () => {
  rpc.previewRecordAction.mockResolvedValue(preview);
  rpc.applyRecordAction.mockResolvedValue({
    receipt: { id: "r1" },
    status: "committed",
  });
  const cache = new QueryClient();
  const invalidate = vi.spyOn(cache, "invalidateQueries");
  let runner: ReturnType<typeof useRecordActionRunner> | undefined;
  function Probe() {
    runner = useRecordActionRunner("p1");
    return null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () =>
    root.render(
      <QueryClientProvider client={cache}>
        <Probe />
      </QueryClientProvider>,
    ),
  );
  await act(async () => runner?.start(action, work));
  await act(async () => runner?.apply());

  expect(rpc.applyRecordAction).toHaveBeenCalled();
  const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  expect(keys).toContainEqual(["smartCollectionViews"]);
  expect(keys).toContainEqual(["dailyFocusDay", { focusDate: "2026-11-17" }]);
  expect(keys).toContainEqual([
    "customFieldValues",
    { projectId: "p1", recordId: "w1", recordType: "Work" },
  ]);
  expect(keys).toContainEqual([
    "customFieldProjectValues",
    { projectId: "p1", recordType: "Work" },
  ]);
  expect(keys).toContainEqual([
    "relations",
    { recordId: "w1", recordType: "Work" },
  ]);
  expect(keys).toContainEqual([
    "relations",
    { recordId: "w2", recordType: "Work" },
  ]);
  act(() => root.unmount());
});
