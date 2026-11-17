// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import type {
  RecordTableCellUpdateInput,
  RecordTablePasteInput,
} from "@cantiara/api/record-discovery";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, test, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  applyTablePaste: vi.fn(),
  updateTableCell: vi.fn(),
}));
vi.mock("@/utils/orpc", () => ({
  client: rpc,
  invalidateSmartCollectionMembership: (queries: QueryClient) =>
    [["smartCollectionViews"], ["documentLiveOtherBlocks"]].map((queryKey) =>
      queries.invalidateQueries({ queryKey }),
    ),
}));

import { useRecordTableWrites } from "../use-record-table-writes";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const tableKey = ["tableRecords", { recordType: "Work" }] as const;

function setup() {
  const queryClient = new QueryClient();
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  let writes: ReturnType<typeof useRecordTableWrites> | undefined;
  function Probe() {
    writes = useRecordTableWrites(tableKey);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return { invalidate, writes: () => writes as NonNullable<typeof writes> };
}

function invalidatedKeys(spy: ReturnType<typeof setup>["invalidate"]) {
  return spy.mock.calls.map(([filters]) => filters?.queryKey);
}

beforeEach(() => {
  rpc.updateTableCell.mockReset();
  rpc.applyTablePaste.mockReset();
});

test("a saved cell refreshes the table and Smart Collection membership together", async () => {
  rpc.updateTableCell.mockResolvedValue(undefined);
  const { invalidate, writes } = setup();
  await act(async () => {
    await writes().saveTableCell({} as RecordTableCellUpdateInput);
  });
  expect(invalidatedKeys(invalidate)).toEqual(
    expect.arrayContaining([
      tableKey,
      ["smartCollectionViews"],
      ["documentLiveOtherBlocks"],
    ]),
  );
});

test("an applied paste refreshes the table and Smart Collection membership together", async () => {
  rpc.applyTablePaste.mockResolvedValue(undefined);
  const { invalidate, writes } = setup();
  await act(async () => {
    await writes().applyTablePaste({} as RecordTablePasteInput);
  });
  expect(invalidatedKeys(invalidate)).toEqual(
    expect.arrayContaining([
      tableKey,
      ["smartCollectionViews"],
      ["documentLiveOtherBlocks"],
    ]),
  );
});

test("a rejected write still rejects and refreshes nothing", async () => {
  rpc.updateTableCell.mockRejectedValue(new Error("stale"));
  const { invalidate, writes } = setup();
  await act(async () => {
    await expect(
      writes().saveTableCell({} as RecordTableCellUpdateInput),
    ).rejects.toThrow("stale");
  });
  expect(invalidate).not.toHaveBeenCalled();
});
