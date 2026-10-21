import type { TechnicalDiagramViewport } from "@cantiara/api/technical-diagram-viewport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

import { client, orpc } from "@/utils/orpc";

const SAVE_DELAY_MS = 600;

/**
 * The signed-in user's personal viewport and view-local group collapse for one
 * Technical Diagram view. Saving never invalidates the diagram query: it is not
 * content, has no revision, and takes no part in versions, sharing or export.
 * Leaving the canvas or switching diagrams flushes the last position.
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
    mutationFn: (view: TechnicalDiagramViewport) =>
      client.saveTechnicalDiagramViewport({ ...input, viewport: view }),
    onError: () => setSaveError("Your personal view could not be saved."),
    onMutate: () => setSaveError(null),
    onSuccess: (saved) =>
      queryClient.setQueryData(
        orpc.technicalDiagramViewport.queryOptions({ input }).queryKey,
        saved,
      ),
  });
  const pending = useRef<TechnicalDiagramViewport | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { mutate } = save;

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pending.current) {
      mutate(pending.current);
      pending.current = null;
    }
  }, [mutate]);

  const schedule = useCallback(
    (view: TechnicalDiagramViewport) => {
      pending.current = view;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Switching or leaving a diagram keeps its last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new diagram or view is the trigger to flush the old one's pending save.
  useEffect(() => flush, [flush, diagramId, viewId]);

  return {
    isReady: query.isSuccess || query.isError,
    saveError,
    saved: query.data ?? null,
    schedule,
  };
}
