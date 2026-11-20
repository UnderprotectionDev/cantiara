// biome-ignore-all lint/performance/noJsxPropsBind: The Snapshot form binds its own Moodboard and item scope.
import {
  MOODBOARD_SNAPSHOT_LABELS,
  type SnapshotFormat,
} from "@cantiara/api/moodboard-snapshot";
import { MOODBOARD_UI_LABELS, type Moodboard } from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import { useForm } from "@tanstack/react-form";

import type { useMoodboards } from "../../hooks/use-moodboards";
import { snapshotItemsFormSchema } from "../../lib/moodboard-form";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

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
  const snapshot = api.snapshotPreview;
  const preview =
    snapshot.variables?.moodboardId === moodboard.id
      ? snapshot.data
      : undefined;
  const form = useForm({
    defaultValues: { itemIds: [] as string[] },
    // Any scope change invalidates the shown preview.
    listeners: { onChange: snapshot.reset },
    onSubmit: ({ value }) => {
      const parsed = snapshotItemsFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      snapshot.mutate({
        itemIds: parsed.data.itemIds,
        moodboardId: moodboard.id,
      });
    },
  });

  function exportAs(format: SnapshotFormat) {
    const parsed = snapshotItemsFormSchema.safeParse(form.state.values);
    if (!parsed.success) {
      return;
    }
    api.exportSnapshot.mutate(
      { itemIds: parsed.data.itemIds, moodboardId: moodboard.id, format },
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
    <form
      aria-label={MOODBOARD_SNAPSHOT_LABELS.snapshot}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h4 className="font-medium">{MOODBOARD_SNAPSHOT_LABELS.snapshot}</h4>
      <fieldset className="space-y-1">
        <legend className="text-sm">
          Items in this {MOODBOARD_SNAPSHOT_LABELS.snapshot}
        </legend>
        <form.Field mode="array" name="itemIds">
          {(field) => (
            <>
              {moodboard.items.map((item) => (
                <label
                  className="flex items-center gap-2"
                  htmlFor={`moodboard-snapshot-item-${item.id}`}
                  key={item.id}
                >
                  <Checkbox
                    checked={field.state.value.includes(item.id)}
                    id={`moodboard-snapshot-item-${item.id}`}
                    onCheckedChange={() =>
                      field.handleChange(
                        field.state.value.includes(item.id)
                          ? field.state.value.filter(
                              (value) => value !== item.id,
                            )
                          : [...field.state.value, item.id],
                      )
                    }
                  />
                  {item.kind === "Visual"
                    ? (item.caption ?? `Visual ${item.position + 1}`)
                    : `${MOODBOARD_UI_LABELS.colorSwatch} ${item.color}`}
                </label>
              ))}
            </>
          )}
        </form.Field>
      </fieldset>
      <form.Subscribe selector={(state) => state.values.itemIds.length}>
        {(count) => (
          <div className="flex gap-2">
            <Button
              disabled={count === 0 || api.snapshotPreview.isPending}
              type="submit"
              variant="outline"
            >
              {MOODBOARD_SNAPSHOT_LABELS.preview}
            </Button>
            <Button
              disabled={count === 0 || api.exportSnapshot.isPending}
              onClick={() => exportAs("PNG")}
              type="button"
            >
              {MOODBOARD_SNAPSHOT_LABELS.png}
            </Button>
            <Button
              disabled={count === 0 || api.exportSnapshot.isPending}
              onClick={() => exportAs("PDF")}
              type="button"
            >
              {MOODBOARD_SNAPSHOT_LABELS.pdf}
            </Button>
          </div>
        )}
      </form.Subscribe>
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
    </form>
  );
}
