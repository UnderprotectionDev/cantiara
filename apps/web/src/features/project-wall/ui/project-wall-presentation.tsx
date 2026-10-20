// biome-ignore-all lint/performance/noJsxPropsBind: Each tool binds its own wall, card and format.
import type { ProjectWallView } from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_PRESENTATION_LABELS,
  PROJECT_WALL_SNAPSHOT_LABELS,
  type ProjectWallSnapshotFile,
  type ProjectWallSnapshotPreview,
  projectWallPresentationSequence,
} from "@cantiara/api/project-wall-presentation";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useState } from "react";

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

function cardLabel(card: ProjectWallView["cards"][number]) {
  return card.source.title ?? `${card.sourceType} (unavailable)`;
}

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
  const [index, setIndex] = useState(0);
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
          onClick={() => setIndex(index - 1)}
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
          onClick={() => setIndex(index + 1)}
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

function downloadBase64(file: ProjectWallSnapshotFile) {
  const bytes = Uint8Array.from(atob(file.base64), (char) =>
    char.charCodeAt(0),
  );
  const url = URL.createObjectURL(new Blob([bytes], { type: file.mimeType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

/**
 * Group or region `Snapshot`: choose a group or cards, read the `Preview`
 * that names the output a `Frozen copy`, then export `PNG` or `PDF`. Nothing
 * here shares, publishes or locks the wall.
 */
export function ProjectWallSnapshotPanel({
  actions,
  wall,
}: {
  actions: Pick<
    ProjectWallPresentationActions,
    "onExportSnapshot" | "onPreviewSnapshot"
  >;
  wall: ProjectWallView;
}) {
  const [groupId, setGroupId] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<ProjectWallSnapshotPreview | null>(
    null,
  );
  let scope: SnapshotScope | null = null;
  if (groupId) {
    scope = { groupId };
  } else if (selected.length > 0) {
    scope = { cardIds: selected };
  }

  function toggle(id: string) {
    setPreview(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function showPreview() {
    if (scope) {
      setPreview((await actions.onPreviewSnapshot(scope)) ?? null);
    }
  }

  async function exportAs(format: "PDF" | "PNG") {
    if (!scope) {
      return;
    }
    const files = (await actions.onExportSnapshot(scope, format)) ?? [];
    for (const file of files) {
      downloadBase64(file);
    }
  }

  return (
    <section
      aria-label={PROJECT_WALL_SNAPSHOT_LABELS.snapshot}
      className="space-y-2"
    >
      <h3 className="font-medium">{PROJECT_WALL_SNAPSHOT_LABELS.snapshot}</h3>
      {wall.groups.length > 0 ? (
        <NativeSelect
          aria-label="Snapshot group"
          onChange={(event) => {
            setPreview(null);
            setGroupId(event.target.value);
          }}
          value={groupId}
        >
          <NativeSelectOption value="">
            Region of selected cards
          </NativeSelectOption>
          {wall.groups.map((group) => (
            <NativeSelectOption key={group.id} value={group.id}>
              Group: {group.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      {groupId ? null : (
        <fieldset className="space-y-1">
          <legend className="text-sm">
            Cards in this {PROJECT_WALL_SNAPSHOT_LABELS.snapshot}
          </legend>
          {wall.cards.map((card) => (
            <label className="flex items-center gap-2" key={card.id}>
              <input
                checked={selected.includes(card.id)}
                onChange={() => toggle(card.id)}
                type="checkbox"
              />
              {cardLabel(card)}
            </label>
          ))}
        </fieldset>
      )}
      <div className="flex gap-2">
        <Button
          disabled={!scope}
          onClick={showPreview}
          type="button"
          variant="outline"
        >
          {PROJECT_WALL_SNAPSHOT_LABELS.preview}
        </Button>
        <Button disabled={!scope} onClick={() => exportAs("PNG")} type="button">
          {PROJECT_WALL_SNAPSHOT_LABELS.png}
        </Button>
        <Button disabled={!scope} onClick={() => exportAs("PDF")} type="button">
          {PROJECT_WALL_SNAPSHOT_LABELS.pdf}
        </Button>
      </div>
      {preview ? (
        <section aria-label="Snapshot preview" className="space-y-1">
          <p className="font-medium">{preview.moment}</p>
          <p className="text-sm">
            {preview.cardCount} card{preview.cardCount === 1 ? "" : "s"},{" "}
            {preview.linkCount} Visual link
            {preview.linkCount === 1 ? "" : "s"}
          </p>
          {preview.notices.map((notice) => (
            <p className="text-sm" key={notice}>
              {notice}
            </p>
          ))}
        </section>
      ) : null}
    </section>
  );
}
