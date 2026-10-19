import type { SnapshotFormat } from "@cantiara/api/moodboard-snapshot";
import type { VisualView } from "@cantiara/api/moodboard-view";
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

  const addColorSwatch = useMutation({
    mutationFn: (input: {
      color: string;
      moodboard: Moodboard;
      note: string | null;
      paletteGroupId: string | null;
    }) =>
      runOnlineOnlyWrite(() =>
        client.addColorSwatch({
          baseRevision: input.moodboard.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          color: input.color,
          moodboardId: input.moodboard.id,
          note: input.note,
          paletteGroupId: input.paletteGroupId,
        }),
      ),
    onSuccess: invalidate,
  });

  const addPaletteGroup = useMutation({
    mutationFn: (input: { moodboard: Moodboard; name: string }) =>
      runOnlineOnlyWrite(() =>
        client.addPaletteGroup({
          baseRevision: input.moodboard.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          moodboardId: input.moodboard.id,
          name: input.name,
        }),
      ),
    onSuccess: invalidate,
  });

  const assignPaletteGroup = useMutation({
    mutationFn: (input: {
      itemId: string;
      moodboard: Moodboard;
      paletteGroupId: string | null;
    }) =>
      runOnlineOnlyWrite(() =>
        client.assignColorSwatchPaletteGroup({
          baseRevision: input.moodboard.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          itemId: input.itemId,
          moodboardId: input.moodboard.id,
          paletteGroupId: input.paletteGroupId,
        }),
      ),
    onSuccess: invalidate,
  });

  const setVisualView = useMutation({
    mutationFn: (input: {
      itemId: string;
      moodboard: Moodboard;
      view: VisualView;
    }) =>
      runOnlineOnlyWrite(() =>
        client.setMoodboardVisualView({
          baseRevision: input.moodboard.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          crop: input.view.crop,
          itemId: input.itemId,
          moodboardId: input.moodboard.id,
          rotation: input.view.rotation,
        }),
      ),
    onSuccess: invalidate,
  });

  const setFocusOrder = useMutation({
    mutationFn: (input: { itemIds: string[]; moodboard: Moodboard }) =>
      runOnlineOnlyWrite(() =>
        client.setMoodboardFocusOrder({
          baseRevision: input.moodboard.revision,
          clientIdempotencyKey: crypto.randomUUID(),
          itemIds: input.itemIds,
          moodboardId: input.moodboard.id,
        }),
      ),
    onSuccess: invalidate,
  });

  // Snapshot reads never change the Moodboard, so they do not invalidate it.
  const snapshotPreview = useMutation({
    mutationFn: (input: { itemIds: string[]; moodboardId: string }) =>
      client.moodboardSnapshotPreview(input),
  });

  const exportSnapshot = useMutation({
    mutationFn: (input: {
      format: SnapshotFormat;
      itemIds: string[];
      moodboardId: string;
    }) => client.exportMoodboardSnapshot(input),
  });

  return {
    exportSnapshot,
    setFocusOrder,
    setVisualView,
    snapshotPreview,
    addColorSwatch,
    addPaletteGroup,
    addVisual,
    assignPaletteGroup,
    createMoodboard,
    moodboardsQuery,
    updateCaption,
  };
}
