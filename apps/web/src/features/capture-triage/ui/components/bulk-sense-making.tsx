// biome-ignore-all lint/performance/noJsxPropsBind: Bulk sense-making controls close over their current layout and item state.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  CaptureBulkCluster,
  CaptureBulkSenseMaking,
  CaptureInboxItem,
  CaptureInboxSnapshot,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import {
  VirtualList,
  type VirtualRowProps,
} from "@cantiara/ui/components/virtual-list";
import { virtualRowId } from "@cantiara/ui/lib/virtual-list-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { useClientShellConnection } from "@/features/web-macos-client/hooks/use-client-shell";
import { commandVariables } from "@/lib/command-variables";
import { captureInboxQueryOptions, client, orpc } from "@/utils/orpc";

import {
  type BulkSenseMakingColumn,
  type BulkSenseMakingDraft,
  bulkSenseMakingColumns,
  captureCountLabel,
} from "../../lib/capture-inbox";
import { AddBulkClusterForm } from "../forms/add-bulk-cluster-form";
import { CaptureInboxItemActions } from "./capture-inbox-item-actions";

const COLUMN_LAYOUT_QUERY = "(min-width: 48rem)";

function subscribeToColumnLayout(onChange: () => void) {
  const query = window.matchMedia(COLUMN_LAYOUT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const horizontalColumns = () => window.matchMedia(COLUMN_LAYOUT_QUERY).matches;
const stackedColumns = () => false;

export default function BulkSenseMakingView({
  accountId,
  formattingPreferences,
  items,
  onUndoPreview,
  triageAvailable,
  view,
}: {
  accountId: string;
  formattingPreferences: AccountPreferences;
  items: CaptureInboxItem[];
  onUndoPreview: (mergeId: string) => void;
  triageAvailable: boolean;
  view: CaptureBulkSenseMaking;
}) {
  const horizontal = useSyncExternalStore(
    subscribeToColumnLayout,
    horizontalColumns,
    stackedColumns,
  );
  const queryClient = useQueryClient();
  const connection = useClientShellConnection();
  const { queryKey } = captureInboxQueryOptions(accountId);
  const pendingAdd = useRef<{
    name: string;
    command: Parameters<typeof client.updateCaptureBulkSenseMaking>[0];
  } | null>(null);

  const saveLayout = useMutation(
    orpc.updateCaptureBulkSenseMaking.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.updateCaptureBulkSenseMaking(input),
      onError: async () => {
        toast.error("Bulk sense-making could not be saved.");
        await queryClient.invalidateQueries({ queryKey });
      },
      onSuccess: async (next, input) => {
        if (
          pendingAdd.current?.command.clientIdempotencyKey ===
          input.clientIdempotencyKey
        ) {
          pendingAdd.current = null;
        }
        queryClient.setQueryData<CaptureInboxSnapshot>(queryKey, (inbox) =>
          inbox && inbox.bulkSenseMaking.revision <= next.revision
            ? { ...inbox, bulkSenseMaking: next }
            : inbox,
        );
        await queryClient.invalidateQueries({ queryKey });
      },
    }),
  );
  const pending = saveLayout.isPending ? saveLayout.variables : undefined;
  const layout = pending
    ? {
        clusters: pending.clusters,
        placements: pending.placements,
        revision: pending.baseRevision,
      }
    : view;

  function prepareLayout(next: BulkSenseMakingDraft) {
    return commandVariables<
      Omit<
        Parameters<typeof client.updateCaptureBulkSenseMaking>[0],
        "clientIdempotencyKey"
      >
    >(
      {
        baseRevision: layout.revision,
        clusters: next.clusters,
        placements: next.placements,
      },
      saveLayout.isError ? saveLayout.variables : undefined,
    );
  }

  const isOnline = connection !== "offline";
  const columns = bulkSenseMakingColumns(items, layout);

  function persist(next: BulkSenseMakingDraft) {
    if (!isOnline || saveLayout.isPending) {
      return;
    }
    pendingAdd.current = null;
    saveLayout.mutate(prepareLayout(next));
  }

  async function addCluster(name: string) {
    if (!isOnline || saveLayout.isPending) {
      // The add control is disabled in these states; keep the name and stop.
      throw new Error("addCluster blocked: offline or already saving");
    }
    if (pendingAdd.current?.name === name) {
      await saveLayout.mutateAsync(pendingAdd.current.command);
      return;
    }
    const position =
      Math.max(-1, ...layout.clusters.map((cluster) => cluster.position)) + 1;
    const command = prepareLayout({
      clusters: [
        ...layout.clusters,
        { id: crypto.randomUUID(), name, position },
      ],
      placements: layout.placements,
    });
    pendingAdd.current = { name, command };
    await saveLayout.mutateAsync(command);
  }

  function placeItem(itemId: string, clusterId: string | null) {
    const placements = layout.placements.filter(
      (placement) => placement.itemId !== itemId,
    );
    const nextPosition =
      Math.max(
        -1,
        ...placements
          .filter((placement) => placement.clusterId === clusterId)
          .map((placement) => placement.position),
      ) + 1;
    persist({
      clusters: layout.clusters,
      placements: [
        ...placements,
        { clusterId, itemId, position: nextPosition },
      ],
    });
  }

  function moveCluster(clusterId: string, direction: -1 | 1) {
    const clusters = [...layout.clusters].sort(
      (left, right) =>
        left.position - right.position || left.id.localeCompare(right.id),
    );
    const index = clusters.findIndex((cluster) => cluster.id === clusterId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= clusters.length) {
      return;
    }
    [clusters[index], clusters[nextIndex]] = [
      clusters[nextIndex] as CaptureBulkCluster,
      clusters[index] as CaptureBulkCluster,
    ];
    persist({
      clusters: clusters.map((cluster, position) => ({ ...cluster, position })),
      placements: layout.placements,
    });
  }

  return (
    <section
      aria-label="Bulk sense-making"
      className="space-y-5 rounded-lg border border-primary/35 bg-primary/5 p-4 shadow-sm sm:p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Bulk sense-making
          </h2>
          <p className="mt-1 max-w-2xl text-sm/6 text-muted-foreground">
            Arrange captures side by side before you choose one of the three
            exits. These names and positions are view metadata only.
          </p>
        </div>
        {saveLayout.isPending ? (
          <span className="text-xs text-muted-foreground">Saving layout…</span>
        ) : null}
      </header>

      <AddBulkClusterForm
        disabled={!isOnline || saveLayout.isPending}
        onAdd={addCluster}
      />

      <div className="overflow-x-auto pb-2" data-horizontal-scroll>
        <VirtualList
          as="div"
          className="grid items-start gap-4 md:auto-cols-[minmax(18rem,1fr)] md:grid-flow-col"
          estimateSize={horizontal ? 288 : 225}
          gap={16}
          getKey={(column) => column.clusterId ?? "ungrouped"}
          horizontal={horizontal}
          rows={columns}
        >
          {(column, columnProps) => (
            <BulkSenseMakingColumnView
              accountId={accountId}
              column={column}
              disabled={!isOnline || saveLayout.isPending}
              formattingPreferences={formattingPreferences}
              layout={layout}
              moveCluster={moveCluster}
              onUndoPreview={onUndoPreview}
              placeItem={placeItem}
              rowProps={columnProps}
              triageAvailable={triageAvailable}
            />
          )}
        </VirtualList>
      </div>
    </section>
  );
}

function BulkSenseMakingColumnView({
  accountId,
  column,
  disabled,
  formattingPreferences,
  layout,
  moveCluster,
  onUndoPreview,
  placeItem,
  rowProps,
  triageAvailable,
}: {
  accountId: string;
  column: BulkSenseMakingColumn;
  disabled: boolean;
  formattingPreferences: AccountPreferences;
  layout: BulkSenseMakingDraft;
  moveCluster: (clusterId: string, direction: -1 | 1) => void;
  onUndoPreview: (mergeId: string) => void;
  placeItem: (itemId: string, clusterId: string | null) => void;
  rowProps: VirtualRowProps;
  triageAvailable: boolean;
}) {
  const { clusterId } = column;
  return (
    <section
      {...rowProps}
      aria-label={column.label}
      className="min-w-72 border border-border/70 bg-background"
    >
      <header className="flex items-start justify-between gap-3 border-b bg-muted/25 px-3 py-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{column.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {captureCountLabel(column.items.length)}
          </p>
        </div>
        {clusterId ? (
          <div className="flex shrink-0 gap-1">
            <Button
              aria-label={`Move ${column.label} left`}
              disabled={disabled}
              onClick={() => moveCluster(clusterId, -1)}
              type="button"
              variant="ghost"
            >
              Move left
            </Button>
            <Button
              aria-label={`Move ${column.label} right`}
              disabled={disabled}
              onClick={() => moveCluster(clusterId, 1)}
              type="button"
              variant="ghost"
            >
              Move right
            </Button>
          </div>
        ) : null}
      </header>
      <VirtualList
        className="divide-y"
        estimateSize={132}
        gap={0}
        getKey={virtualRowId}
        rows={column.items}
      >
        {(item, itemProps) => {
          const itemPlacement = layout.placements.find(
            (placement) => placement.itemId === item.id,
          );
          return (
            <li className="space-y-3 p-3" {...itemProps}>
              <div className="flex items-center justify-between gap-2">
                {item.template ? (
                  <span className="text-xs font-medium">{item.template}</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Capture</span>
                )}
                <NativeSelect
                  aria-label={`Place ${item.id}`}
                  disabled={disabled}
                  onChange={(event) =>
                    placeItem(item.id, event.target.value || null)
                  }
                  value={itemPlacement?.clusterId ?? ""}
                >
                  <NativeSelectOption value="">Ungrouped</NativeSelectOption>
                  {layout.clusters
                    .slice()
                    .sort(
                      (left, right) =>
                        left.position - right.position ||
                        left.id.localeCompare(right.id),
                    )
                    .map((cluster) => (
                      <NativeSelectOption key={cluster.id} value={cluster.id}>
                        {cluster.name}
                      </NativeSelectOption>
                    ))}
                </NativeSelect>
              </div>
              {item.content ? (
                <p className="text-sm/6 whitespace-pre-wrap">{item.content}</p>
              ) : null}
              {Object.entries(item.fields).length > 0 ? (
                <dl className="space-y-2 text-xs">
                  {Object.entries(item.fields).map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="whitespace-pre-wrap">{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <CaptureInboxItemActions
                accountId={accountId}
                formattingPreferences={formattingPreferences}
                item={item}
                onUndoPreview={onUndoPreview}
                triageAvailable={triageAvailable}
              />
            </li>
          );
        }}
      </VirtualList>
    </section>
  );
}
