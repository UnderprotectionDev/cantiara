// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { CaptureInboxItem } from "@cantiara/api/capture-triage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  convertCapture: vi.fn(),
  previewCaptureConversion: vi.fn(),
}));
vi.mock("@/features/web-macos-client/hooks/use-client-shell", () => ({
  useClientShell: () => ({
    runOnlineOnly: (write: () => Promise<unknown>) => write(),
    runWrite: (write: () => Promise<unknown>) => write(),
  }),
  useClientShellConnection: () => "online",
}));
vi.mock("@/utils/orpc", () => ({
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

import { CaptureInboxItemActions } from "../capture-inbox-item-actions";

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

test("converting a capture into a record refreshes Smart Collection membership", async () => {
  rpc.previewCaptureConversion.mockResolvedValue({
    fieldMappings: [],
    previewId: "preview-1",
    proposedRecord: { recordType: "Work", title: "Retry failed payouts" },
    proposedRelations: [],
    source: item,
    targetScope: { label: "Project", projectId: "p1" },
  });
  rpc.convertCapture.mockResolvedValue({});
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
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
  expect(rpc.previewCaptureConversion).toHaveBeenCalled();
  await act(async () => buttonNamed(container, "Confirm")?.click());

  expect(rpc.convertCapture).toHaveBeenCalled();
  const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  expect(keys).toContainEqual(["captureInbox", "a1"]);
  expect(keys).toContainEqual(["smartCollectionViews"]);
  expect(keys).toContainEqual(["documentLiveOtherBlocks"]);
  act(() => root.unmount());
  container.remove();
});
