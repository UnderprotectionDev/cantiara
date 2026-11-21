// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker's local selection.

import {
  PLANNED_TEST_RELATION_MAX,
  PLANNED_TEST_RELATION_TARGET_TYPES,
  type PlannedTestRelationTarget,
  type PlannedTestRelationTargetType,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useCreateStore, useSelector } from "@tanstack/react-store";
import { type Ref, useCallback, useId, useImperativeHandle } from "react";
import { submitForm } from "@/lib/submit-form";
import { orpc } from "@/utils/orpc";
import type { RelationDraft } from "../../lib/planned-test-form";

export type LoadRelationTargets = (
  targetType: PlannedTestRelationTargetType,
) => Promise<PlannedTestRelationTarget[]>;

/**
 * Relations are chosen from the live owner records of the Project, never typed
 * as a title. Every control is a native labelled form control, so the field is
 * fully operable from the keyboard and read correctly by a screen reader.
 */
export function PlannedTestRelationsField({
  idPrefix,
  loadTargets,
  onChange,
  resetRef,
  projectId,
  value,
}: {
  idPrefix: string;
  loadTargets: LoadRelationTargets;
  projectId: string;
  onChange: (relations: RelationDraft[]) => void;
  resetRef?: Ref<() => void>;
  value: RelationDraft[];
}) {
  const statusId = useId();
  const messageStore = useCreateStore("");
  const message = useSelector(messageStore, (text) => text);
  const setMessage = useCallback(
    (text: string) => messageStore.setState(() => text),
    [messageStore],
  );
  const picker = useForm({
    defaultValues: {
      targetType: "Work" as PlannedTestRelationTargetType,
      targetId: "",
      sectionId: "",
    },
    onSubmit: ({ formApi }) => {
      setMessage("");
      const error = add();
      if (error) {
        formApi.setErrorMap({ onSubmit: { form: error, fields: {} } });
      }
    },
  });
  useImperativeHandle(
    resetRef,
    () => () => {
      picker.reset();
      setMessage("");
    },
    [picker, setMessage],
  );
  const { targetType, targetId, sectionId } = useSelector(
    picker.store,
    (state) => state.values,
  );
  const targetsQuery = useQuery({
    gcTime: 0,
    queryFn: () => loadTargets(targetType),
    queryKey: orpc.plannedTestRelationTargets.queryKey({
      input: { projectId, targetType },
    }),
  });
  const targets = targetsQuery.data;

  const selected = targets?.find((target) => target.targetId === targetId);

  function chooseType(next: PlannedTestRelationTargetType) {
    picker.reset(
      { targetType: next, targetId: "", sectionId: "" },
      { keepDefaultValues: true },
    );
    setMessage("");
  }

  let loadMessage = "";
  if (targetsQuery.isError) {
    loadMessage = `${targetType} records could not be loaded.`;
  } else if (targets?.length === 0) {
    loadMessage = `This Project has no ${targetType} to relate yet.`;
  }

  function add(): string | undefined {
    if (!selected) {
      return undefined;
    }
    const duplicate = value.some(
      (item) =>
        item.targetType === selected.targetType &&
        item.targetId === selected.targetId &&
        item.sectionId === (sectionId || null),
    );
    if (duplicate) {
      return `${selected.label} is already related.`;
    }
    onChange([
      ...value,
      {
        documentRevision: selected.documentRevision,
        label:
          selected.targetType === "Document"
            ? `Document: ${selected.label}, revision ${selected.documentRevision ?? 0}${
                sectionId
                  ? `, section ${
                      selected.sections.find(({ id }) => id === sectionId)
                        ?.label ?? sectionId
                    }`
                  : ""
              }`
            : `${selected.targetType}: ${selected.label}`,
        sectionId: sectionId || null,
        targetId: selected.targetId,
        targetType: selected.targetType,
      },
    ]);
    picker.setFieldValue("targetId", "");
    picker.setFieldValue("sectionId", "");
    setMessage(`${selected.label} added to relations.`);
    return undefined;
  }

  function remove(index: number) {
    picker.setErrorMap({ onSubmit: undefined });
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setMessage(removed ? `${removed.label} removed from relations.` : "");
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-sm">Relations</legend>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No relations.</p>
      ) : (
        <ul aria-label="Selected relations" className="space-y-1 text-sm">
          {value.map((relation, index) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2"
              key={`${relation.targetType}:${relation.targetId}:${relation.sectionId ?? ""}`}
            >
              <span>{relation.label}</span>
              <Button
                aria-label={`Remove relation ${relation.label}`}
                onClick={() => remove(index)}
                size="sm"
                type="button"
                variant="outline"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      {value.length >= PLANNED_TEST_RELATION_MAX ? (
        <p className="text-sm text-muted-foreground">
          A Planned Test Case has at most {PLANNED_TEST_RELATION_MAX} relations.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-relation-type`}>Relation type</label>
            <NativeSelect
              id={`${idPrefix}-relation-type`}
              onChange={(event) =>
                chooseType(event.target.value as PlannedTestRelationTargetType)
              }
              value={targetType}
            >
              {PLANNED_TEST_RELATION_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-relation-target`}>
              Relation target
            </label>
            <NativeSelect
              aria-describedby={statusId}
              id={`${idPrefix}-relation-target`}
              onChange={(event) => {
                picker.setErrorMap({ onSubmit: undefined });
                picker.setFieldValue("targetId", event.target.value);
                picker.setFieldValue("sectionId", "");
              }}
              value={targetId}
            >
              <option value="">Choose a {targetType}</option>
              {(targets ?? []).map((target) => (
                <option key={target.targetId} value={target.targetId}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {selected?.targetType === "Document" ? (
            <div className="grid gap-1 text-sm sm:col-span-2">
              <label htmlFor={`${idPrefix}-relation-section`}>
                Section (revision {selected.documentRevision ?? 0})
              </label>
              <NativeSelect
                id={`${idPrefix}-relation-section`}
                onChange={(event) => {
                  picker.setErrorMap({ onSubmit: undefined });
                  picker.setFieldValue("sectionId", event.target.value);
                }}
                value={sectionId}
              >
                <option value="">Whole Document</option>
                {selected.sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.label}
                  </option>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <Button
              disabled={!selected}
              onClick={() => submitForm(picker).catch(() => undefined)}
              size="sm"
              type="button"
              variant="outline"
            >
              Add relation
            </Button>
          </div>
        </div>
      )}
      <picker.Subscribe selector={(state): unknown => state.errorMap.onSubmit}>
        {(error) =>
          typeof error === "string" ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null
        }
      </picker.Subscribe>
      <p
        aria-live="polite"
        className="text-sm text-muted-foreground"
        id={statusId}
        role="status"
      >
        {message || loadMessage}
      </p>
    </fieldset>
  );
}
