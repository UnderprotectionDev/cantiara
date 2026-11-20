// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the picker's local selection.

import {
  TEST_HANDOFF_CONTEXT_KINDS,
  TEST_HANDOFF_CONTEXT_REF_MAX,
  type TestHandoffContextCandidate,
  type TestHandoffContextKind,
  testHandoffContextRefKey,
} from "@cantiara/api/planned-tests";
import { Button } from "@cantiara/ui/components/button";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useSelector } from "@tanstack/react-store";
import { type Ref, useId, useImperativeHandle, useState } from "react";
import { submitForm } from "@/lib/submit-form";
import { orpc } from "@/utils/orpc";
import {
  type ContextRefDraft,
  describeContextRef,
} from "../../lib/test-handoff-form";

export type LoadTestHandoffContextTargets = (
  kind: TestHandoffContextKind,
) => Promise<TestHandoffContextCandidate[]>;

/**
 * Work, Feature, Document and Wireframe records a Test Handoff carries into its
 * package. Records are chosen from the live owner records of the Project and
 * pinned exactly (a Document at its current revision, a Wireframe at one exact
 * version), never typed as a title. Technical Diagrams have no versions yet
 * and are not offered. Native labelled controls keep it keyboard and screen
 * reader operable.
 */
export function TestHandoffContextField({
  idPrefix,
  loadTargets,
  onChange,
  resetRef,
  projectId,
  value,
}: {
  idPrefix: string;
  loadTargets: LoadTestHandoffContextTargets;
  projectId: string;
  onChange: (refs: ContextRefDraft[]) => void;
  resetRef?: Ref<() => void>;
  value: ContextRefDraft[];
}) {
  const statusId = useId();
  const [message, setMessage] = useState("");
  const picker = useForm({
    defaultValues: {
      kind: "Work" as TestHandoffContextKind,
      targetId: "",
      sectionId: "",
      wireframeVersion: "",
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
    [picker],
  );
  const { kind, targetId, sectionId, wireframeVersion } = useSelector(
    picker.store,
    (state) => state.values,
  );
  const targetsQuery = useQuery({
    gcTime: 0,
    queryFn: () => loadTargets(kind),
    queryKey: orpc.testHandoffContextTargets.queryKey({
      input: { projectId, kind },
    }),
  });
  const targets = targetsQuery.data;

  const selected = targets?.find((target) => target.targetId === targetId);

  function chooseKind(next: TestHandoffContextKind) {
    picker.reset(
      { kind: next, targetId: "", sectionId: "", wireframeVersion: "" },
      { keepDefaultValues: true },
    );
    setMessage("");
  }

  let loadMessage = "";
  if (targetsQuery.isError) {
    loadMessage = `${kind} records could not be loaded.`;
  } else if (targets?.length === 0) {
    loadMessage = `This Project has no ${kind} to add yet.`;
  }

  function add(): string | undefined {
    if (!selected) {
      return undefined;
    }
    let ref: ContextRefDraft["ref"];
    if (selected.kind === "Document") {
      ref = {
        documentRevision: selected.documentRevision ?? 0,
        kind: "Document",
        sectionId: sectionId || null,
        targetId: selected.targetId,
      };
    } else if (selected.kind === "Wireframe") {
      if (!wireframeVersion) {
        return "Choose a Wireframe version.";
      }
      ref = {
        kind: "Wireframe",
        targetId: selected.targetId,
        wireframeVersion: Number(wireframeVersion),
      };
    } else {
      ref = { kind: selected.kind, targetId: selected.targetId };
    }
    if (
      value.some(
        (item) =>
          testHandoffContextRefKey(item.ref) === testHandoffContextRefKey(ref),
      )
    ) {
      return `${selected.label} is already added.`;
    }
    onChange([
      ...value,
      { label: describeContextRef(ref, selected.label), ref },
    ]);
    picker.setFieldValue("targetId", "");
    picker.setFieldValue("sectionId", "");
    picker.setFieldValue("wireframeVersion", "");
    setMessage(`${selected.label} added to the package context.`);
    return undefined;
  }

  function remove(index: number) {
    picker.setErrorMap({ onSubmit: undefined });
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setMessage(removed ? `${removed.label} removed.` : "");
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3">
      <legend className="px-1 text-sm font-medium">Package context</legend>
      <p className="text-xs text-muted-foreground">
        Only the records you add here enter the package, each at one exact
        revision or version.
      </p>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">No context records.</p>
      ) : (
        <ul aria-label="Selected context records" className="space-y-1 text-sm">
          {value.map((item, index) => (
            <li
              className="flex flex-wrap items-center justify-between gap-2"
              key={testHandoffContextRefKey(item.ref)}
            >
              <span>{item.label}</span>
              <Button
                aria-label={`Remove context ${item.label}`}
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
      {value.length >= TEST_HANDOFF_CONTEXT_REF_MAX ? (
        <p className="text-sm text-muted-foreground">
          A Test Handoff selects at most {TEST_HANDOFF_CONTEXT_REF_MAX} context
          records.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-context-kind`}>Context type</label>
            <NativeSelect
              id={`${idPrefix}-context-kind`}
              onChange={(event) =>
                chooseKind(event.target.value as TestHandoffContextKind)
              }
              value={kind}
            >
              {TEST_HANDOFF_CONTEXT_KINDS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1 text-sm">
            <label htmlFor={`${idPrefix}-context-target`}>Context record</label>
            <NativeSelect
              aria-describedby={statusId}
              id={`${idPrefix}-context-target`}
              onChange={(event) => {
                picker.setErrorMap({ onSubmit: undefined });
                picker.setFieldValue("targetId", event.target.value);
                picker.setFieldValue("sectionId", "");
                picker.setFieldValue("wireframeVersion", "");
              }}
              value={targetId}
            >
              <option value="">Choose a {kind}</option>
              {(targets ?? []).map((target) => (
                <option key={target.targetId} value={target.targetId}>
                  {target.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          {selected?.kind === "Document" ? (
            <div className="grid gap-1 text-sm sm:col-span-2">
              <label htmlFor={`${idPrefix}-context-section`}>
                Section (revision {selected.documentRevision ?? 0})
              </label>
              <NativeSelect
                id={`${idPrefix}-context-section`}
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
          {selected?.kind === "Wireframe" ? (
            <div className="grid gap-1 text-sm sm:col-span-2">
              <label htmlFor={`${idPrefix}-context-version`}>
                Wireframe version
              </label>
              <NativeSelect
                id={`${idPrefix}-context-version`}
                onChange={(event) => {
                  picker.setErrorMap({ onSubmit: undefined });
                  picker.setFieldValue("wireframeVersion", event.target.value);
                }}
                value={wireframeVersion}
              >
                <option value="">Choose a version</option>
                {[...selected.wireframeVersions].reverse().map((version) => (
                  <option key={version} value={version}>
                    {`Version ${version}`}
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
              Add context record
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
      >
        {message || loadMessage}
      </p>
    </fieldset>
  );
}
