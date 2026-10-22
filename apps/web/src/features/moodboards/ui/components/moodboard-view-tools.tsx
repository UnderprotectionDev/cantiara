// biome-ignore-all lint/performance/noJsxPropsBind: Each tool binds its own Moodboard, item, and revision.
import {
  MOODBOARD_SNAPSHOT_LABELS,
  type MoodboardSnapshotPreview,
  type SnapshotFormat,
} from "@cantiara/api/moodboard-snapshot";
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
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useEffect, useRef, useState } from "react";

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
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => setCropOpen((open) => !open)}
          type="button"
          variant="outline"
        >
          {MOODBOARD_UI_LABELS.crop}
        </Button>
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
          <span className="text-muted-foreground text-sm">
            This view only: {viewSummary(item.view)}. The original file is
            unchanged.
          </span>
        )}
      </div>
      <VisualCropForm
        idPrefix={idPrefix}
        onApply={(view) => {
          save(view);
          setCropOpen(false);
        }}
        open={cropOpen}
        view={item.view}
      />
    </div>
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
  const [index, setIndex] = useState(0);
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

function downloadBase64(file: {
  base64: string;
  fileName: string;
  mimeType: string;
}) {
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

/** Region Snapshot: choose items, read the `Preview`, then export `PNG` or `PDF`. */
export function SnapshotPanel({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<MoodboardSnapshotPreview | null>(null);
  const input = { itemIds: selected, moodboardId: moodboard.id };

  function toggle(id: string) {
    setPreview(null);
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  function exportAs(format: SnapshotFormat) {
    api.exportSnapshot.mutate(
      { ...input, format },
      {
        onSuccess: (output) => {
          for (const file of output.files) {
            downloadBase64(file);
          }
        },
      },
    );
  }

  return (
    <section
      aria-label={MOODBOARD_SNAPSHOT_LABELS.snapshot}
      className="space-y-2"
    >
      <h4 className="font-medium">{MOODBOARD_SNAPSHOT_LABELS.snapshot}</h4>
      <fieldset className="space-y-1">
        <legend className="text-sm">
          Items in this {MOODBOARD_SNAPSHOT_LABELS.snapshot}
        </legend>
        {moodboard.items.map((item) => (
          <label
            className="flex items-center gap-2"
            htmlFor={`moodboard-snapshot-item-${item.id}`}
            key={item.id}
          >
            <Checkbox
              checked={selected.includes(item.id)}
              id={`moodboard-snapshot-item-${item.id}`}
              onCheckedChange={() => toggle(item.id)}
            />
            {item.kind === "Visual"
              ? (item.caption ?? `Visual ${item.position + 1}`)
              : `${MOODBOARD_UI_LABELS.colorSwatch} ${item.color}`}
          </label>
        ))}
      </fieldset>
      <div className="flex gap-2">
        <Button
          disabled={selected.length === 0 || api.snapshotPreview.isPending}
          onClick={() =>
            api.snapshotPreview.mutate(input, { onSuccess: setPreview })
          }
          type="button"
          variant="outline"
        >
          {MOODBOARD_SNAPSHOT_LABELS.preview}
        </Button>
        <Button
          disabled={selected.length === 0 || api.exportSnapshot.isPending}
          onClick={() => exportAs("PNG")}
          type="button"
        >
          {MOODBOARD_SNAPSHOT_LABELS.png}
        </Button>
        <Button
          disabled={selected.length === 0 || api.exportSnapshot.isPending}
          onClick={() => exportAs("PDF")}
          type="button"
        >
          {MOODBOARD_SNAPSHOT_LABELS.pdf}
        </Button>
      </div>
      {api.snapshotPreview.isError || api.exportSnapshot.isError ? (
        <p role="alert">Snapshot could not be created.</p>
      ) : null}
      {preview ? (
        <section aria-label="Snapshot preview" className="space-y-1">
          <p className="font-medium">{preview.moment}</p>
          <ul className="list-disc pl-5">
            {preview.sections.map((section) => (
              <li key={section.key}>
                {section.title}: {section.itemCount} item
                {section.itemCount === 1 ? "" : "s"}, {section.pageCount} page
                {section.pageCount === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
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
