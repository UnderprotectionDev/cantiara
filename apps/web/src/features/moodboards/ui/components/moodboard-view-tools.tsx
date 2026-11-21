// biome-ignore-all lint/performance/noJsxPropsBind: Each tool binds its own Moodboard, item, and revision.

import {
  cropPixelRect,
  isDefaultVisualView,
  presentationSequence,
  rotateQuarterTurn,
  type VisualView,
} from "@cantiara/api/moodboard-view";
import {
  MOODBOARD_UI_LABELS,
  type Moodboard,
  type MoodboardVisual,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@cantiara/ui/components/collapsible";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { useMoodboards } from "../../hooks/use-moodboards";
import VisualCropForm from "../forms/visual-crop-form";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

/**
 * Draws one external-link visual the way this Moodboard view presents it
 * (crop first, then the clockwise rotation). It only draws; the source image is
 * never modified. Konva is not needed for this single static presentation.
 */
export function PresentedVisual({
  caption,
  url,
  view,
}: {
  caption: string | null;
  url: string;
  view: VisualView;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const image = new Image();
    image.onload = () => {
      const rect = cropPixelRect(
        { height: image.naturalHeight, width: image.naturalWidth },
        view.crop,
      );
      const turned = view.rotation === 90 || view.rotation === 270;
      canvas.width = turned ? rect.height : rect.width;
      canvas.height = turned ? rect.width : rect.height;
      const context = canvas.getContext("2d");
      if (!context) {
        return;
      }
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate((view.rotation * Math.PI) / 180);
      context.drawImage(
        image,
        rect.left,
        rect.top,
        rect.width,
        rect.height,
        -rect.width / 2,
        -rect.height / 2,
        rect.width,
        rect.height,
      );
    };
    image.src = url;
  }, [url, view]);

  return (
    <canvas
      aria-label={`Presented view: ${caption ?? url}`}
      className="max-h-40 rounded-md border"
      ref={canvasRef}
      role="img"
    />
  );
}

function viewSummary(view: VisualView) {
  const parts: string[] = [];
  if (view.crop) {
    parts.push("Crop");
  }
  if (view.rotation !== 0) {
    parts.push(`${MOODBOARD_UI_LABELS.rotate90} (${view.rotation}°)`);
  }
  return parts.join(" + ");
}

/** `Crop`, `Rotate 90°`, and `Reset view` for one visual on this Moodboard. */
export function VisualViewTools({
  api,
  item,
  moodboard,
}: {
  api: MoodboardsApi;
  item: MoodboardVisual;
  moodboard: Moodboard;
}) {
  const [cropOpen, setCropOpen] = useState(false);
  const idPrefix = `moodboard-crop-${item.id}`;

  function save(view: VisualView) {
    api.setVisualView.mutate({ itemId: item.id, moodboard, view });
  }

  return (
    <Collapsible
      className="space-y-2"
      onOpenChange={setCropOpen}
      open={cropOpen}
    >
      <div className="flex flex-wrap items-center gap-2">
        <CollapsibleTrigger render={<Button variant="outline" />}>
          {MOODBOARD_UI_LABELS.crop}
        </CollapsibleTrigger>
        <Button
          disabled={api.setVisualView.isPending}
          onClick={() => save(rotateQuarterTurn(item.view))}
          type="button"
          variant="outline"
        >
          {MOODBOARD_UI_LABELS.rotate90}
        </Button>
        <Button
          disabled={
            api.setVisualView.isPending || isDefaultVisualView(item.view)
          }
          onClick={() => save({ crop: null, rotation: 0 })}
          type="button"
          variant="outline"
        >
          {MOODBOARD_UI_LABELS.resetView}
        </Button>
        {isDefaultVisualView(item.view) ? null : (
          <span className="text-sm text-muted-foreground">
            This view only: {viewSummary(item.view)}. The original file is
            unchanged.
          </span>
        )}
      </div>
      <CollapsibleContent>
        <VisualCropForm
          idPrefix={idPrefix}
          onApply={(view) => {
            api.setVisualView.mutate(
              { itemId: item.id, moodboard, view },
              {
                onSuccess: () => setCropOpen(false),
              },
            );
          }}
          open={cropOpen}
          view={item.view}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Optional view-local `Focus order`: reorders item references only. */
export function FocusOrderEditor({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const ordered = presentationSequence(moodboard.items, moodboard.focusOrder);
  const unlisted = moodboard.items.filter(
    ({ id }) => !ordered.some((item) => item.id === id),
  );

  function describe(item: Moodboard["items"][number]) {
    return item.kind === "Visual"
      ? (item.caption ?? "Visual")
      : `${MOODBOARD_UI_LABELS.colorSwatch} ${item.color}`;
  }

  function save(ids: string[]) {
    api.setFocusOrder.mutate({ itemIds: ids, moodboard });
  }

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
    save(ids);
  }

  return (
    <section aria-label={MOODBOARD_UI_LABELS.focusOrder} className="space-y-2">
      <h4 className="font-medium">{MOODBOARD_UI_LABELS.focusOrder}</h4>
      <ol className="list-decimal space-y-1 pl-5">
        {ordered.map((item, index) => (
          <li key={item.id}>
            <span className="mr-2">{describe(item)}</span>
            <Button
              aria-label={`Move up: ${describe(item)}`}
              disabled={index === 0 || api.setFocusOrder.isPending}
              onClick={() => move(index, -1)}
              type="button"
              variant="outline"
            >
              Up
            </Button>
            <Button
              aria-label={`Move down: ${describe(item)}`}
              disabled={
                index === ordered.length - 1 || api.setFocusOrder.isPending
              }
              onClick={() => move(index, 1)}
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
          onClick={() => save([...ordered, ...unlisted].map(({ id }) => id))}
          type="button"
          variant="outline"
        >
          Add {unlisted.length} unlisted to {MOODBOARD_UI_LABELS.focusOrder}
        </Button>
      ) : null}
      {moodboard.focusOrder.length > 0 ? (
        <Button onClick={() => save([])} type="button" variant="outline">
          Clear {MOODBOARD_UI_LABELS.focusOrder}
        </Button>
      ) : null}
    </section>
  );
}

/**
 * Presentation Mode: a read-only walk over this Moodboard's own items. No
 * editing tool is rendered and nothing is copied into a second document.
 */
export function PresentationView({
  moodboard,
  onExit,
}: {
  moodboard: Moodboard;
  onExit: () => void;
}) {
  const sequence = presentationSequence(moodboard.items, moodboard.focusOrder);
  const presentation = useCreateStore(0);
  const storedIndex = useSelector(presentation, (value) => value);
  const lastIndex = Math.max(0, sequence.length - 1);
  const index = Math.min(storedIndex, lastIndex);
  useLayoutEffect(() => {
    presentation.setState((value) => Math.min(value, lastIndex));
  }, [lastIndex, presentation]);
  const item = sequence[Math.min(index, sequence.length - 1)];
  return (
    <section
      aria-label={MOODBOARD_UI_LABELS.presentationMode}
      className="space-y-3"
    >
      <Button onClick={onExit} type="button" variant="outline">
        {MOODBOARD_UI_LABELS.exitPresentationMode}
      </Button>
      {item ? (
        <figure className="space-y-2">
          {item.kind === "Color Swatch" ? (
            <>
              <div
                aria-hidden="true"
                className="h-40 rounded border"
                style={{ backgroundColor: item.color }}
              />
              <figcaption className="font-mono">
                {item.color}
                {item.note ? ` - ${item.note}` : ""}
              </figcaption>
            </>
          ) : (
            <>
              {item.origin.kind === "External link" ? (
                <PresentedVisual
                  caption={item.caption}
                  url={item.origin.url}
                  view={item.view}
                />
              ) : (
                <p className="text-muted-foreground">
                  File Attachment version {item.origin.attachmentVersionId}
                  {isDefaultVisualView(item.view)
                    ? ""
                    : ` (${viewSummary(item.view)})`}
                </p>
              )}
              {item.caption ? <figcaption>{item.caption}</figcaption> : null}
            </>
          )}
        </figure>
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
