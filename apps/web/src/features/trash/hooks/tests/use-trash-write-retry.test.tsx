// @vitest-environment happy-dom
import type { TrashEntry } from "@cantiara/api/trash";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";
import { usePermanentDeleteFlow } from "../use-permanent-delete-flow";
import { useRestoreFlow } from "../use-restore-flow";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const entry: TrashEntry = {
  expiresAt: "2026-03-31T00:00:00.000Z",
  groupId: null,
  id: "e1",
  projectId: "p1",
  recordId: "r1",
  recordKind: "Risk",
  recordLabel: "Slip",
  revision: 3,
  trashedAt: "2026-03-01T00:00:00.000Z",
  workspaceId: "w1",
};

test("Restore reuses the failed command and creates a new one for a newer revision", async () => {
  const onRestore = vi
    .fn()
    .mockRejectedValue(new Error("Connection interrupted"));
  const root = createRoot(document.createElement("div"));
  const cache = new QueryClient();
  let flow: ReturnType<typeof useRestoreFlow> | undefined;
  function Probe() {
    flow = useRestoreFlow({ onRestore });
    return null;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
    await act(async () => flow?.restore(entry));
    await vi.waitFor(() => expect(flow?.failedId).toBe(entry.id));
    await act(async () => flow?.restore(entry));
    expect(onRestore.mock.calls[1]).toEqual(onRestore.mock.calls[0]);
    await act(async () => flow?.restore({ ...entry, revision: 4 }));
    expect(onRestore.mock.calls[2]?.[1]).not.toBe(onRestore.mock.calls[0]?.[1]);
  } finally {
    await act(async () => root.unmount());
    cache.clear();
  }
});

test("Permanently Delete requires a fresh identity grant and reuses the reviewed command", async () => {
  const request = vi
    .fn()
    .mockRejectedValue(new Error("Connection interrupted"));
  const identity = vi
    .fn()
    .mockResolvedValueOnce("synthetic-grant-1")
    .mockResolvedValueOnce("synthetic-grant-2");
  const root = createRoot(document.createElement("div"));
  const cache = new QueryClient();
  const audit = vi.fn();
  const unsubscribe = cache.getMutationCache().subscribe(({ mutation }) => {
    if (mutation) {
      audit(JSON.stringify(mutation.state).includes("synthetic-grant-"));
    }
  });
  let flow: ReturnType<typeof usePermanentDeleteFlow> | undefined;
  function Probe() {
    flow = usePermanentDeleteFlow({
      confirmIdentity: identity,
      permanentlyDelete: request,
      preview: async () => ({
        blockers: [],
        entryId: entry.id,
        groupId: null,
        keepApprovedSurface: { available: false, reason: "Permanent delete" },
        members: [],
        typedNameTarget: { kind: "Project", name: "Test project" },
      }),
    });
    return null;
  }
  try {
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
    await act(async () => flow?.review(entry));
    await vi.waitFor(() => expect(flow?.deleting).toBeTruthy());
    await act(async () => flow?.confirmIdentity());
    await act(async () => flow?.deleteForever("Test project"));
    await vi.waitFor(() =>
      expect(flow?.error).toContain("Could not permanently delete"),
    );
    await act(async () => flow?.deleteForever("Test project"));
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => flow?.confirmIdentity());
    await act(async () => flow?.deleteForever("Test project"));
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[1]?.[1].clientIdempotencyKey).toBe(
      request.mock.calls[0]?.[1].clientIdempotencyKey,
    );
    expect(request.mock.calls[1]?.[1].grant).toBe("synthetic-grant-2");
    expect(audit).not.toHaveBeenCalledWith(true);
  } finally {
    unsubscribe();
    await act(async () => root.unmount());
    cache.clear();
  }
});
