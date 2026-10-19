import {
  EMPTY_PERSONAL_VIEW,
  type PersonalMoodboardView,
} from "@cantiara/api/moodboard-viewport";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";

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
  const pending = useRef<PersonalMoodboardView | null>(null);
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
    (view: PersonalMoodboardView) => {
      pending.current = view;
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush],
  );

  // Leaving the canvas keeps the last position.
  useEffect(() => flush, [flush]);

  return {
    isReady: query.isSuccess || query.isError,
    schedule,
    view: query.data ?? EMPTY_PERSONAL_VIEW,
  };
}
