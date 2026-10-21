// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the close form fields.
import {
  EXTERNAL_COPY_STATES,
  TOOL_ESCAPE_CLOSE_LABEL,
  TOOL_ESCAPE_IMPACTS,
  TOOL_ESCAPE_RESTORE_METHODS,
  type ToolEscapeCloseRecord,
  type ToolEscapeImpact,
  type ToolEscapeRecord,
} from "@cantiara/api/product-gaps";
import { Alert } from "@cantiara/ui/components/alert";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useId, useState } from "react";
import {
  type CloseFormValues,
  closeImpact,
  EMPTY_CLOSE_FORM,
  errorText,
} from "../../lib/product-gap-form";
import {
  type LoadProductGapTargets,
  ProductGapLinksField,
} from "./product-gap-links-field";

/** Names the unmet conditions the seam reported, else the plain message. */
function closeErrorText(error: unknown) {
  const data =
    typeof error === "object" && error !== null && "data" in error
      ? (error as { data?: { conditions?: unknown } }).data
      : undefined;
  if (Array.isArray(data?.conditions)) {
    return `The Tool Escape was not closed. Unmet: ${data.conditions.join("; ")}.`;
  }
  return errorText(error, "The Tool Escape was not closed.");
}

export type CloseEscape = (
  event: ToolEscapeRecord,
  values: CloseFormValues,
  impact: ToolEscapeImpact,
) => Promise<unknown>;

/** The stored close as readable text. A note or screenshot is never shown as proof. */
export function ToolEscapeCloseEvidence({
  close,
  formatDateTime,
}: {
  close: ToolEscapeCloseRecord;
  formatDateTime: (value: string) => string;
}) {
  const highImpact = close.impact !== "Never held parallel truth";
  return (
    <section
      aria-label="Close evidence"
      className="space-y-1 rounded-md border border-border/70 p-3"
    >
      <h4 className="font-medium">
        Closed{" "}
        <time dateTime={close.closedAt}>{formatDateTime(close.closedAt)}</time>
      </h4>
      <p>{`Impact judged: ${close.impact}`}</p>
      {highImpact ? (
        <>
          <p>{`Workflow succeeded on candidate build ${close.candidateBuild} (run ${close.workflowRef}).`}</p>
          <p>{`Truth restored by ${close.restoreMethod} in:`}</p>
          <ul aria-label="Restored product records" className="list-disc pl-5">
            {close.records.map((record) => (
              <li key={`${record.targetType}:${record.targetId}`}>
                {record.state === "resolved"
                  ? `${record.targetType}: ${record.label ?? ""}`
                  : `${record.targetType}: unavailable (${record.brokenReason ?? "No access"})`}
              </li>
            ))}
          </ul>
          <p className="whitespace-pre-wrap">{`External copy closed: ${close.externalCopyHow}`}</p>
        </>
      ) : null}
    </section>
  );
}

/**
 * Close of a Tool Escape. What the escape held is chosen here, at close, and
 * never stored on the event. `Never held parallel truth` is its one close and
 * carries no proof; a high-impact close needs all four conditions and the
 * seam refuses with the unmet ones named, shown as text.
 */
export function ToolEscapeCloseForm({
  event,
  loadTargets,
  onClose,
}: {
  event: ToolEscapeRecord;
  loadTargets: LoadProductGapTargets;
  onClose: CloseEscape;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState("");
  const form = useForm({
    defaultValues: EMPTY_CLOSE_FORM,
    onSubmit: async ({ value }) => {
      setError(undefined);
      setMessage("");
      const impact = closeImpact(value);
      if (!impact.success) {
        setError(impact.error.issues[0]?.message);
        return;
      }
      try {
        await onClose(event, value, impact.data);
        setMessage("Tool Escape closed.");
      } catch (caught) {
        setError(closeErrorText(caught));
      }
    },
  });

  if (!open) {
    return (
      <Button
        aria-label={`${TOOL_ESCAPE_CLOSE_LABEL} ${event.tool}, ${event.intendedJob}`}
        onClick={() => setOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        {TOOL_ESCAPE_CLOSE_LABEL}
      </Button>
    );
  }

  return (
    <form
      aria-label={`${TOOL_ESCAPE_CLOSE_LABEL} form for ${event.intendedJob}`}
      className="grid gap-3 rounded-md border border-border/70 p-3"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <form.Field name="impact">
        {(field) => (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${id}-impact`}>
              What the escape held
            </FieldLabel>
            <NativeSelect
              id={`${id}-impact`}
              onBlur={field.handleBlur}
              onChange={(changed) =>
                field.handleChange(
                  changed.target.value as typeof field.state.value,
                )
              }
              value={field.state.value}
            >
              <option value="">Choose</option>
              {TOOL_ESCAPE_IMPACTS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </form.Field>
      <p className="text-muted-foreground">
        Choosing Never held parallel truth closes without proof, and only you
        judge it. A high-impact close needs all four: the same workflow
        succeeded on the current candidate, the truth is back in product
        records, the external copy is no longer a parallel source, and the
        evidence names those records. A note or a screenshot does not close it.
      </p>
      <form.Field name="build">
        {(field) => (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${id}-build`}>Candidate build</FieldLabel>
            <Input
              id={`${id}-build`}
              onBlur={field.handleBlur}
              onChange={(changed) => field.handleChange(changed.target.value)}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="runRef">
        {(field) => (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${id}-run`}>Workflow run</FieldLabel>
            <Input
              id={`${id}-run`}
              onBlur={field.handleBlur}
              onChange={(changed) => field.handleChange(changed.target.value)}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <form.Field name="restoreMethod">
        {(field) => (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${id}-method`}>
              How the truth returned
            </FieldLabel>
            <NativeSelect
              id={`${id}-method`}
              onBlur={field.handleBlur}
              onChange={(changed) =>
                field.handleChange(
                  changed.target.value as typeof field.state.value,
                )
              }
              value={field.state.value}
            >
              <option value="">Choose</option>
              {TOOL_ESCAPE_RESTORE_METHODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </form.Field>
      <form.Field name="restored">
        {(field) => (
          <ProductGapLinksField
            idPrefix={`${id}-restored`}
            legend="Restored product records"
            loadTargets={loadTargets}
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="externalCopyState">
        {(field) => (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${id}-copy-state`}>External copy</FieldLabel>
            <NativeSelect
              id={`${id}-copy-state`}
              onBlur={field.handleBlur}
              onChange={(changed) =>
                field.handleChange(
                  changed.target.value as typeof field.state.value,
                )
              }
              value={field.state.value}
            >
              <option value="">Choose</option>
              {EXTERNAL_COPY_STATES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </form.Field>
      <form.Field name="externalCopyHow">
        {(field) => (
          <Field className="gap-1">
            <FieldLabel htmlFor={`${id}-copy-how`}>
              How the external copy was closed
            </FieldLabel>
            <Input
              id={`${id}-copy-how`}
              onBlur={field.handleBlur}
              onChange={(changed) => field.handleChange(changed.target.value)}
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <div>
            <Button disabled={pending} size="sm" type="submit">
              {TOOL_ESCAPE_CLOSE_LABEL}
            </Button>
          </div>
        )}
      </form.Subscribe>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <p aria-live="polite" className="text-muted-foreground" role="status">
        {message}
      </p>
    </form>
  );
}
