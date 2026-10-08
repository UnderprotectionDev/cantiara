// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind their current Decision selection.
import type {
  DecisionSupersessionGraph,
  DecisionSupersessionPreview,
  DecisionSupersessionSelection,
} from "@cantiara/api/decision-supersession";
import { Button } from "@cantiara/ui/components/button";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
export function DecisionSupersessionPreviewView({
  preview,
  pending,
  conflict = false,
  onConfirm,
  onCancel,
}: {
  preview: DecisionSupersessionPreview;
  pending: boolean;
  conflict?: boolean;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}) {
  const confirmLabel =
    preview.command.operation === "supersede"
      ? "Confirm supersession"
      : "Confirm removal";
  const ids = [preview.command.successorId, ...preview.command.predecessorIds];
  return (
    <section
      aria-label="Supersession preview"
      className="space-y-4 rounded-lg border p-5"
    >
      <h3 className="font-medium">Preview</h3>
      {ids.map((id) => {
        const record = preview.graph.records.find((item) => item.id === id);
        if (!record) {
          return null;
        }
        const change = preview.changes.find((item) => item.id === id);
        return (
          <article className="space-y-2 border-b pb-3" key={id}>
            <h4 className="font-medium">{record.title}</h4>
            <p>{change ? `${change.before} → ${change.after}` : record.life}</p>
            <p className="whitespace-pre-wrap break-words">{record.decision}</p>
            <p className="whitespace-pre-wrap break-words">
              Rationale: {record.rationale || "—"}
            </p>
            <ul aria-label="Evidence">
              {preview.graph.evidence
                .filter((item) => item.decisionId === id)
                .map((item) => (
                  <li className="break-words" key={item.id}>
                    {item.title}
                    {item.excerpt ? ` — ${item.excerpt}` : ""}
                  </li>
                ))}
            </ul>
          </article>
        );
      })}
      {preview.command.operation === "remove" ? (
        <ul aria-label="Supersedes" className="space-y-2">
          {preview.graph.relations.map((edge) => (
            <li className="break-words" key={edge.predecessorId}>
              <SupersessionRelationSummary
                records={preview.graph.records}
                relation={edge}
              />
            </li>
          ))}
        </ul>
      ) : null}
      <p className="whitespace-pre-wrap break-words">
        Transition rationale: {preview.command.rationale || "—"}
      </p>
      <p>
        Only full replacement uses Supersedes. Related records and their status,
        priority and planning stay unchanged.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending || conflict} onClick={() => onConfirm()}>
          {pending ? "Saving…" : null}
          {pending ? null : <span>{confirmLabel}</span>}
        </Button>
        <Button disabled={pending} onClick={onCancel} variant="outline">
          Cancel
        </Button>
      </div>
    </section>
  );
}

export function SupersessionSelectionForm({
  selection,
  records,
  onPreview,
  onCancel,
}: {
  selection: DecisionSupersessionSelection;
  records: DecisionSupersessionGraph["records"];
  onPreview: (selection: DecisionSupersessionSelection) => Promise<void>;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { predecessorIds: selection.predecessorIds, rationale: "" },
    onSubmit: async ({ value }) => {
      setError(undefined);
      try {
        await onPreview({
          ...selection,
          predecessorIds: value.predecessorIds,
          rationale: value.rationale.trim() || null,
        });
      } catch {
        setError(
          "Decisions changed or are unavailable. Review your selection and try again.",
        );
      }
    },
  });
  return (
    <form
      className="space-y-4 rounded-lg border p-5"
      onSubmit={(event) => {
        event.preventDefault();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <h3 className="font-medium">
        {selection.operation === "supersede"
          ? "Supersede another decision"
          : "Remove supersession"}
      </h3>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="predecessorIds">
              {(field) => (
                <fieldset className="space-y-2" disabled={pending}>
                  <legend>Decisions to supersede</legend>
                  {records
                    .filter((record) =>
                      selection.operation === "remove"
                        ? selection.predecessorIds.includes(record.id)
                        : record.life === "Valid" &&
                          record.id !== selection.successorId,
                    )
                    .map((record) => (
                      <label
                        className="flex min-h-11 items-center gap-3 break-words"
                        key={record.id}
                      >
                        <input
                          checked={field.state.value.includes(record.id)}
                          disabled={selection.operation === "remove"}
                          onChange={(event) =>
                            field.handleChange(
                              event.target.checked
                                ? [...field.state.value, record.id]
                                : field.state.value.filter(
                                    (id) => id !== record.id,
                                  ),
                            )
                          }
                          type="checkbox"
                        />
                        {record.title}
                      </label>
                    ))}
                </fieldset>
              )}
            </form.Field>
            <form.Field name="rationale">
              {(field) => (
                <div className="space-y-2">
                  <label htmlFor="supersession-rationale">
                    Transition rationale (optional)
                  </label>
                  <Textarea
                    disabled={pending}
                    id="supersession-rationale"
                    maxLength={20_000}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <Button disabled={pending} type="submit">
              {pending ? "Loading…" : "Preview"}
            </Button>
            <Button
              disabled={pending}
              onClick={onCancel}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}

export function SupersessionRelationSummary({
  records,
  relation,
}: {
  records: DecisionSupersessionGraph["records"];
  relation: DecisionSupersessionGraph["relations"][number];
}) {
  return (
    <span>
      {records.find((record) => record.id === relation.predecessorId)?.title} →{" "}
      {records.find((record) => record.id === relation.successorId)?.title}
    </span>
  );
}
