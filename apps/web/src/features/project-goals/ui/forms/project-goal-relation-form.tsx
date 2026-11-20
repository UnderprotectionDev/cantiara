// biome-ignore-all lint/performance/noJsxPropsBind: Each control binds its explicit membership selection.
import type { ProjectGoalDetail } from "@cantiara/api/project-goals";
import { isAllowedRelationEndpoints } from "@cantiara/api/relations";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { goalRelationFormSchema } from "../../lib/goal-relation-form";
import {
  type GoalRelationChange,
  selectionKey,
} from "../../lib/goal-relation-selection";

export function ProjectGoalRelationForm({
  detail,
  onAdd,
  pending,
}: {
  detail: ProjectGoalDetail;
  onAdd: (change: GoalRelationChange) => Promise<unknown>;
  pending: boolean;
}) {
  const form = useForm({
    defaultValues: {
      kind: "Contributes to Goal" as GoalRelationChange["kind"],
      selection: "",
    },
    onSubmit: async ({ value, formApi }) => {
      if (!goalRelationFormSchema.safeParse(value).success) {
        return;
      }
      if (chosen) {
        await add(chosen);
        formApi.reset(
          { kind: value.kind, selection: "" },
          { keepDefaultValues: true },
        );
      }
    },
  });
  const { kind, selection } = useSelector(form.store, (state) => state.values);
  const candidates = detail.candidates.filter(
    (source) =>
      isAllowedRelationEndpoints(kind, source.recordType, "Project Goal") &&
      !detail.relations.some(
        (row) =>
          row.attached &&
          row.kind === kind &&
          selectionKey(row.source) === selectionKey(source),
      ),
  );
  const chosen = candidates.find(
    (source) => selectionKey(source) === selection,
  );
  function add(source: ProjectGoalDetail["candidates"][number]) {
    const previous = detail.relations.find(
      (row) =>
        row.kind === kind && selectionKey(row.source) === selectionKey(source),
    );
    return onAdd({
      source,
      kind,
      attached: true,
      baseRevision: previous?.revision ?? 0,
    });
  }
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  const addLabel =
    kind === "Contributes to Goal" ? "Add contribution" : "Add relation";
  return (
    <form
      className="flex flex-wrap items-end gap-3"
      noValidate
      onSubmit={submit}
    >
      <form.Field name="kind">
        {(field) => (
          <label className="grid gap-2 text-sm" htmlFor="goal-relation-kind">
            Relation
            <NativeSelect
              aria-label="Relation"
              disabled={pending}
              id="goal-relation-kind"
              name={field.name}
              onChange={(event) => {
                field.handleChange(
                  event.target.value as GoalRelationChange["kind"],
                );
                form.setFieldValue("selection", "");
              }}
              value={field.state.value}
            >
              <NativeSelectOption>Contributes to Goal</NativeSelectOption>
              <NativeSelectOption>Related</NativeSelectOption>
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <form.Field name="selection">
        {(field) => (
          <label
            className="grid min-w-0 flex-1 gap-2 text-sm"
            htmlFor="goal-relation-record"
          >
            Record
            <NativeSelect
              aria-label="Record"
              className="w-full"
              disabled={pending}
              id="goal-relation-record"
              name={field.name}
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              <NativeSelectOption value="">Select record</NativeSelectOption>
              {candidates.map((source) => (
                <NativeSelectOption
                  key={selectionKey(source)}
                  value={selectionKey(source)}
                >
                  {source.title} · {source.workType ?? source.recordType}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      <Button disabled={pending || !chosen} type="submit">
        {pending ? "Saving…" : <span>{addLabel}</span>}
      </Button>
    </form>
  );
}
