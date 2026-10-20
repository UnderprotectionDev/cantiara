// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker's local selection.
import {
  TEST_GAP_LABEL,
  TEST_GAP_RELATION_MAX,
  TEST_GAP_RELATION_TARGET_TYPES,
  type TestGapRelationTarget,
  type TestGapRelationTargetType,
} from "@cantiara/api/test-gaps";
import { Button } from "@cantiara/ui/components/button";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useCallback, useEffect, useId, useState } from "react";
import type { RelationDraft } from "../lib/test-gap-form";

export type LoadGapRelationTargets = (
  targetType: TestGapRelationTargetType,
) => Promise<TestGapRelationTarget[]>;

const TARGET_TYPE_LABEL: Record<TestGapRelationTargetType, string> = {
  Document: "Spec section",
  Feature: "Feature",
  "Project Release": "Project Release",
  Risk: "Risk",
  Work: "Work",
};

/**
 * Support relations are chosen from the live owner records of the Project,
 * never typed as a title. Every control is a native labelled form control, so
 * the field is fully operable from the keyboard and read by a screen reader.
 */
export function TestGapRelationsField({
  idPrefix,
  loadTargets,
  onChange,
  value,
}: {
  idPrefix: string;
  loadTargets: LoadGapRelationTargets;
  onChange: (relations: RelationDraft[]) => void;
  value: RelationDraft[];
}) {
  const statusId = useId();
  const [targetType, setTargetType] =
    useState<TestGapRelationTargetType>("Feature");
  const [targets, setTargets] = useState<TestGapRelationTarget[] | null>(null);
  const [targetId, setTargetId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [message, setMessage] = useState("");

  const selected = targets?.find((target) => target.targetId === targetId);

  const chooseType = useCallback(
    async (next: TestGapRelationTargetType) => {
      setTargetType(next);
      setTargets(null);
      setTargetId("");
      setSectionId("");
      setMessage("");
      try {
        const loaded = await loadTargets(next);
        setTargets(loaded);
        if (loaded.length === 0) {
          setMessage(
            `This Project has no ${TARGET_TYPE_LABEL[next]} to relate yet.`,
          );
        }
      } catch {
        setMessage(`${TARGET_TYPE_LABEL[next]} records could not be loaded.`);
      }
    },
    [loadTargets],
  );

  useEffect(() => {
    chooseType("Feature").catch(() => undefined);
  }, [chooseType]);

  function add() {
    if (!selected) {
      return;
    }
    const duplicate = value.some(
      (item) =>
        item.targetType === selected.targetType &&
        item.targetId === selected.targetId &&
        item.sectionId === (sectionId || null),
    );
    if (duplicate) {
      setMessage(`${selected.label} is already related.`);
      return;
    }
    const sectionLabel = selected.sections.find(
      ({ id }) => id === sectionId,
    )?.label;
    onChange([
      ...value,
      {
        documentRevision: selected.documentRevision,
        label:
          selected.targetType === "Document"
            ? `Spec section: ${selected.label}, revision ${selected.documentRevision ?? 0}${
                sectionId ? `, section ${sectionLabel ?? sectionId}` : ""
              }`
            : `${selected.targetType}: ${selected.label}`,
        sectionId: sectionId || null,
        targetId: selected.targetId,
        targetType: selected.targetType,
      },
    ]);
    setTargetId("");
    setSectionId("");
    setMessage(`${selected.label} added to support relations.`);
  }

  function remove(index: number) {
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setMessage(
      removed ? `${removed.label} removed from support relations.` : "",
    );
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-sm">Support relations</legend>
      {value.length === 0 ? (
        <p className="text-muted-foreground text-sm">No support relations.</p>
      ) : (
        <ul
          aria-label="Selected support relations"
          className="space-y-1 text-sm"
        >
          {value.map((relation, index) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2"
              key={`${relation.targetType}:${relation.targetId}:${relation.sectionId ?? ""}`}
            >
              <span>{relation.label}</span>
              <Button
                aria-label={`Remove support relation ${relation.label}`}
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
      {value.length >= TEST_GAP_RELATION_MAX ? (
        <p className="text-muted-foreground text-sm">
          A {TEST_GAP_LABEL} has at most {TEST_GAP_RELATION_MAX} relations.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-relation-type`}>Relation type</label>
            <NativeSelect
              id={`${idPrefix}-relation-type`}
              onChange={(event) =>
                chooseType(
                  event.target.value as TestGapRelationTargetType,
                ).catch(() => undefined)
              }
              value={targetType}
            >
              {TEST_GAP_RELATION_TARGET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TARGET_TYPE_LABEL[type]}
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
                setTargetId(event.target.value);
                setSectionId("");
              }}
              value={targetId}
            >
              <option value="">Choose a {TARGET_TYPE_LABEL[targetType]}</option>
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
                onChange={(event) => setSectionId(event.target.value)}
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
              onClick={add}
              size="sm"
              type="button"
              variant="outline"
            >
              Add support relation
            </Button>
          </div>
        </div>
      )}
      <p
        aria-live="polite"
        className="text-muted-foreground text-sm"
        id={statusId}
        role="status"
      >
        {message}
      </p>
    </fieldset>
  );
}
