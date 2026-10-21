// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Workspace.
import type { ProductGapLinkTargetType } from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import {
  EMPTY_GAP_FILTER,
  type GapFilterValues,
  toCloseToolEscapeInput,
  toListFilter,
  toRecordToolEscapeInput,
} from "../lib/product-gap-form";
import { ProductGapsView } from "./product-gaps-view";

/**
 * The Workspace's Product Gap list and dogfooding summary. It records, relates
 * and converts nothing by itself: every write is the founder's explicit action.
 */
export default function ProductGapsSurface() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<GapFilterValues>(EMPTY_GAP_FILTER);
  const options = orpc.productGaps.queryOptions({
    input: toListFilter(filter),
  });
  const gaps = useQuery({ ...options, placeholderData: keepPreviousData });
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.productGaps.key(),
    });
  const loadEscapes = useCallback(
    (gap: { id: string }, active: GapFilterValues) =>
      client.productGapEscapes({ ...toListFilter(active), gapId: gap.id }),
    [],
  );
  const loadTargets = useCallback(
    (targetType: ProductGapLinkTargetType) =>
      client.productGapLinkTargets({ targetType }),
    [],
  );
  if (gaps.isPending) {
    return <p role="status">Loading Product Gaps…</p>;
  }
  if (!gaps.data) {
    return (
      <div className="space-y-3">
        <p role="alert">Product Gaps are unavailable.</p>
        <Button
          onClick={() => {
            gaps.refetch().catch(() => undefined);
          }}
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <ProductGapsView
      filter={filter}
      gaps={gaps.data.gaps}
      loadEscapes={loadEscapes}
      loadTargets={loadTargets}
      onCloseEscape={async (event, values, impact) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.closeToolEscape(
              toCloseToolEscapeInput(event.id, values, impact),
            ),
          );
        } finally {
          await refresh();
        }
      }}
      onConfirmFollowUp={async (gap, plan) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.confirmProductGapFollowUp({
              baseRevision: 0,
              clientIdempotencyKey: crypto.randomUUID(),
              gapId: gap.id,
              id: crypto.randomUUID(),
              plan,
              ...(plan.kind === "Work" ? { workId: crypto.randomUUID() } : {}),
            }),
          );
        } finally {
          await refresh();
        }
      }}
      onFilterChange={setFilter}
      onPreviewFollowUp={(gap, request) =>
        client.previewProductGapFollowUp({ ...request, gapId: gap.id })
      }
      onRecord={async (values) => {
        const { source } = values.escape;
        if (!source) {
          throw new Error("Choose the source Project or record.");
        }
        await runOnlineOnlyWrite(() =>
          client.recordToolEscape(toRecordToolEscapeInput(values, source)),
        );
        await refresh();
      }}
      onSetStatus={async (gap, status) => {
        try {
          await runOnlineOnlyWrite(() =>
            client.setProductGapStatus({
              expectedStatus: gap.status,
              gapId: gap.id,
              status,
            }),
          );
        } finally {
          await refresh();
        }
      }}
      tools={gaps.data.tools}
    />
  );
}
