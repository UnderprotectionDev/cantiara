// biome-ignore-all lint/performance/noJsxPropsBind: The confirmation sends the founder's local answer.

import type {
  MergeUndoPreview,
  MergeUndoResolution,
  UndoMergeInput,
  UndoMergeResult,
} from "@cantiara/api/contacts";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useState } from "react";

/**
 * Says what an Undo Merge could not give back. Content can disappear between
 * the preview and the confirmation, so the result is reported, not dropped.
 */
export function undoResultNotice(result: UndoMergeResult) {
  if (result.unrestorable.length === 0) {
    return null;
  }
  const missing = result.unrestorable
    .map(({ count, kind }) => `${kind}: ${count}`)
    .join(", ");
  return `Undo Merge finished. Cannot be restored: ${missing}.`;
}

/**
 * The confirmation carries the survivor revision the founder reviewed and the
 * answer for a field changed since the merge, so an unseen change is rejected.
 */
export function undoMergeRequest(
  preview: MergeUndoPreview,
  resolution: MergeUndoResolution | null,
): UndoMergeInput {
  return {
    expectedSurvivorRevision: preview.survivor.revision,
    ...(resolution ? { resolutions: { displayName: resolution } } : {}),
    retiredId: preview.retiredId,
  };
}

const RESOLUTIONS: MergeUndoResolution[] = [
  "Keep current value",
  "Restore previous value",
];

export default function MergeUndoPanel({
  onCancel,
  onConfirm,
  pending,
  preview,
}: {
  onCancel: () => void;
  onConfirm: (resolution: MergeUndoResolution | null) => void;
  pending: boolean;
  preview: MergeUndoPreview;
}) {
  const [resolution, setResolution] = useState<MergeUndoResolution | null>(
    null,
  );
  const [conflict] = preview.conflicts;
  const blocked = conflict !== undefined && resolution === null;

  return (
    <section
      aria-label="Undo Merge Preview"
      className="space-y-3 rounded-md border px-4 py-3 text-sm"
    >
      <h3 className="font-semibold text-lg">Undo Merge Preview</h3>
      <p>
        <code>{preview.retiredId}</code> becomes a Contact again. Only what the
        merge moved is split back; later edits stay. Nothing is written until
        you confirm.
      </p>
      <dl className="grid gap-2 sm:grid-cols-[12rem_1fr]">
        <dt className="text-muted-foreground">Display name</dt>
        <dd>{preview.restoredDisplayName ?? "None"}</dd>
        <dt className="text-muted-foreground">Email aliases restored</dt>
        <dd>
          {preview.restoredEmails.length > 0
            ? preview.restoredEmails.join(", ")
            : "None"}
        </dd>
        <dt className="text-muted-foreground">Feedback restored</dt>
        <dd>{preview.restoredFeedbackIds.length}</dd>
        <dt className="text-muted-foreground">Belongs to Company</dt>
        <dd>{preview.restoredCompany ?? "None"}</dd>
        <dt className="text-muted-foreground">Persona links restored</dt>
        <dd>
          {preview.restoredPersonaDocuments.length > 0
            ? preview.restoredPersonaDocuments
                .map((persona) => persona.title)
                .join(", ")
            : "None"}
        </dd>
      </dl>
      {preview.unrestorable.length > 0 ? (
        <div role="alert">
          <p className="font-medium">Cannot be restored</p>
          <p>
            This is not a full undo: redacted or permanently deleted content
            stays gone.
          </p>
          <ul>
            {preview.unrestorable.map((missing) => (
              <li key={missing.kind}>
                {missing.kind}: {missing.count}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {conflict ? (
        <fieldset className="space-y-1">
          <legend className="font-medium">
            {conflict.field} changed after the merge
          </legend>
          <p>
            Now {conflict.currentValue ?? "empty"}; before the merge{" "}
            {conflict.previousValue ?? "empty"}.
          </p>
          <RadioGroup
            name="display-name-resolution"
            onValueChange={(value) =>
              setResolution(RESOLUTIONS.find((item) => item === value) ?? null)
            }
            value={resolution ?? ""}
          >
            {RESOLUTIONS.map((option, index) => (
              <label
                className="flex items-center gap-2"
                htmlFor={`display-name-resolution-${index}`}
                key={option}
              >
                <RadioGroupItem
                  id={`display-name-resolution-${index}`}
                  value={option}
                />
                {option}
              </label>
            ))}
          </RadioGroup>
        </fieldset>
      ) : null}
      <div className="flex gap-3">
        <button
          className="rounded-md bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50"
          disabled={pending || blocked}
          onClick={() => onConfirm(resolution)}
          type="button"
        >
          Confirm Undo Merge
        </button>
        <button
          className="rounded-md border px-3 py-2"
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
