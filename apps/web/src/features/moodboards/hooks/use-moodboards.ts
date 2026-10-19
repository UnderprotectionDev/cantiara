import type {
  Moodboard,
  MoodboardVisualOrigin,
} from "@cantiara/api/moodboards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { runOnlineOnlyWrite } from "@/features/web-macos-client/store/client-shell";
import { client, orpc } from "@/utils/orpc";

export function useMoodboards(projectId: string) {
  const queryClient = useQueryClient();
  const moodboardsQuery = useQuery(
    orpc.moodboards.queryOptions({ input: { projectId } }),
  );

  function invalidate() {
    return queryClient.invalidateQueries({
      queryKey: orpc.moodboards.queryOptions({ input: { projectId } }).queryKey,
    });
  }

  const createMoodboard = useMutation({
    mutationFn: (input: { title: string }) =>
      runOnlineOnlyWrite(() =>
        client.createMoodboard({
          baseRevision: 0,
          clientIdempotencyKey: crypto.randomUUID(),
          projectId,
          title: input.title,
        }),
      ),
    onSuccess: invalidate,
  });

  const addVisual = useMutation({
    mutationFn: (input: {
      caption: string | null;
      moodboard: Moodboard;
      origin: MoodboardVisualOrigin;
    }) =>
      runOnlineOnlyWrite(() =>
        client.addMoodboardVisual({
          baseRevision: input.moodboard.revision,
          caption: input.caption,
          clientIdempotencyKey: crypto.randomUUID(),
          moodboardId: input.moodboard.id,
          origin: input.origin,
        }),
      ),
    onSuccess: invalidate,
  });

  const updateCaption = useMutation({
    mutationFn: (input: {
      caption: string | null;
      itemId: string;
      moodboard: Moodboard;
    }) =>
      runOnlineOnlyWrite(() =>
        client.updateMoodboardVisualCaption({
          baseRevision: input.moodboard.revision,
          caption: input.caption,
          clientIdempotencyKey: crypto.randomUUID(),
          itemId: input.itemId,
          moodboardId: input.moodboard.id,
        }),
      ),
    onSuccess: invalidate,
  });

  return { addVisual, createMoodboard, moodboardsQuery, updateCaption };
}
