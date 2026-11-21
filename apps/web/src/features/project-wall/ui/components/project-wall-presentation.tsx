// biome-ignore-all lint/performance/noJsxPropsBind: Each tool binds its own wall, card and format.

import type { ProjectWallView } from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_PRESENTATION_LABELS,
  type ProjectWallSnapshotFile,
  type ProjectWallSnapshotPreview,
  projectWallPresentationSequence,
} from "@cantiara/api/project-wall-presentation";
import { Button } from "@cantiara/ui/components/button";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useLayoutEffect } from "react";

import { cardLabel } from "../../lib/project-wall-presentation";
import { ProjectWallCard } from "./project-wall-card";

export interface ProjectWallPresentationActions {
  onExportSnapshot: (
    scope: SnapshotScope,
    format: "PDF" | "PNG",
  ) => Promise<ProjectWallSnapshotFile[] | undefined>;
  onPreviewSnapshot: (
    scope: SnapshotScope,
  ) => Promise<ProjectWallSnapshotPreview | undefined>;
  onSetFocusOrder: (cardIds: string[]) => Promise<boolean>;
}

export type SnapshotScope =
  | { cardIds: string[]; groupId?: undefined }
  | { cardIds?: undefined; groupId: string };

/**
 * Presentation Mode: a read-only walk over this wall's own cards. It renders
 * no card action and no editing tool, and copies nothing into a second file.
 * Exiting returns to the same wall and view.
 */
export function ProjectWallPresentationView({
  onExit,
  wall,
}: {
  onExit: () => void;
  wall: ProjectWallView;
}) {
  const sequence = projectWallPresentationSequence(wall.cards, wall.focusOrder);
  const presentation = useCreateStore(0);
  const storedIndex = useSelector(presentation, (value) => value);
  const lastIndex = Math.max(0, sequence.length - 1);
  const index = Math.min(storedIndex, lastIndex);
  useLayoutEffect(() => {
    presentation.setState((value) => Math.min(value, lastIndex));
  }, [lastIndex, presentation]);
  const card = sequence[Math.min(index, sequence.length - 1)];
  return (
    <section
      aria-label={PROJECT_WALL_PRESENTATION_LABELS.presentationMode}
      className="space-y-3"
    >
      <Button onClick={onExit} type="button" variant="outline">
        {PROJECT_WALL_PRESENTATION_LABELS.exitPresentationMode}
      </Button>
      {card ? (
        <ProjectWallCard card={card} />
      ) : (
        <p className="text-muted-foreground">Nothing to present yet.</p>
      )}
      <div className="flex items-center gap-2">
        <Button
          disabled={index === 0}
          onClick={() =>
            presentation.setState((value) => Math.max(0, value - 1))
          }
          type="button"
          variant="outline"
        >
          Previous
        </Button>
        <span aria-live="polite" className="text-sm">
          {sequence.length === 0 ? 0 : index + 1} of {sequence.length}
        </span>
        <Button
          disabled={index >= sequence.length - 1}
          onClick={() =>
            presentation.setState((value) => Math.min(lastIndex, value + 1))
          }
          type="button"
          variant="outline"
        >
          Next
        </Button>
      </div>
    </section>
  );
}

/** Optional view-local `Focus order`: reorders card references only. */
export function ProjectWallFocusOrderEditor({
  actions,
  wall,
}: {
  actions: Pick<ProjectWallPresentationActions, "onSetFocusOrder">;
  wall: ProjectWallView;
}) {
  const ordered = projectWallPresentationSequence(wall.cards, wall.focusOrder);
  const unlisted = wall.cards.filter(
    ({ id }) => !ordered.some((card) => card.id === id),
  );

  function move(index: number, delta: -1 | 1) {
    const ids = ordered.map(({ id }) => id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) {
      return;
    }
    const [moved] = ids.splice(index, 1);
    if (moved) {
      ids.splice(target, 0, moved);
    }
    actions.onSetFocusOrder(ids);
  }

  return (
    <section
      aria-label={PROJECT_WALL_PRESENTATION_LABELS.focusOrder}
      className="space-y-2"
    >
      <h3 className="font-medium">
        {PROJECT_WALL_PRESENTATION_LABELS.focusOrder}
      </h3>
      <ol className="list-decimal space-y-1 pl-5">
        {ordered.map((card, index) => (
          <li key={card.id}>
            <span className="mr-2">{cardLabel(card)}</span>
            <Button
              aria-label={`Move up: ${cardLabel(card)}`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Up
            </Button>
            <Button
              aria-label={`Move down: ${cardLabel(card)}`}
              disabled={index === ordered.length - 1}
              onClick={() => move(index, 1)}
              size="sm"
              type="button"
              variant="outline"
            >
              Down
            </Button>
          </li>
        ))}
      </ol>
      {unlisted.length > 0 ? (
        <Button
          onClick={() =>
            actions.onSetFocusOrder(
              [...ordered, ...unlisted].map(({ id }) => id),
            )
          }
          type="button"
          variant="outline"
        >
          Add {unlisted.length} unlisted to{" "}
          {PROJECT_WALL_PRESENTATION_LABELS.focusOrder}
        </Button>
      ) : null}
      {wall.focusOrder.length > 0 ? (
        <Button
          onClick={() => actions.onSetFocusOrder([])}
          type="button"
          variant="outline"
        >
          Clear {PROJECT_WALL_PRESENTATION_LABELS.focusOrder}
        </Button>
      ) : null}
    </section>
  );
}
