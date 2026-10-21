import type { TechnicalDiagramViewport } from "@cantiara/api/technical-diagram-viewport";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { client, orpc } from "@/utils/orpc";

const SAVE_DELAY_MS = 600;

interface Pending {
  diagramId: string;
  /** The exact Diagram View; empty when the diagram has none. */
  viewId?: string;
  viewport: TechnicalDiagramViewport;
}

/**
 * The signed-in user's personal viewport and view-local group collapse for one
 * Technical Diagram view. Saving never invalidates the diagram query: it is not
 * content, has no revision, and takes no part in versions, sharing or export.
 * Leaving the canvas or switching diagrams flushes the last position under the
 * identity it was scheduled for, so a late flush never tries the new diagram's key.
 */
export function usePersonalTechnicalDiagramView(
  diagramId: string,
  viewId: string | undefined,
) {
  const queryClient = useQueryClient();
  const input = { diagramId, ...(viewId ? { viewId } : {}) };
  const query = useQuery(orpc.technicalDiagramViewport.queryOptions({ input }));
  const [saveError, setSaveError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: ({
      diagramId: pendingDiagram,
      viewId: pendingView,
      viewport,
    }: Pending) =>
      client.saveTechnicalDiagramViewport({
        diagramId: pendingDiagram,
        ...(pendingView ? { viewId: pendingView } : {}),
        viewport,
      }),
    onError: () => setSaveError("Your personal view could not be saved."),
    onMutate: () => setSaveError(null),
    onSuccess: (saved, { diagramId: target, viewId: savedFor }) =>
      queryClient.setQueryData(
        orpc.technicalDiagramViewport.queryOptions({
          input: {
            diagramId: target,
            ...(savedFor ? { viewId: savedFor } : {}),
          },
        }).queryKey,
        saved,
      ),
  });
  const { mutate } = save;
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  // The last viewport wins; leaving or switching flushes it instead of dropping it.
  const debouncer = useMemo(
    () =>
      new LiteDebouncer((pending: Pending) => mutateRef.current(pending), {
        wait: SAVE_DELAY_MS,
      }),
    [],
  );
  // The pending save carries the identity of the schedule call, so a flush
  // that lands after a switch still writes the diagram and view it was for.
  const schedule = (viewport: TechnicalDiagramViewport) =>
    debouncer.maybeExecute({
      diagramId,
      ...(viewId ? { viewId } : {}),
      viewport,
    });

  // Switching or leaving a diagram keeps its last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new diagram or view is the trigger to flush the old one's pending save.
  useEffect(() => () => debouncer.flush(), [debouncer, diagramId, viewId]);

  return {
    isReady: query.isSuccess || query.isError,
    saveError,
    saved: query.data ?? null,
    schedule,
  };
}
