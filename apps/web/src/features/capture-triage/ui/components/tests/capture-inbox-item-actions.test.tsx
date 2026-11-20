// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { CaptureInboxItem } from "@cantiara/api/capture-triage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  convertCapture: vi.fn(),
  previewCaptureConversion: vi.fn(),
  previewCaptureMergeUndo: vi.fn(),
  undoCaptureMerge: vi.fn(),
}));
vi.mock("@/features/web-macos-client/hooks/use-client-shell", () => ({
  useClientShell: () => ({
    runOnlineOnly: (write: () => Promise<unknown>) => write(),
    runWrite: (write: () => Promise<unknown>) => write(),
  }),
  useClientShellConnection: () => "online",
}));
vi.mock("@/utils/orpc", async (importActual) => ({
  ...(await importActual<typeof import("@/utils/orpc")>()),
  captureInboxQueryOptions: (accountId: string) => ({
    queryKey: ["captureInbox", accountId],
  }),
  client: rpc,
  invalidateSmartCollectionMembership: (queries: QueryClient) =>
    [["smartCollectionViews"], ["documentLiveOtherBlocks"]].map((queryKey) =>
      queries.invalidateQueries({ queryKey }),
    ),
  projectsQueryOptions: () => ({
    queryFn: () => [{ id: "p1", name: "Payments" }],
    queryKey: ["projects"],
  }),
}));

import { useCaptureInboxUndo } from "../../../hooks/use-capture-inbox";
import {
  CaptureInboxItemActions,
  CaptureUndoPreviewPanel,
} from "../capture-inbox-item-actions";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const item = {
  content: "Retry failed payouts",
  createdAt: "2026-11-17T09:00:00.000Z",
  id: "c1",
  projectId: "p1",
} as CaptureInboxItem;

function changeSelect(select: HTMLSelectElement | null, value: string) {
  act(() => {
    if (select) {
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
}

function buttonNamed(container: HTMLElement, name: string) {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === name,
  );
}

test.each([false, true])(
  "converting a capture refreshes Smart Collection membership (retry: %s)",
  async (retry) => {
    rpc.previewCaptureConversion.mockResolvedValue({
      fieldMappings: [],
      previewId: "preview-1",
      proposedRecord: { recordType: "Work", title: "Retry failed payouts" },
      proposedRelations: [],
      source: item,
      targetScope: { label: "Project", projectId: "p1" },
    });
    rpc.convertCapture.mockReset().mockResolvedValue({});
    if (retry) {
      rpc.convertCapture.mockRejectedValueOnce(
        new Error("Update request failed."),
      );
    }
    const cache = new QueryClient();
    const invalidate = vi.spyOn(cache, "invalidateQueries");
    const container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () =>
      root.render(
        <QueryClientProvider client={cache}>
          <CaptureInboxItemActions
            accountId="a1"
            formattingPreferences={
              {
                ...DEFAULT_ACCOUNT_PREFERENCES,
                timeZone: "UTC",
              } as AccountPreferences
            }
            item={item}
            onUndoPreview={vi.fn()}
            triageAvailable
          />
        </QueryClientProvider>,
      ),
    );
    await act(async () => buttonNamed(container, "Convert")?.click());
    changeSelect(
      container.querySelector<HTMLSelectElement>(
        'select[aria-label="Conversion target"]',
      ),
      "Work",
    );
    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(
          new Event("submit", { bubbles: true, cancelable: true }),
        );
    });
    expect(rpc.previewCaptureConversion).toHaveBeenCalled();
    await act(async () => buttonNamed(container, "Confirm")?.click());

    expect(rpc.convertCapture).toHaveBeenCalled();
    if (retry) {
      await vi.waitFor(() =>
        expect(container.querySelector('[role="alert"]')).not.toBeNull(),
      );
      const conversion = cache.getMutationCache().getAll().at(-1);
      if (!conversion) {
        throw new Error("The conversion mutation did not register.");
      }
      await act(async () => {
        await conversion.execute(conversion.state.variables);
      });
      await vi.waitFor(() =>
        expect(container.querySelector('[role="alert"]')).toBeNull(),
      );
      expect(rpc.convertCapture.mock.calls[0]?.[0]).toEqual(
        rpc.convertCapture.mock.calls[1]?.[0],
      );
    }
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toContainEqual(["captureInbox", "a1"]);
    expect(keys).toContainEqual(["smartCollectionViews"]);
    expect(keys).toContainEqual(["documentLiveOtherBlocks"]);
    act(() => root.unmount());
    container.remove();
  },
);

function UndoWorkflow({
  onRestored,
}: {
  onRestored: (itemId: string) => void;
}) {
  const { showUndoPreview, undoPreview, cancelUndo, confirmUndo, isPending } =
    useCaptureInboxUndo("a1", onRestored);
  const open = useCallback(() => {
    showUndoPreview("merge-1");
  }, [showUndoPreview]);
  return (
    <>
      <button onClick={open} type="button">
        Preview merge undo
      </button>
      {undoPreview ? (
        <CaptureUndoPreviewPanel
          formattingPreferences={DEFAULT_ACCOUNT_PREFERENCES}
          onCancel={cancelUndo}
          onConfirm={confirmUndo}
          pending={isPending}
          preview={undoPreview}
        />
      ) : null}
    </>
  );
}

test("Undo Preview can be cancelled and reopened before restoring the selected capture", async () => {
  rpc.previewCaptureMergeUndo.mockResolvedValue({
    itemId: item.id,
    mergeId: "merge-1",
    previewId: "undo-preview-1",
    removeFromTarget: { attributedRelationIds: [], attributedValueKeys: [] },
    restore: item,
  });
  rpc.undoCaptureMerge.mockResolvedValue({ restoredItem: item });
  const onRestored = vi.fn();
  const cache = new QueryClient();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const dialog = () =>
    container.querySelector('[role="dialog"][aria-label="Undo Preview"]');
  try {
    act(() =>
      root.render(
        <QueryClientProvider client={cache}>
          <UndoWorkflow onRestored={onRestored} />
        </QueryClientProvider>,
      ),
    );
    await act(async () =>
      buttonNamed(container, "Preview merge undo")?.click(),
    );
    await vi.waitFor(() =>
      expect(dialog()?.textContent).toContain(item.content),
    );
    await act(async () => buttonNamed(container, "Cancel")?.click());
    await vi.waitFor(() => expect(dialog()).toBeNull());
    expect(rpc.undoCaptureMerge).not.toHaveBeenCalled();

    await act(async () =>
      buttonNamed(container, "Preview merge undo")?.click(),
    );
    await vi.waitFor(() => expect(dialog()).not.toBeNull());
    await act(async () => buttonNamed(container, "Confirm")?.click());
    await vi.waitFor(() => expect(onRestored).toHaveBeenCalledWith(item.id));
    expect(rpc.undoCaptureMerge).toHaveBeenCalledWith({
      clientIdempotencyKey: expect.any(String),
      mergeId: "merge-1",
      previewId: "undo-preview-1",
    });
    await vi.waitFor(() => expect(dialog()).toBeNull());
  } finally {
    act(() => root.unmount());
    container.remove();
    cache.clear();
  }
});
