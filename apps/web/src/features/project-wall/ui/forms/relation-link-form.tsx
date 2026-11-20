// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields and the displayed link.
import type {
  ProjectWallCardView,
  ProjectWallRelationPreview,
  ProjectWallView,
} from "@cantiara/api/project-wall";
import {
  isAllowedRelationEndpoints,
  RELATION_KIND_OPTIONS,
  type RelationKind,
} from "@cantiara/api/relations";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { orpc } from "@/utils/orpc";
import { relationKindFormSchema } from "../../lib/project-wall-narrative-forms";
import { cardName } from "../../lib/project-wall-narrative-labels";
import type { ProjectWallNarrativeActions } from "../components/project-wall-narrative";

function RelationPreviewPanel({
  onCancel,
  onConfirm,
  preview,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  preview: ProjectWallRelationPreview;
}) {
  const { relation } = preview;
  return (
    <section
      aria-label="Persistent relation preview"
      className="space-y-2 rounded-md border p-3 text-sm"
    >
      <p>
        This writes a persistent <strong>{relation.label}</strong> relation:{" "}
        {relation.source.title ?? relation.source.recordId} (
        {relation.source.recordType}) →{" "}
        {relation.target.title ?? relation.target.recordId} (
        {relation.target.recordType}). The Visual link stays wall narrative.
      </p>
      <div className="flex gap-2">
        <Button onClick={onConfirm} size="sm" type="button">
          Confirm Create Persistent Relation
        </Button>
        <Button onClick={onCancel} size="sm" type="button" variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

export function RelationLinkForm({
  actions,
  cards,
  link,
}: {
  actions: ProjectWallNarrativeActions;
  cards: ProjectWallCardView[];
  link: ProjectWallView["links"][number];
}) {
  const from = cards.find((card) => card.id === link.fromCardId);
  const to = cards.find((card) => card.id === link.toCardId);
  // A Smart Collection block summarizes records and is not a relation endpoint.
  const kinds = RELATION_KIND_OPTIONS.filter(
    (option) =>
      from !== undefined &&
      to !== undefined &&
      from.sourceType !== "Smart Collection" &&
      to.sourceType !== "Smart Collection" &&
      isAllowedRelationEndpoints(option, from.sourceType, to.sourceType),
  );
  const readPreview = useMutation({
    meta: { retryInSurface: true },
    mutationFn: (input: Parameters<typeof actions.onPreviewRelation>[0]) =>
      actions.onPreviewRelation(input),
    mutationKey: orpc.previewProjectWallPersistentRelation.mutationKey(),
  });
  const inFlight = useRef(false);
  const preview = readPreview.data;
  const error =
    readPreview.error instanceof Error
      ? readPreview.error.message
      : "Project Wall change failed.";
  const form = useForm({
    defaultValues: { kind: (kinds[0] ?? "Related") as RelationKind },
    listeners: { onChange: readPreview.reset },
    onSubmit: ({ value }) => {
      const parsed = relationKindFormSchema.safeParse(value);
      if (parsed.success) {
        readPreview.mutate({ kind: parsed.data.kind, linkId: link.id });
      }
    },
  });

  async function confirm() {
    if (!(preview && readPreview.variables) || inFlight.current) {
      return;
    }
    inFlight.current = true;
    try {
      const created = await actions.onCreateRelation({
        baseRevision: preview.relation.baseRevision,
        ...readPreview.variables,
        previewId: preview.relation.previewId,
      });
      if (created !== false) {
        readPreview.reset();
      }
    } finally {
      inFlight.current = false;
    }
  }

  return (
    <li className="space-y-2 rounded-md border p-2 text-sm">
      <p>
        <span className="text-muted-foreground">From</span> {cardName(from)}{" "}
        <span className="text-muted-foreground">To</span> {cardName(to)}:{" "}
        <em>{link.label}</em>
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
        }}
      >
        <form.Field name="kind">
          {(field) => (
            <NativeSelect
              aria-label="Relation kind"
              onChange={(event) =>
                field.handleChange(event.target.value as RelationKind)
              }
              value={field.state.value}
            >
              {kinds.map((option) => (
                <NativeSelectOption key={option} value={option}>
                  {option}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </form.Field>
        <Button
          disabled={kinds.length === 0 || readPreview.isPending}
          size="sm"
          type="submit"
          variant="outline"
        >
          Create Persistent Relation
        </Button>
        <Button
          onClick={() => actions.onUnbindLink(link.id)}
          size="sm"
          type="button"
          variant="outline"
        >
          Unbind
        </Button>
      </form>
      {readPreview.isError ? <p role="alert">{error}</p> : null}
      {preview ? (
        <RelationPreviewPanel
          onCancel={readPreview.reset}
          onConfirm={confirm}
          preview={preview}
        />
      ) : null}
    </li>
  );
}
