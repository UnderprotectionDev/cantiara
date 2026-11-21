// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to the Workspace.

import {
  type AccountPreferences,
  DEFAULT_ACCOUNT_PREFERENCES,
} from "@cantiara/api/account-preferences";
import type { ProductGapLinkTargetType } from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import {
  hashKey,
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useRef } from "react";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { ClientShellContent } from "@/features/web-macos-client/ui/components/client-shell";
import { fetchFresh } from "@/lib/fetch-fresh";
import {
  client,
  invalidateSmartCollectionMembership,
  orpc,
} from "@/utils/orpc";
import {
  type GapFilterValues,
  toCloseToolEscapeInput,
  toListFilter,
  toRecordToolEscapeInput,
} from "../../lib/product-gap-form";
import { ProductGapsBoard } from "../components/product-gaps-board";

/**
 * Formats a stored instant with the account `Locale`, `Time zone` and
 * `Date format`; the browser default stands in when preferences have not
 * loaded or a value cannot be formatted.
 */
export function gapDateTimeFormatter(
  preferences: AccountPreferences | undefined,
): (value: string) => string {
  return (value: string) => {
    try {
      return formatAccountDateTime(
        value,
        preferences ?? DEFAULT_ACCOUNT_PREFERENCES,
      );
    } catch {
      return new Date(value).toLocaleString();
    }
  };
}

/**
 * The Workspace's Product Gap list and dogfooding summary. It records, relates
 * and converts nothing by itself: every write is the founder's explicit action.
 */
function ProductGapsContent({ filter, onFilterChange }: ProductGapsViewProps) {
  const followUpIdentity = useRef<{
    fingerprint: string;
    id: string;
    key: string;
    workId: string;
  } | null>(null);
  const closeToolEscapeMutation = useMutation(
    orpc.closeToolEscape.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.closeToolEscape(input),
      onSettled: () => refresh(),
    }),
  );
  const confirmProductGapFollowUpMutation = useMutation(
    orpc.confirmProductGapFollowUp.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.confirmProductGapFollowUp(input),
      onSuccess: async (_, input) => {
        if (followUpIdentity.current?.key === input.clientIdempotencyKey) {
          followUpIdentity.current = null;
        }
        await Promise.all([
          refresh(),
          ...(input.plan.kind === "Work"
            ? invalidateSmartCollectionMembership(queryClient)
            : []),
        ]);
      },
      onError: () => refresh(),
    }),
  );
  const recordToolEscapeMutation = useMutation(
    orpc.recordToolEscape.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.recordToolEscape(input),
      onSuccess: () => refresh(),
    }),
  );
  const setProductGapStatusMutation = useMutation(
    orpc.setProductGapStatus.mutationOptions({
      meta: { onlineWrite: true },
      mutationFn: (input) => client.setProductGapStatus(input),
      onSettled: () => refresh(),
    }),
  );
  const queryClient = useQueryClient();
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
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
  if (gaps.status === "pending") {
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
    <ProductGapsBoard
      filter={filter}
      followUpWrite={confirmProductGapFollowUpMutation}
      formatDateTime={gapDateTimeFormatter(preferences.data)}
      gaps={gaps.data.gaps}
      loadEscapes={loadEscapes}
      loadTargets={loadTargets}
      onCloseEscape={(event, values, impact) =>
        closeToolEscapeMutation.mutateAsync(
          toCloseToolEscapeInput(event.id, values, impact),
        )
      }
      onConfirmFollowUp={(gap, plan) => {
        const fingerprint = hashKey([gap.id, plan]);
        if (followUpIdentity.current?.fingerprint !== fingerprint) {
          followUpIdentity.current = {
            fingerprint,
            id: crypto.randomUUID(),
            key: crypto.randomUUID(),
            workId: crypto.randomUUID(),
          };
        }
        const identity = followUpIdentity.current;
        return confirmProductGapFollowUpMutation.mutateAsync({
          baseRevision: 0,
          clientIdempotencyKey: identity.key,
          gapId: gap.id,
          id: identity.id,
          plan,
          ...(plan.kind === "Work" ? { workId: identity.workId } : {}),
        });
      }}
      onFilterChange={onFilterChange}
      onPreviewFollowUp={(gap, request) =>
        fetchFresh(queryClient, {
          ...orpc.previewProductGapFollowUp.queryOptions({
            input: { ...request, gapId: gap.id },
          }),
          gcTime: 0,
        })
      }
      onRecord={async (values) => {
        const { source } = values.escape;
        if (!source) {
          throw new Error("Choose the source Project or record.");
        }
        await recordToolEscapeMutation.mutateAsync(
          toRecordToolEscapeInput(values, source),
        );
      }}
      onSetStatus={(gap, status) =>
        setProductGapStatusMutation.mutateAsync({
          expectedStatus: gap.status,
          gapId: gap.id,
          status,
        })
      }
      statusWrite={setProductGapStatusMutation}
      tools={gaps.data.tools}
    />
  );
}

interface ProductGapsViewProps {
  filter: GapFilterValues;
  onFilterChange: (value: GapFilterValues) => void;
}

export default function ProductGapsView(props: ProductGapsViewProps) {
  return (
    <ClientShellContent>
      <ProductGapsContent {...props} />
    </ClientShellContent>
  );
}
