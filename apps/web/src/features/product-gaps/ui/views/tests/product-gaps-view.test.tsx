// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  confirmProductGapFollowUp: vi.fn(),
  view: {
    props: null as null | {
      onConfirmFollowUp: (...args: unknown[]) => unknown;
    },
  },
}));

vi.mock("@/features/web-macos-client/store/client-shell", () => ({
  runOnlineOnlyWrite: (write: () => Promise<unknown>) => write(),
}));
vi.mock("@/features/web-macos-client/ui/components/client-shell", () => ({
  ClientShellContent: ({ children }: { children: unknown }) => children,
}));
vi.mock("@/utils/orpc", async (importActual) => {
  const actual = await importActual<typeof import("@/utils/orpc")>();
  return {
    ...actual,
    client: { confirmProductGapFollowUp: rpc.confirmProductGapFollowUp },
  };
});
vi.mock("../../components/product-gaps-board", () => ({
  ProductGapsBoard: (props: {
    onConfirmFollowUp: (...args: unknown[]) => unknown;
  }) => {
    rpc.view.props = props;
    return null;
  },
}));

import { orpc } from "@/utils/orpc";
import { EMPTY_GAP_FILTER, toListFilter } from "../../../lib/product-gap-form";
import ProductGapsView from "../product-gaps-view";

function ignoreFilterChange() {
  /* This test exercises writes. */
}

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

describe("Product Gaps view", () => {
  test("confirming a Work follow-up refreshes Smart Collection membership", async () => {
    rpc.confirmProductGapFollowUp.mockResolvedValue({});
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      orpc.productGaps.queryOptions({ input: toListFilter(EMPTY_GAP_FILTER) })
        .queryKey,
      { gaps: [], tools: [] },
    );
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue(undefined);
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => {
      root?.render(
        <QueryClientProvider client={queryClient}>
          <ProductGapsView
            filter={EMPTY_GAP_FILTER}
            onFilterChange={ignoreFilterChange}
          />
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await rpc.view.props?.onConfirmFollowUp(
        { id: "gap-1" },
        { kind: "Work" },
      );
    });
    expect(rpc.confirmProductGapFollowUp).toHaveBeenCalledTimes(1);
    const keys = invalidate.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(orpc.smartCollectionViews.key());
  });
});
