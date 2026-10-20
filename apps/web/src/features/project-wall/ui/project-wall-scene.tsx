import type { ProjectWallView } from "@cantiara/api/project-wall";
import type { ProjectWallViewport } from "@cantiara/api/project-wall-viewport";
import { lazy, type ReactNode, Suspense, useState } from "react";
import type { ProjectWallViewGroup } from "../lib/project-wall-scene";
import type { ProjectWallCanvasProps } from "./project-wall-canvas";
import type { ProjectWallCardActions } from "./project-wall-card";
import {
  ProjectWallOutline,
  type ProjectWallOutlineActions,
} from "./project-wall-outline";

const ProjectWallCanvas = lazy(() => import("./project-wall-canvas"));

/** The wall that reaches the canvas and Outline: its collapse is personal. */
export type ProjectWallSceneWall = Omit<ProjectWallView, "groups"> & {
  groups: ProjectWallViewGroup[];
};

export interface ProjectWallSceneProps {
  addControls?: ReactNode;
  cardActions: ProjectWallCardActions;
  onExpandAll: () => void;
  onMove: ProjectWallCanvasProps["onMove"];
  onReorder: (cardIds: string[]) => void;
  onToggleGroup: (groupId: string) => void;
  onViewportChange: ProjectWallCanvasProps["onViewportChange"];
  onViewportReady: ProjectWallCanvasProps["onViewportReady"];
  outlineActions: Omit<ProjectWallOutlineActions, "onReorder">;
  saved: ProjectWallViewport | null;
  /** The wall with the account's own group collapse already applied. */
  wall: ProjectWallSceneWall;
}

/**
 * The canvas and its functional equivalent, the structured `Outline`. They
 * share one session-only selection; neither it nor the inspected card is ever
 * persisted or restored.
 */
export function ProjectWallScene({
  addControls,
  cardActions,
  onExpandAll,
  onMove,
  onReorder,
  onToggleGroup,
  onViewportChange,
  onViewportReady,
  outlineActions,
  saved,
  wall,
}: ProjectWallSceneProps) {
  const [selection, setSelection] = useState<string[]>([]);
  const known = new Set(wall.cards.map(({ id }) => id));
  const live = selection.filter((id) => known.has(id));
  const collapsed = wall.groups
    .filter((group) => group.collapsed)
    .map(({ id }) => id);
  return (
    <div className="space-y-4">
      <Suspense fallback={<p role="status">Loading Project Wall…</p>}>
        <ProjectWallCanvas
          actions={cardActions}
          cards={wall.cards}
          groups={wall.groups}
          links={wall.links}
          onExpandAll={onExpandAll}
          onMove={onMove}
          onReorder={onReorder}
          onSelectionChange={setSelection}
          onViewportChange={onViewportChange}
          onViewportReady={onViewportReady}
          saved={saved}
          selection={live}
        />
      </Suspense>
      <ProjectWallOutline
        actions={{ ...outlineActions, onReorder }}
        addControls={addControls}
        cardActions={cardActions}
        collapsed={collapsed}
        onSelectionChange={setSelection}
        onToggleGroup={onToggleGroup}
        selection={live}
        wall={wall}
      />
    </div>
  );
}
