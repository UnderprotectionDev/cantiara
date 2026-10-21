// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Workspace.
import type { ProductGapLinkTargetType } from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";
import { toLinkInputs } from "../lib/product-gap-form";
import { ProductGapsView } from "./product-gaps-view";

/**
 * The Workspace's Product Gap list. It records, relates and converts nothing
 * by itself: every write is the founder's explicit action.
 */
export default function ProductGapsSurface() {
  const queryClient = useQueryClient();
  const options = orpc.productGaps.queryOptions();
  const gaps = useQuery(options);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: options.queryKey });
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
      gaps={gaps.data.gaps}
      loadTargets={loadTargets}
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
      onPreviewFollowUp={(gap, request) =>
        client.previewProductGapFollowUp({ ...request, gapId: gap.id })
      }
      onRecord={async (values) => {
        await runOnlineOnlyWrite(() =>
          client.recordProductGap({
            links: toLinkInputs(values.links),
            scope: values.scope || null,
            title: values.title,
            unmetNeed: values.unmetNeed,
          }),
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
    />
  );
}
