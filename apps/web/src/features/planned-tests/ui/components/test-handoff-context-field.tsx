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
import { useCallback, useEffect, useId, useState } from "react";
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
  value,
}: {
  idPrefix: string;
  loadTargets: LoadTestHandoffContextTargets;
  onChange: (refs: ContextRefDraft[]) => void;
  value: ContextRefDraft[];
}) {
  const statusId = useId();
  const [kind, setKind] = useState<TestHandoffContextKind>("Work");
  const [targets, setTargets] = useState<TestHandoffContextCandidate[] | null>(
    null,
  );
  const [targetId, setTargetId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [wireframeVersion, setWireframeVersion] = useState("");
  const [message, setMessage] = useState("");

  const selected = targets?.find((target) => target.targetId === targetId);

  const chooseKind = useCallback(
    async (next: TestHandoffContextKind) => {
      setKind(next);
      setTargets(null);
      setTargetId("");
      setSectionId("");
      setWireframeVersion("");
      setMessage("");
      try {
        const loaded = await loadTargets(next);
        setTargets(loaded);
        if (loaded.length === 0) {
          setMessage(`This Project has no ${next} to add yet.`);
        }
      } catch {
        setMessage(`${next} records could not be loaded.`);
      }
    },
    [loadTargets],
  );

  useEffect(() => {
    chooseKind("Work").catch(() => undefined);
  }, [chooseKind]);

  function add() {
    if (!selected) {
      return;
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
        setMessage("Choose a Wireframe version.");
        return;
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
      setMessage(`${selected.label} is already added.`);
      return;
    }
    onChange([
      ...value,
      { label: describeContextRef(ref, selected.label), ref },
    ]);
    setTargetId("");
    setSectionId("");
    setWireframeVersion("");
    setMessage(`${selected.label} added to the package context.`);
  }

  function remove(index: number) {
    const removed = value[index];
    onChange(value.filter((_, position) => position !== index));
    setMessage(removed ? `${removed.label} removed.` : "");
  }

  return (
    <fieldset className="space-y-3 rounded-md border border-border/70 p-3">
      <legend className="px-1 font-medium text-sm">Package context</legend>
      <p className="text-muted-foreground text-xs">
        Only the records you add here enter the package, each at one exact
        revision or version.
      </p>
      {value.length === 0 ? (
        <p className="text-muted-foreground text-sm">No context records.</p>
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
        <p className="text-muted-foreground text-sm">
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
                chooseKind(event.target.value as TestHandoffContextKind).catch(
                  () => undefined,
                )
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
                setTargetId(event.target.value);
                setSectionId("");
                setWireframeVersion("");
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
          {selected?.kind === "Wireframe" ? (
            <div className="grid gap-1 text-sm sm:col-span-2">
              <label htmlFor={`${idPrefix}-context-version`}>
                Wireframe version
              </label>
              <NativeSelect
                id={`${idPrefix}-context-version`}
                onChange={(event) => setWireframeVersion(event.target.value)}
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
              onClick={add}
              size="sm"
              type="button"
              variant="outline"
            >
              Add context record
            </Button>
          </div>
        </div>
      )}
      <p
        aria-live="polite"
        className="text-muted-foreground text-sm"
        id={statusId}
      >
        {message}
      </p>
    </fieldset>
  );
}
