// biome-ignore-all lint/performance/noJsxPropsBind: Bulk sense-making controls close over their current layout and item state.
import type { AccountPreferences } from "@cantiara/api/account-preferences";
import type {
  CaptureBulkCluster,
  CaptureBulkSenseMaking,
  CaptureInboxItem,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  useClientShell,
  useClientShellConnection,
} from "@/features/web-macos-client/hooks/use-client-shell";
import { captureInboxQueryOptions, client } from "@/utils/orpc";

import {
  type BulkSenseMakingDraft,
  bulkSenseMakingColumns,
  captureCountLabel,
  type UndoPreviewState,
} from "../../lib/capture-inbox";
import { CaptureInboxItemActions } from "./capture-inbox-item-actions";

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
  onUndoPreview: (state: UndoPreviewState) => void;
  triageAvailable: boolean;
  view: CaptureBulkSenseMaking;
}) {
  const queryClient = useQueryClient();
  const shell = useClientShell();
  const connection = useClientShellConnection();
  const [layout, setLayout] = useState(view);
  const [newClusterName, setNewClusterName] = useState("");

  useEffect(() => setLayout(view), [view]);

  const saveLayout = useMutation({
    mutationFn: (next: BulkSenseMakingDraft) =>
      shell.runWrite(() =>
        client.updateCaptureBulkSenseMaking({
          baseRevision: layout.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          clusters: next.clusters,
          placements: next.placements,
        }),
      ),
    onMutate: (next) => {
      const previousLayout = layout;
      setLayout({ ...next, revision: previousLayout.revision });
      return { previousLayout };
    },
    onError: async (_error, _next, context) => {
      setLayout(context?.previousLayout ?? view);
      toast.error("Bulk sense-making could not be saved.");
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
    onSuccess: async (next) => {
      setLayout(next);
      await queryClient.invalidateQueries({
        queryKey: captureInboxQueryOptions(accountId).queryKey,
      });
    },
  });

  const isOnline = connection !== "offline";
  const columns = bulkSenseMakingColumns(items, layout);

  function persist(next: BulkSenseMakingDraft) {
    if (!isOnline || saveLayout.isPending) {
      return;
    }
    saveLayout.mutate(next);
  }

  function addCluster(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newClusterName.trim();
    if (!name) {
      return;
    }
    const position =
      Math.max(-1, ...layout.clusters.map((cluster) => cluster.position)) + 1;
    persist({
      clusters: [
        ...layout.clusters,
        { id: crypto.randomUUID(), name, position },
      ],
      placements: layout.placements,
    });
    setNewClusterName("");
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
          <h2 className="font-semibold text-lg tracking-tight">
            Bulk sense-making
          </h2>
          <p className="mt-1 max-w-2xl text-muted-foreground text-sm/6">
            Arrange captures side by side before you choose one of the three
            exits. These names and positions are view metadata only.
          </p>
        </div>
        {saveLayout.isPending ? (
          <span className="text-muted-foreground text-xs">Saving layout…</span>
        ) : null}
      </header>

      <form className="flex flex-wrap items-end gap-2" onSubmit={addCluster}>
        <label className="grid gap-1 text-sm" htmlFor="bulk-cluster-name">
          New cluster name
          <Input
            id="bulk-cluster-name"
            onChange={(event) => setNewClusterName(event.target.value)}
            placeholder="Name a cluster"
            value={newClusterName}
          />
        </label>
        <Button
          disabled={!isOnline || saveLayout.isPending || !newClusterName.trim()}
          type="submit"
          variant="outline"
        >
          Add cluster
        </Button>
      </form>

      <div className="grid items-start gap-4 overflow-x-auto pb-2 md:auto-cols-[minmax(18rem,1fr)] md:grid-flow-col">
        {columns.map((column) => (
          <section
            aria-label={column.label}
            className="min-w-72 border border-border/70 bg-background"
            key={column.clusterId ?? "ungrouped"}
          >
            <header className="flex items-start justify-between gap-3 border-b bg-muted/25 px-3 py-3">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-sm">
                  {column.label}
                </h3>
                <p className="mt-1 text-muted-foreground text-xs">
                  {captureCountLabel(column.items.length)}
                </p>
              </div>
              {column.clusterId ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    aria-label={`Move ${column.label} left`}
                    disabled={!isOnline || saveLayout.isPending}
                    onClick={() => moveCluster(column.clusterId as string, -1)}
                    type="button"
                    variant="ghost"
                  >
                    Move left
                  </Button>
                  <Button
                    aria-label={`Move ${column.label} right`}
                    disabled={!isOnline || saveLayout.isPending}
                    onClick={() => moveCluster(column.clusterId as string, 1)}
                    type="button"
                    variant="ghost"
                  >
                    Move right
                  </Button>
                </div>
              ) : null}
            </header>
            <ul className="divide-y">
              {column.items.map((item) => {
                const itemPlacement = layout.placements.find(
                  (placement) => placement.itemId === item.id,
                );
                return (
                  <li className="space-y-3 p-3" key={item.id}>
                    <div className="flex items-center justify-between gap-2">
                      {item.template ? (
                        <span className="font-medium text-xs">
                          {item.template}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          Capture
                        </span>
                      )}
                      <NativeSelect
                        aria-label={`Place ${item.id}`}
                        disabled={!isOnline || saveLayout.isPending}
                        onChange={(event) =>
                          placeItem(item.id, event.target.value || null)
                        }
                        value={itemPlacement?.clusterId ?? ""}
                      >
                        <NativeSelectOption value="">
                          Ungrouped
                        </NativeSelectOption>
                        {layout.clusters
                          .slice()
                          .sort(
                            (left, right) =>
                              left.position - right.position ||
                              left.id.localeCompare(right.id),
                          )
                          .map((cluster) => (
                            <NativeSelectOption
                              key={cluster.id}
                              value={cluster.id}
                            >
                              {cluster.name}
                            </NativeSelectOption>
                          ))}
                      </NativeSelect>
                    </div>
                    {item.content ? (
                      <p className="whitespace-pre-wrap text-sm/6">
                        {item.content}
                      </p>
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
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}
