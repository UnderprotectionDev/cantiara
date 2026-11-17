// biome-ignore-all lint/performance/noJsxPropsBind: The Snapshot form binds its own wall scope and format.
import type { ProjectWallView } from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_SNAPSHOT_LABELS,
  type ProjectWallSnapshotFile,
  type ProjectWallSnapshotPreview,
} from "@cantiara/api/project-wall-presentation";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { snapshotScopeFormSchema } from "../../lib/project-wall-forms";
import {
  cardLabel,
  type ProjectWallPresentationActions,
} from "../components/project-wall-presentation";

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
  const [preview, setPreview] = useState<ProjectWallSnapshotPreview | null>(
    null,
  );
  const form = useForm({
    defaultValues: { cardIds: [] as string[], groupId: "" },
    // Any scope change invalidates the shown preview.
    listeners: { onChange: () => setPreview(null) },
    onSubmit: async ({ value }) => {
      const scope = snapshotScopeFormSchema.safeParse(value);
      if (scope.success) {
        setPreview((await actions.onPreviewSnapshot(scope.data)) ?? null);
      }
    },
  });

  async function exportAs(format: "PDF" | "PNG") {
    const scope = snapshotScopeFormSchema.safeParse(form.state.values);
    if (!scope.success) {
      return;
    }
    const files = (await actions.onExportSnapshot(scope.data, format)) ?? [];
    for (const file of files) {
      downloadBase64(file);
    }
  }

  return (
    <form
      aria-label={PROJECT_WALL_SNAPSHOT_LABELS.snapshot}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">{PROJECT_WALL_SNAPSHOT_LABELS.snapshot}</h3>
      {wall.groups.length > 0 ? (
        <form.Field name="groupId">
          {(field) => (
            <NativeSelect
              aria-label="Snapshot group"
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
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
          )}
        </form.Field>
      ) : null}
      <form.Subscribe selector={(state) => state.values.groupId}>
        {(groupId) =>
          groupId ? null : (
            <fieldset className="space-y-1">
              <legend className="text-sm">
                Cards in this {PROJECT_WALL_SNAPSHOT_LABELS.snapshot}
              </legend>
              <form.Field mode="array" name="cardIds">
                {(field) => (
                  <>
                    {wall.cards.map((card) => (
                      <label
                        className="flex items-center gap-2"
                        htmlFor={`snapshot-card-${card.id}`}
                        key={card.id}
                      >
                        <Checkbox
                          checked={field.state.value.includes(card.id)}
                          id={`snapshot-card-${card.id}`}
                          onCheckedChange={() =>
                            field.handleChange(
                              field.state.value.includes(card.id)
                                ? field.state.value.filter(
                                    (value) => value !== card.id,
                                  )
                                : [...field.state.value, card.id],
                            )
                          }
                        />
                        {cardLabel(card)}
                      </label>
                    ))}
                  </>
                )}
              </form.Field>
            </fieldset>
          )
        }
      </form.Subscribe>
      <form.Subscribe
        selector={(state) =>
          snapshotScopeFormSchema.safeParse(state.values).success
        }
      >
        {(hasScope) => (
          <div className="flex gap-2">
            <Button disabled={!hasScope} type="submit" variant="outline">
              {PROJECT_WALL_SNAPSHOT_LABELS.preview}
            </Button>
            <Button
              disabled={!hasScope}
              onClick={() => exportAs("PNG")}
              type="button"
            >
              {PROJECT_WALL_SNAPSHOT_LABELS.png}
            </Button>
            <Button
              disabled={!hasScope}
              onClick={() => exportAs("PDF")}
              type="button"
            >
              {PROJECT_WALL_SNAPSHOT_LABELS.pdf}
            </Button>
          </div>
        )}
      </form.Subscribe>
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
    </form>
  );
}
