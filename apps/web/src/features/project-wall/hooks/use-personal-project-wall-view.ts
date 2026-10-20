import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

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
  const pending = useRef<Pending | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
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
    (view: ProjectWallViewport) => {
      if (!wallId) {
        return;
      }
      if (pending.current && pending.current.wallId !== wallId) {
        flush();
      }
      pending.current = { view, wallId };
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush, wallId],
  );

  // Switching or leaving a wall keeps the last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new wall id is the trigger to flush the old wall's pending save.
  useEffect(() => flush, [flush, wallId]);

  return {
    isReady: wallId === null || query.isSuccess || query.isError,
    /** The last personal-view save failure, cleared by the next save attempt. */
    saveError,
    saved: query.data ?? null,
    schedule,
  };
}
