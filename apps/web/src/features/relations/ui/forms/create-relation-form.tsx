// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import type { RelationCreatePreviewInput } from "@cantiara/api/relations";
import type { WorkProfile } from "@cantiara/api/work-lifecycle";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, type ReactNode, useEffect } from "react";

import {
  createRelationFormSchema,
  RELATION_SELECTION_OPTIONS,
  type RelationSelectionKind,
} from "../../lib/relation-forms";

/** `Create Persistent Relation`: previews a relation; the preview itself is the children. */
export function CreateRelationForm({
  candidates,
  children,
  disabled,
  onEdit,
  onPreview,
  onPreviewInvalid,
  workId,
}: {
  candidates: readonly WorkProfile[];
  children?: ReactNode;
  disabled: boolean;
  onEdit: () => void;
  onPreview: (input: RelationCreatePreviewInput) => void;
  onPreviewInvalid: () => void;
  workId: string;
}) {
  const form = useForm({
    defaultValues: {
      relationKind: "Related" as RelationSelectionKind,
      targetWorkId: candidates[0]?.id ?? "",
    },
    onSubmit: ({ value }) => {
      const parsed = createRelationFormSchema(workId).safeParse(value);
      if (!parsed.success) {
        onPreviewInvalid();
        return;
      }
      onPreview(parsed.data);
    },
  });
  const targetWorkId = useStore(
    form.store,
    (state) => state.values.targetWorkId,
  );

  useEffect(() => {
    if (
      targetWorkId === "" ||
      !candidates.some((candidate) => candidate.id === targetWorkId)
    ) {
      form.setFieldValue("targetWorkId", candidates[0]?.id ?? "");
    }
  }, [candidates, form, targetWorkId]);

  const canCreate = !disabled && targetWorkId !== "";

  return (
    <form
      className="mt-3 grid gap-2 rounded-md border border-border/70 bg-muted/20 p-3"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <label
        className="text-muted-foreground text-xs"
        htmlFor={`relation-kind-${workId}`}
      >
        Relation type
      </label>
      <form.Field name="relationKind">
        {(field) => (
          <NativeSelect
            aria-label="Relation type"
            disabled={!canCreate}
            id={`relation-kind-${workId}`}
            name={field.name}
            onChange={(event) => {
              field.handleChange(event.target.value as RelationSelectionKind);
              onEdit();
            }}
            value={field.state.value}
          >
            {RELATION_SELECTION_OPTIONS.map((kind) => (
              <NativeSelectOption key={kind} value={kind}>
                {kind}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <label
        className="text-muted-foreground text-xs"
        htmlFor={`relation-target-${workId}`}
      >
        Related Work
      </label>
      <form.Field name="targetWorkId">
        {(field) => (
          <NativeSelect
            aria-label="Related Work"
            disabled={!canCreate}
            id={`relation-target-${workId}`}
            name={field.name}
            onChange={(event) => {
              field.handleChange(event.target.value);
              onEdit();
            }}
            value={field.state.value}
          >
            <NativeSelectOption value="">Select a Work</NativeSelectOption>
            {candidates.map((candidate) => (
              <NativeSelectOption key={candidate.id} value={candidate.id}>
                {candidate.key} {candidate.title}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <Button disabled={!canCreate} size="xs" type="submit">
        Preview relation
      </Button>
      {children}
    </form>
  );
}
