import {
  EMPTY_PERSONAL_VIEW,
  type PersonalMoodboardView,
} from "@cantiara/api/moodboard-viewport";
import { LiteDebouncer } from "@tanstack/pacer-lite";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { client, orpc } from "@/utils/orpc";

const SAVE_DELAY_MS = 600;

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
    mutationFn: (view: PersonalMoodboardView) =>
      client.saveMoodboardPersonalView({ moodboardId, view }),
    onSuccess: (saved) => queryClient.setQueryData(options.queryKey, saved),
  });
  const { mutate } = save;
  const mutateRef = useRef(mutate);
  mutateRef.current = mutate;
  // The last view wins; leaving the canvas flushes it instead of dropping it.
  const debouncer = useMemo(
    () =>
      new LiteDebouncer(
        (view: PersonalMoodboardView) => mutateRef.current(view),
        { wait: SAVE_DELAY_MS },
      ),
    [],
  );
  const schedule = useCallback(
    (view: PersonalMoodboardView) => debouncer.maybeExecute(view),
    [debouncer],
  );

  // Leaving the canvas keeps the last position.
  useEffect(() => () => debouncer.flush(), [debouncer]);

  return {
    isReady: query.isSuccess || query.isError,
    schedule,
    view: query.data ?? EMPTY_PERSONAL_VIEW,
  };
}
