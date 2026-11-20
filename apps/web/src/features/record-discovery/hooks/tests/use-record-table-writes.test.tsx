// @vitest-environment happy-dom
// biome-ignore-all lint/suspicious/useAwait: React act exposes asynchronous event boundaries.
import type {
  RecordTableCellUpdateInput,
  RecordTablePasteInput,
  RecordTableRecord,
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
  orpc: {
    applyTablePaste: {
      mutationOptions: (options: object) => ({
        mutationKey: ["applyTablePaste"],
        ...options,
      }),
    },
    updateTableCell: {
      mutationOptions: (options: object) => ({
        mutationKey: ["updateTableCell"],
        ...options,
      }),
    },
  },
}));

import { createClientShellQueryClient } from "@/features/web-macos-client/lib/client-shell";
import { defaultClientShell } from "@/features/web-macos-client/store/client-shell";
import { RecordTableView } from "../../ui/components/record-table";
import { useRecordTableWrites } from "../use-record-table-writes";

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const tableKey = ["tableRecords", { recordType: "Work" }] as const;

function setup(queryClient = new QueryClient()) {
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
  return {
    invalidate,
    root,
    writes: () => writes as NonNullable<typeof writes>,
  };
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

test("Table writes cannot enter RPC while the desktop requires an update", async () => {
  const queryClient = createClientShellQueryClient(vi.fn());
  const { root, writes } = setup(queryClient);
  defaultClientShell.setUpdateRequired(true);
  try {
    await act(async () => {
      await expect(
        writes().saveTableCell({} as RecordTableCellUpdateInput),
      ).rejects.toThrow("Update required");
      await expect(
        writes().applyTablePaste({} as RecordTablePasteInput),
      ).rejects.toThrow("Update required");
    });
    expect(rpc.updateTableCell).not.toHaveBeenCalled();
    expect(rpc.applyTablePaste).not.toHaveBeenCalled();
  } finally {
    defaultClientShell.setUpdateRequired(false);
    await act(async () => root.unmount());
    queryClient.clear();
  }
});

test("retrying the same edited cell preserves its command and a changed value creates a new one", async () => {
  rpc.updateTableCell
    .mockRejectedValueOnce(new Error("Cell could not be saved."))
    .mockRejectedValueOnce(new Error("Try again."))
    .mockResolvedValueOnce(undefined);
  const queryClient = new QueryClient();
  const record = {
    createdAt: "2026-01-01T00:00:00.000Z",
    decision: "Ship in June",
    id: "decision-1",
    life: "Valid",
    projectId: "project-1",
    rationale: "Keep the first release focused.",
    revision: 2,
    sourceType: "Decision",
    title: "Choose a launch date",
    updatedAt: "2026-01-02T00:00:00.000Z",
  } satisfies RecordTableRecord;
  const noop = () => undefined;
  function Probe() {
    const { applyTablePaste, cellWrite, pasteWrite, saveTableCell } =
      useRecordTableWrites(tableKey);
    return (
      <RecordTableView
        cellWrite={cellWrite}
        onApplyPaste={applyTablePaste}
        onProjectChange={noop}
        onRecordTypeChange={noop}
        onSaveCell={saveTableCell}
        pasteWrite={pasteWrite}
        projectId="project-1"
        projects={[]}
        records={[record]}
        recordType="Decision"
      />
    );
  }
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  try {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });
    const field = host.querySelector<HTMLInputElement>(
      'input[aria-label="Edit Title for Choose a launch date"]',
    );
    if (!field) {
      throw new Error("The Title cell did not render.");
    }
    const change = async (value: string) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value",
        )?.set?.call(field, value);
        field.dispatchEvent(new Event("input", { bubbles: true }));
      });
    };
    const blur = async () => {
      await act(async () => {
        field.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
      });
    };
    await change("July launch");
    await blur();
    await vi.waitFor(() =>
      expect(host.textContent).toContain("Cell could not be saved."),
    );
    await blur();
    await vi.waitFor(() => expect(host.textContent).toContain("Try again."));
    await change("August launch");
    await blur();
    expect(rpc.updateTableCell.mock.calls[0]?.[0]).toMatchObject({
      baseRevision: 2,
      field: "title",
      projectId: "project-1",
      recordId: "decision-1",
      value: "July launch",
    });
    expect(rpc.updateTableCell.mock.calls[1]?.[0]).toEqual(
      rpc.updateTableCell.mock.calls[0]?.[0],
    );
    expect(rpc.updateTableCell.mock.calls[2]?.[0].value).toBe("August launch");
    expect(
      rpc.updateTableCell.mock.calls[2]?.[0].clientIdempotencyKey,
    ).not.toBe(rpc.updateTableCell.mock.calls[0]?.[0].clientIdempotencyKey);
  } finally {
    await act(async () => root.unmount());
    queryClient.clear();
    host.remove();
  }
});
