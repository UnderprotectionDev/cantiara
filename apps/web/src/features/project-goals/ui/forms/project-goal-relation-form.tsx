// biome-ignore-all lint/performance/noJsxPropsBind: Each control binds its explicit membership selection.
import type { ProjectGoalDetail } from "@cantiara/api/project-goals";
import { isAllowedRelationEndpoints } from "@cantiara/api/relations";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { type FormEvent, useEffect } from "react";
import {
  type GoalRelationChange,
  selectionKey,
} from "../../lib/goal-relation-selection";

export function ProjectGoalRelationForm({
  detail,
  onAdd,
  pending,
  settledChanges,
}: {
  detail: ProjectGoalDetail;
  onAdd: (change: GoalRelationChange) => Promise<unknown>;
  pending: boolean;
  /** Counts saved relation changes; each one clears the Record choice. */
  settledChanges: number;
}) {
  const form = useForm({
    defaultValues: {
      kind: "Contributes to Goal" as GoalRelationChange["kind"],
      selection: "",
    },
    onSubmit: () => {
      add();
    },
  });
  // biome-ignore lint/correctness/useExhaustiveDependencies: A saved change is the only trigger that clears the Record choice.
  useEffect(() => {
    form.setFieldValue("selection", "");
  }, [settledChanges]);
  const { kind, selection } = useStore(form.store, (state) => state.values);
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
  function add() {
    if (!chosen) {
      return;
    }
    const previous = detail.relations.find(
      (row) =>
        row.kind === kind && selectionKey(row.source) === selectionKey(chosen),
    );
    onAdd({
      source: chosen,
      kind,
      attached: true,
      baseRevision: previous?.revision ?? 0,
    }).catch(() => undefined);
  }
  function submit(event: FormEvent<HTMLFormElement>) {
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
