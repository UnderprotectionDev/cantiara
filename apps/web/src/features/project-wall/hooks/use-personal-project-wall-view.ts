import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { client, orpc } from "@/utils/orpc";

const SAVE_DELAY_MS = 600;

interface Pending {
  projectId: string;
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
    meta: { onlineWrite: true, retryInSurface: true },
    mutationKey: orpc.saveProjectWallViewport.mutationKey(),
    mutationFn: ({ projectId: owner, view, wallId: target }: Pending) =>
      client.saveProjectWallViewport({
        projectId: owner,
        viewport: view,
        wallId: target,
      }),
  });
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
  const scheduledWall = useRef<{ projectId: string; wallId: string } | null>(
    null,
  );

  const schedule = useCallback(
    (view: ProjectWallViewport) => {
      if (!wallId) {
        return;
      }
      if (
        scheduledWall.current &&
        (scheduledWall.current.wallId !== wallId ||
          scheduledWall.current.projectId !== projectId)
      ) {
        debouncer.flush();
      }
      scheduledWall.current = { projectId, wallId };
      const { queryKey } = orpc.projectWallViewport.queryOptions({
        input: { projectId, wallId },
      });
      queryClient
        .cancelQueries({ exact: true, queryKey })
        .catch(() => undefined);
      queryClient.setQueryData(queryKey, view);
      debouncer.maybeExecute({ projectId, view, wallId });
    },
    [debouncer, projectId, queryClient, wallId],
  );

  // Switching or leaving a wall keeps the last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new wall id is the trigger to flush the old wall's pending save.
  useEffect(() => () => debouncer.flush(), [debouncer, projectId, wallId]);

  return {
    isReady: wallId === null || query.isSuccess || query.isError,
    /** The last personal-view save failure, cleared by the next save attempt. */
    saveError:
      save.isError &&
      save.variables?.projectId === projectId &&
      save.variables.wallId === wallId
        ? "Your personal view could not be saved."
        : null,
    saved: query.data ?? null,
    schedule,
  };
}
