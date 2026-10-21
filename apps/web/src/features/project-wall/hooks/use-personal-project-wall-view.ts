import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { client, orpc } from "@/utils/orpc";

const SAVE_DELAY_MS = 600;

interface Pending {
  view: ProjectWallViewport;
  wallId: string;
}

/**
 * The signed-in user's personal viewport and view-local group collapse for one
 * Project Wall. Saving never invalidates the wall query: it is not content, has
 * no revision, and takes no part in sharing, Snapshot or export. Leaving the
 * canvas or switching walls keeps the last position of the wall that was left.
 */
export function usePersonalProjectWallView(
  projectId: string,
  wallId: string | null,
) {
  const queryClient = useQueryClient();
  const query = useQuery(
    orpc.projectWallViewport.queryOptions({
      input: wallId ? { projectId, wallId } : skipToken,
    }),
  );
  const save = useMutation({
    mutationFn: ({ view, wallId: target }: Pending) =>
      client.saveProjectWallViewport({
        projectId,
        viewport: view,
        wallId: target,
      }),
    onMutate: () => setSaveError(null),
    onError: () => setSaveError("Your personal view could not be saved."),
    onSuccess: (saved, { wallId: target }) =>
      queryClient.setQueryData(
        orpc.projectWallViewport.queryOptions({
          input: { projectId, wallId: target },
        }).queryKey,
        saved,
      ),
  });
  const [saveError, setSaveError] = useState<string | null>(null);
  const { mutate } = save;
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  const debouncer = useMemo(
    () =>
      new LiteDebouncer((pending: Pending) => mutateRef.current(pending), {
        wait: SAVE_DELAY_MS,
      }),
    [],
  );
  // The wall of the last scheduled view; a different wall flushes it first.
  const scheduledWall = useRef<string | null>(null);

  const schedule = useCallback(
    (view: ProjectWallViewport) => {
      if (!wallId) {
        return;
      }
      if (scheduledWall.current && scheduledWall.current !== wallId) {
        debouncer.flush();
      }
      scheduledWall.current = wallId;
      debouncer.maybeExecute({ view, wallId });
    },
    [debouncer, wallId],
  );

  // Switching or leaving a wall keeps the last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new wall id is the trigger to flush the old wall's pending save.
  useEffect(() => () => debouncer.flush(), [debouncer, wallId]);

  return {
    isReady: wallId === null || query.isSuccess || query.isError,
    /** The last personal-view save failure, cleared by the next save attempt. */
    saveError,
    saved: query.data ?? null,
    schedule,
  };
}
