// biome-ignore-all lint/performance/noJsxPropsBind: The workspace binds Moodboard-scoped handlers to the board and outline.

import type { OutlineSourceTarget } from "@cantiara/api/moodboard-outline";
import {
  type PersonalViewport,
  pruneCollapsed,
  toggleCollapsed,
} from "@cantiara/api/moodboard-viewport";
import type { Moodboard } from "@cantiara/api/moodboards";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import type { ReactNode } from "react";
import type { useMoodboards } from "../../hooks/use-moodboards";
import { usePersonalMoodboardView } from "../../hooks/use-personal-moodboard-view";
import { MoodboardBoard } from "./moodboard-board";
import { MoodboardOutline } from "./moodboard-outline";

/**
 * Board plus structured Outline for one Moodboard. The personal viewport and
 * collapse restore from this user's saved view; selection stays in memory and
 * is never saved or restored.
 */
export function MoodboardWorkspace({
  addControls,
  api,
  moodboard,
  onOpenSource,
}: {
  addControls: ReactNode;
  api: ReturnType<typeof useMoodboards>;
  moodboard: Moodboard;
  onOpenSource: (target: OutlineSourceTarget, itemId: string) => void;
}) {
  const personal = usePersonalMoodboardView(moodboard.id);
  const initialBoardSession: {
    viewport: PersonalViewport | null | undefined;
    collapsedChoice: string[] | null;
    selectedId: string | null;
  } = {
    viewport: undefined,
    collapsedChoice: null,
    selectedId: null,
  };
  const boardSession = useCreateStore(initialBoardSession, ({ setState }) => ({
    setViewport: (next: PersonalViewport | null | undefined) =>
      setState((state) => ({ ...state, viewport: next })),
    setCollapsedChoice: (next: string[] | null) =>
      setState((state) => ({ ...state, collapsedChoice: next })),
    setSelectedId: (next: string | null) =>
      setState((state) => ({ ...state, selectedId: next })),
  }));
  const { viewport, collapsedChoice, selectedId } = useSelector(boardSession);
  const { setViewport, setCollapsedChoice, setSelectedId } =
    boardSession.actions;
  const savedViewport =
    viewport === undefined ? personal.view.viewport : viewport;
  const collapsed = pruneCollapsed(
    collapsedChoice ?? personal.view.collapsed,
    moodboard.paletteGroups.map(({ id }) => id),
  );

  function changeViewport(next: PersonalViewport | null) {
    setViewport(next);
    personal.schedule({ collapsed, viewport: next });
  }

  function toggleSection(key: string) {
    const next = toggleCollapsed(collapsed, key);
    setCollapsedChoice(next);
    personal.schedule({ collapsed: next, viewport: savedViewport });
  }

  return (
    <div className="space-y-4">
      {personal.isReady ? (
        <MoodboardBoard
          moodboard={moodboard}
          onSelect={setSelectedId}
          onViewportChange={changeViewport}
          savedViewport={savedViewport}
          selectedId={selectedId}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Loading board…</p>
      )}
      <MoodboardOutline
        addControls={addControls}
        busy={api.reorderItems.isPending || api.assignPaletteGroup.isPending}
        collapsed={collapsed}
        moodboard={moodboard}
        onGroup={(itemId, paletteGroupId) =>
          api.assignPaletteGroup.mutate({ itemId, moodboard, paletteGroupId })
        }
        onOpenSource={onOpenSource}
        onReorder={(itemIds) => api.reorderItems.mutate({ itemIds, moodboard })}
        onSelect={setSelectedId}
        onToggleSection={toggleSection}
        selectedId={selectedId}
      />
    </div>
  );
}
