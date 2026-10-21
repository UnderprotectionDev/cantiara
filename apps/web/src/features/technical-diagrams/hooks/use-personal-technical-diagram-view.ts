import type { TechnicalDiagramViewport } from "@cantiara/api/technical-diagram-viewport";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const { mutate } = save;
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  // The last viewport wins; leaving or switching flushes it instead of dropping it.
  const debouncer = useMemo(
    () =>
      new LiteDebouncer(
        (view: TechnicalDiagramViewport) => mutateRef.current(view),
        { wait: SAVE_DELAY_MS },
      ),
    [],
  );

  // Switching or leaving a diagram keeps its last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new diagram or view is the trigger to flush the old one's pending save.
  useEffect(() => () => debouncer.flush(), [debouncer, diagramId, viewId]);

  return {
    isReady: query.isSuccess || query.isError,
    saveError,
    saved: query.data ?? null,
    schedule: debouncer.maybeExecute,
  };
}
