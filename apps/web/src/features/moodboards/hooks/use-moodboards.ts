import type { SnapshotFormat } from "@cantiara/api/moodboard-snapshot";
import type { VisualView } from "@cantiara/api/moodboard-view";
import type {
  Moodboard,
  MoodboardVisualOrigin,
} from "@cantiara/api/moodboards";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePreparedMutation } from "@/lib/use-prepared-mutation";
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

  const createMoodboard = usePreparedMutation(
    orpc.createMoodboard.mutationOptions({
      mutationFn: (input) => client.createMoodboard(input),
      onSuccess: invalidate,
    }),
    (input: { title: string }) => ({
      baseRevision: 0,
      projectId,
      title: input.title,
    }),
  );

  const addVisual = usePreparedMutation(
    orpc.addMoodboardVisual.mutationOptions({
      mutationFn: (input) => client.addMoodboardVisual(input),
      onSuccess: invalidate,
    }),
    (input: {
      caption: string | null;
      moodboard: Moodboard;
      origin: MoodboardVisualOrigin;
    }) => ({
      baseRevision: input.moodboard.revision,
      caption: input.caption,
      moodboardId: input.moodboard.id,
      origin: input.origin,
    }),
  );

  const updateCaption = usePreparedMutation(
    orpc.updateMoodboardVisualCaption.mutationOptions({
      mutationFn: (input) => client.updateMoodboardVisualCaption(input),
      onSuccess: invalidate,
    }),
    (input: {
      caption: string | null;
      itemId: string;
      moodboard: Moodboard;
    }) => ({
      baseRevision: input.moodboard.revision,
      caption: input.caption,
      itemId: input.itemId,
      moodboardId: input.moodboard.id,
    }),
  );

  const addColorSwatch = usePreparedMutation(
    orpc.addColorSwatch.mutationOptions({
      mutationFn: (input) => client.addColorSwatch(input),
      onSuccess: invalidate,
    }),
    (input: {
      color: string;
      moodboard: Moodboard;
      note: string | null;
      paletteGroupId: string | null;
    }) => ({
      baseRevision: input.moodboard.revision,
      color: input.color,
      moodboardId: input.moodboard.id,
      note: input.note,
      paletteGroupId: input.paletteGroupId,
    }),
  );

  const addPaletteGroup = usePreparedMutation(
    orpc.addPaletteGroup.mutationOptions({
      mutationFn: (input) => client.addPaletteGroup(input),
      onSuccess: invalidate,
    }),
    (input: { moodboard: Moodboard; name: string }) => ({
      baseRevision: input.moodboard.revision,
      moodboardId: input.moodboard.id,
      name: input.name,
    }),
  );

  const assignPaletteGroup = usePreparedMutation(
    orpc.assignColorSwatchPaletteGroup.mutationOptions({
      mutationFn: (input) => client.assignColorSwatchPaletteGroup(input),
      onSuccess: invalidate,
    }),
    (input: {
      itemId: string;
      moodboard: Moodboard;
      paletteGroupId: string | null;
    }) => ({
      baseRevision: input.moodboard.revision,
      itemId: input.itemId,
      moodboardId: input.moodboard.id,
      paletteGroupId: input.paletteGroupId,
    }),
  );

  const setVisualView = usePreparedMutation(
    orpc.setMoodboardVisualView.mutationOptions({
      mutationFn: (input) => client.setMoodboardVisualView(input),
      onSuccess: invalidate,
    }),
    (input: { itemId: string; moodboard: Moodboard; view: VisualView }) => ({
      baseRevision: input.moodboard.revision,
      crop: input.view.crop,
      itemId: input.itemId,
      moodboardId: input.moodboard.id,
      rotation: input.view.rotation,
    }),
  );

  const reorderItems = usePreparedMutation(
    orpc.reorderMoodboardItems.mutationOptions({
      mutationFn: (input) => client.reorderMoodboardItems(input),
      onSuccess: invalidate,
    }),
    (input: { itemIds: string[]; moodboard: Moodboard }) => ({
      baseRevision: input.moodboard.revision,
      itemIds: input.itemIds,
      moodboardId: input.moodboard.id,
    }),
  );

  const setFocusOrder = usePreparedMutation(
    orpc.setMoodboardFocusOrder.mutationOptions({
      mutationFn: (input) => client.setMoodboardFocusOrder(input),
      onSuccess: invalidate,
    }),
    (input: { itemIds: string[]; moodboard: Moodboard }) => ({
      baseRevision: input.moodboard.revision,
      itemIds: input.itemIds,
      moodboardId: input.moodboard.id,
    }),
  );

  // Snapshot reads never change the Moodboard, so they do not invalidate it.
  const snapshotPreview = useMutation({
    meta: { retryInSurface: true },
    mutationKey: orpc.moodboardSnapshotPreview.mutationKey(),
    mutationFn: (input: { itemIds: string[]; moodboardId: string }) =>
      queryClient.query({
        ...orpc.moodboardSnapshotPreview.queryOptions({ input }),
        gcTime: 0,
        staleTime: 0,
      }),
  });

  const exportSnapshot = useMutation({
    mutationKey: orpc.exportMoodboardSnapshot.mutationKey(),
    mutationFn: (input: {
      format: SnapshotFormat;
      itemIds: string[];
      moodboardId: string;
    }) => client.exportMoodboardSnapshot(input),
  });

  return {
    exportSnapshot,
    reorderItems,
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
