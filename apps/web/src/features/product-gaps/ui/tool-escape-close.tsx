// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the close form fields.
import {
  EXTERNAL_COPY_STATES,
  TOOL_ESCAPE_CLOSE_LABEL,
  TOOL_ESCAPE_IMPACTS,
  TOOL_ESCAPE_RESTORE_METHODS,
  type ToolEscapeCloseRecord,
  type ToolEscapeImpact,
  type ToolEscapeRecord,
  type ToolEscapeRestoreMethod,
} from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { useId, useState } from "react";
import {
  type CloseFormValues,
  EMPTY_CLOSE_FORM,
  errorText,
} from "../lib/product-gap-form";
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
}: {
  close: ToolEscapeCloseRecord;
}) {
  return (
    <section
      aria-label="Close evidence"
      className="space-y-1 rounded-md border border-border/70 p-3"
    >
      <h4 className="font-medium">
        Closed{" "}
        <time dateTime={close.closedAt}>
          {new Date(close.closedAt).toLocaleString()}
        </time>
      </h4>
      <p>{`Impact judged: ${close.impact}`}</p>
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
    </section>
  );
}

/**
 * Close of a Tool Escape. What the escape held is chosen here, at close, and
 * never stored on the event. Every field is a labelled native control. The
 * seam refuses a close with an unmet condition and the refusal is shown as
 * text.
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
  const [values, setValues] = useState<CloseFormValues>(EMPTY_CLOSE_FORM);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState("");
  const set = (patch: Partial<CloseFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

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

  async function submit() {
    setError(undefined);
    setMessage("");
    if (!values.impact) {
      setError("Choose what the escape held before closing it.");
      return;
    }
    try {
      await onClose(event, values, values.impact);
      setMessage("Tool Escape closed.");
    } catch (caught) {
      setError(closeErrorText(caught));
    }
  }

  return (
    <form
      aria-label={`${TOOL_ESCAPE_CLOSE_LABEL} form for ${event.intendedJob}`}
      className="grid gap-3 rounded-md border border-border/70 p-3"
      onSubmit={(submitted) => {
        submitted.preventDefault();
        submit().catch(() => undefined);
      }}
    >
      <div className="grid gap-1">
        <label htmlFor={`${id}-impact`}>What the escape held</label>
        <NativeSelect
          id={`${id}-impact`}
          onChange={(changed) =>
            set({ impact: changed.target.value as ToolEscapeImpact })
          }
          value={values.impact}
        >
          <option value="">Choose</option>
          {TOOL_ESCAPE_IMPACTS.map((impact) => (
            <option key={impact} value={impact}>
              {impact}
            </option>
          ))}
        </NativeSelect>
      </div>
      <p className="text-muted-foreground">
        A high-impact close needs all four: the same workflow succeeded on the
        current candidate, the truth is back in product records, the external
        copy is no longer a parallel source, and the evidence names those
        records. A note or a screenshot does not close it.
      </p>
      <div className="grid gap-1">
        <label htmlFor={`${id}-build`}>Candidate build</label>
        <Input
          id={`${id}-build`}
          onChange={(changed) => set({ build: changed.target.value })}
          value={values.build}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-run`}>Workflow run</label>
        <Input
          id={`${id}-run`}
          onChange={(changed) => set({ runRef: changed.target.value })}
          value={values.runRef}
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-method`}>How the truth returned</label>
        <NativeSelect
          id={`${id}-method`}
          onChange={(changed) =>
            set({
              restoreMethod: changed.target.value as ToolEscapeRestoreMethod,
            })
          }
          value={values.restoreMethod}
        >
          <option value="">Choose</option>
          {TOOL_ESCAPE_RESTORE_METHODS.map((method) => (
            <option key={method} value={method}>
              {method}
            </option>
          ))}
        </NativeSelect>
      </div>
      <ProductGapLinksField
        idPrefix={`${id}-restored`}
        legend="Restored product records"
        loadTargets={loadTargets}
        onChange={(restored) => set({ restored })}
        value={values.restored}
      />
      <div className="grid gap-1">
        <label htmlFor={`${id}-copy-state`}>External copy</label>
        <NativeSelect
          id={`${id}-copy-state`}
          onChange={(changed) =>
            set({
              externalCopyState: changed.target
                .value as CloseFormValues["externalCopyState"],
            })
          }
          value={values.externalCopyState}
        >
          <option value="">Choose</option>
          {EXTERNAL_COPY_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${id}-copy-how`}>
          How the external copy was closed
        </label>
        <Input
          id={`${id}-copy-how`}
          onChange={(changed) => set({ externalCopyHow: changed.target.value })}
          value={values.externalCopyHow}
        />
      </div>
      <div>
        <Button size="sm" type="submit">
          {TOOL_ESCAPE_CLOSE_LABEL}
        </Button>
      </div>
      {error ? (
        <p className="text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p aria-live="polite" className="text-muted-foreground" role="status">
        {message}
      </p>
    </form>
  );
}
