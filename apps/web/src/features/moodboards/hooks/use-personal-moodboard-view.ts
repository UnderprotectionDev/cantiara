import {
  EMPTY_PERSONAL_VIEW,
  type PersonalMoodboardView,
} from "@cantiara/api/moodboard-viewport";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { client, orpc } from "@/utils/orpc";

const SAVE_DELAY_MS = 600;

interface Pending {
  moodboardId: string;
  view: PersonalMoodboardView;
}

/**
 * The signed-in user's personal viewport and view-local collapse for one
 * Moodboard. Saving never invalidates the Moodboard query: it is not content,
 * has no revision, and takes no part in undo, sharing, Snapshot, or export.
 */
export function usePersonalMoodboardView(moodboardId: string) {
  const queryClient = useQueryClient();
  const options = orpc.moodboardPersonalView.queryOptions({
    input: { moodboardId },
  });
  const query = useQuery(options);
  const save = useMutation({
    meta: { onlineWrite: true, retryInSurface: true },
    mutationKey: orpc.saveMoodboardPersonalView.mutationKey(),
    mutationFn: (pending: Pending) => client.saveMoodboardPersonalView(pending),
    onSuccess: (saved, { moodboardId: target }) =>
      queryClient.setQueryData(
        orpc.moodboardPersonalView.queryOptions({
          input: { moodboardId: target },
        }).queryKey,
        saved,
      ),
  });
  const { mutate } = save;
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  // The last view wins; leaving the canvas flushes it instead of dropping it.
  const debouncer = useMemo(
    () =>
      new LiteDebouncer((pending: Pending) => mutateRef.current(pending), {
        wait: SAVE_DELAY_MS,
      }),
    [],
  );
  const schedule = useCallback(
    (view: PersonalMoodboardView) =>
      debouncer.maybeExecute({ moodboardId, view }),
    [debouncer, moodboardId],
  );

  // Leaving the canvas keeps the last position.
  // biome-ignore lint/correctness/useExhaustiveDependencies: A new Moodboard also flushes the old view.
  useEffect(() => () => debouncer.flush(), [debouncer, moodboardId]);

  return {
    isReady: query.isSuccess || query.isError,
    schedule,
    view: query.data ?? EMPTY_PERSONAL_VIEW,
  };
}
