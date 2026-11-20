// biome-ignore-all lint/performance/noJsxPropsBind: The Snapshot form binds its own wall scope and format.
import type { ProjectWallView } from "@cantiara/api/project-wall";
import {
  PROJECT_WALL_SNAPSHOT_LABELS,
  type ProjectWallSnapshotFile,
} from "@cantiara/api/project-wall-presentation";
import { Button } from "@cantiara/ui/components/button";
import { Checkbox } from "@cantiara/ui/components/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { snapshotScopeFormSchema } from "../../lib/project-wall-forms";
import { cardLabel } from "../../lib/project-wall-presentation";
import type { ProjectWallPresentationActions } from "../components/project-wall-presentation";

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
  const readPreview = useMutation({
    meta: { retryInSurface: true },
    mutationFn: (scope: Parameters<typeof actions.onPreviewSnapshot>[0]) =>
      actions.onPreviewSnapshot(scope),
    mutationKey: orpc.previewProjectWallSnapshot.mutationKey(),
  });
  const exportSnapshot = useMutation({
    meta: { retryInSurface: true },
    mutationKey: orpc.exportProjectWallSnapshot.mutationKey(),
    mutationFn: ({
      scope,
      format,
    }: {
      scope: Parameters<typeof actions.onExportSnapshot>[0];
      format: "PDF" | "PNG";
    }) => actions.onExportSnapshot(scope, format),
  });
  const failure = readPreview.error ?? exportSnapshot.error;
  const preview = readPreview.data;
  const error =
    failure instanceof Error
      ? failure.message
      : "Snapshot could not be created.";
  const form = useForm({
    defaultValues: { cardIds: [] as string[], groupId: "" },
    // Any scope change invalidates the shown preview.
    listeners: {
      onChange: () => {
        readPreview.reset();
        exportSnapshot.reset();
      },
    },
    onSubmit: ({ value }) => {
      const scope = snapshotScopeFormSchema.safeParse(value);
      if (scope.success) {
        readPreview.mutate(scope.data);
      }
    },
  });

  function exportAs(format: "PDF" | "PNG") {
    const scope = snapshotScopeFormSchema.safeParse(form.state.values);
    if (scope.success) {
      readPreview.reset();
      exportSnapshot.mutate(
        { scope: scope.data, format },
        {
          onSuccess: (files) => {
            for (const file of files ?? []) {
              downloadBase64(file);
            }
          },
        },
      );
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
            <Button
              disabled={!hasScope || readPreview.isPending}
              type="submit"
              variant="outline"
            >
              {PROJECT_WALL_SNAPSHOT_LABELS.preview}
            </Button>
            <Button
              disabled={!hasScope || exportSnapshot.isPending}
              onClick={() => exportAs("PNG")}
              type="button"
            >
              {PROJECT_WALL_SNAPSHOT_LABELS.png}
            </Button>
            <Button
              disabled={!hasScope || exportSnapshot.isPending}
              onClick={() => exportAs("PDF")}
              type="button"
            >
              {PROJECT_WALL_SNAPSHOT_LABELS.pdf}
            </Button>
          </div>
        )}
      </form.Subscribe>
      {failure ? <p role="alert">{error}</p> : null}
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
