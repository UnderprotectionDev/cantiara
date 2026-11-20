// @vitest-environment happy-dom

import type { SaveWorkDraftInput, WorkDraft } from "@cantiara/api/work-drafts";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import { ClientShellContext } from "@/features/web-macos-client/hooks/use-client-shell";
import { createClientShell } from "@/features/web-macos-client/store/client-shell";
import { orpc } from "@/utils/orpc";
import WorkDraftForm from "../work-draft-form";

const rpc = vi.hoisted(() => ({
  deleteWorkDraft: vi.fn(),
  finalizeWorkDraft: vi.fn(),
  saveWorkDraft: vi.fn(),
}));

vi.mock("@/utils/orpc", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/utils/orpc")>();
  return { ...original, client: rpc };
});

const projectId = "project-1";
const timestamp = "2026-10-04T08:00:00.000Z";
const savedDraft: WorkDraft = {
  checklist: [],
  createdAt: timestamp,
  customFieldValues: [],
  description: null,
  id: "draft-1",
  projectId,
  revision: 3,
  title: "Fix checkout",
  type: "Bug",
  updatedAt: timestamp,
};

function saveReceipt(input: SaveWorkDraftInput): WorkDraft {
  return {
    ...savedDraft,
    id: input.draftId,
    projectId: input.projectId,
    revision: input.baseRevision + 1,
    title: input.title,
  };
}

async function mount(drafts: WorkDraft[] = []) {
  const mutationCache = new MutationCache();
  const client = new QueryClient({
    defaultOptions: {
      mutations: { networkMode: "always", retry: false },
      queries: { staleTime: Number.POSITIVE_INFINITY },
    },
    mutationCache,
  });
  vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  client.setQueryData(orpc.workDrafts.queryKey({ input: {} }), drafts);
  client.setQueryData(orpc.projects.queryKey(), []);
  client.setQueryData(orpc.customFields.queryKey({ input: { projectId } }), []);

  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <QueryClientProvider client={client}>
        <ClientShellContext.Provider value={createClientShell()}>
          <WorkDraftForm projectId={projectId} />
        </ClientShellContext.Provider>
      </QueryClientProvider>,
    );
  });

  return {
    client,
    host,
    mutationCache,
    async close() {
      await act(async () => root.unmount());
      host.remove();
      client.clear();
    },
  };
}

async function click(host: HTMLDivElement, label: string) {
  const button = [...host.querySelectorAll("button")].find(
    (candidate) => candidate.textContent === label,
  );
  if (!button) {
    throw new Error(`Missing ${label}`);
  }
  await act(async () => button.click());
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.resetAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("Retrying Save retains the full draft command in Query", async () => {
  rpc.saveWorkDraft
    .mockRejectedValueOnce(new Error("Save response lost."))
    .mockImplementation(async (input: SaveWorkDraftInput) =>
      saveReceipt(input),
    );
  const { host, mutationCache, close } = await mount([savedDraft]);
  try {
    await click(host, "Resume");
    await click(host, "Save");
    await vi.waitFor(() =>
      expect(host.textContent).toContain("Save response lost."),
    );
    await click(host, "Save");
    await vi.waitFor(() => expect(host.textContent).toContain("Draft saved."));

    expect(rpc.saveWorkDraft.mock.calls[1]?.[0]).toEqual(
      rpc.saveWorkDraft.mock.calls[0]?.[0],
    );
    expect(
      mutationCache.findAll({ mutationKey: orpc.saveWorkDraft.mutationKey() }),
    ).toHaveLength(2);
  } finally {
    await close();
  }
});

test("Retrying Create after a lost finalize response replays before saving again", async () => {
  rpc.saveWorkDraft
    .mockImplementationOnce(async (input: SaveWorkDraftInput) =>
      saveReceipt(input),
    )
    .mockRejectedValue(new Error("This Draft was already consumed."));
  rpc.finalizeWorkDraft
    .mockRejectedValueOnce(new Error("Finalize response lost."))
    .mockResolvedValue({ key: "PAY-1", projectId });
  const { host, mutationCache, close } = await mount([savedDraft]);
  try {
    await click(host, "Resume");
    await click(host, "Create");
    await vi.waitFor(() =>
      expect(host.textContent).toContain("Finalize response lost."),
    );
    await click(host, "Create");
    await vi.waitFor(() =>
      expect(host.textContent).toContain("Work PAY-1 created."),
    );

    expect(rpc.saveWorkDraft).toHaveBeenCalledTimes(1);
    expect(rpc.finalizeWorkDraft.mock.calls[1]?.[0]).toEqual(
      rpc.finalizeWorkDraft.mock.calls[0]?.[0],
    );
    expect(
      mutationCache.findAll({
        mutationKey: orpc.finalizeWorkDraft.mutationKey(),
      }),
    ).toHaveLength(2);
  } finally {
    await close();
  }
});

test("Retrying Delete preserves its command identity and removes the Draft once", async () => {
  rpc.deleteWorkDraft
    .mockRejectedValueOnce(new Error("Delete response lost."))
    .mockResolvedValue({ deleted: true });
  const { host, mutationCache, close } = await mount([savedDraft]);
  try {
    await click(host, "Delete");
    await vi.waitFor(() =>
      expect(host.textContent).toContain("Delete response lost."),
    );
    await click(host, "Delete");
    await vi.waitFor(() =>
      expect(host.textContent).toContain("Draft deleted."),
    );
    await vi.waitFor(() =>
      expect(host.textContent).toContain("No Drafts yet."),
    );

    expect(rpc.deleteWorkDraft.mock.calls[1]?.[0]).toEqual(
      rpc.deleteWorkDraft.mock.calls[0]?.[0],
    );
    expect(
      mutationCache.findAll({
        mutationKey: orpc.deleteWorkDraft.mutationKey(),
      }),
    ).toHaveLength(2);
  } finally {
    await close();
  }
});
