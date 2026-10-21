// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import {
  PRODUCT_GAP_LABEL,
  type ProductGapRecord,
  RECORD_PRODUCT_GAP_LABEL,
  TOOL_ESCAPE_LABEL,
} from "@cantiara/api/product-gaps";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { type FormEvent, useState } from "react";
import {
  emptyGapForm,
  errorText,
  type GapFormValues,
} from "../lib/product-gap-form";
import {
  type LoadProductGapTargets,
  ProductGapLinksField,
} from "./product-gap-links-field";
import { ToolEscapeFields } from "./tool-escape-fields";

export type RecordGap = (values: GapFormValues) => Promise<unknown>;

/**
 * `Record Product Gap`: a dated Tool Escape plus a Product Gap the founder
 * chooses deliberately, either a new one or one that already exists. Titles
 * are never compared, and there is no status, severity or priority field.
 */
export function RecordProductGapForm({
  gaps,
  loadTargets,
  onSubmit,
}: {
  gaps: ProductGapRecord[];
  loadTargets: LoadProductGapTargets;
  onSubmit: RecordGap;
}) {
  const [values, setValues] = useState<GapFormValues>(() => emptyGapForm());
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const attaching = values.existingGapId !== "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    if (!values.escape.source) {
      setError("Choose the source Project or record.");
      return;
    }
    if (values.escape.reasons.length === 0) {
      setError("Choose at least one reason.");
      return;
    }
    setPending(true);
    try {
      await onSubmit(values);
      setValues(emptyGapForm());
    } catch (caught) {
      setError(errorText(caught, `${TOOL_ESCAPE_LABEL} was not saved.`));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-label={RECORD_PRODUCT_GAP_LABEL}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{RECORD_PRODUCT_GAP_LABEL}</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid gap-2 text-sm">
        <label htmlFor="product-gap-new-choice">{PRODUCT_GAP_LABEL}</label>
        <NativeSelect
          disabled={pending}
          id="product-gap-new-choice"
          onChange={(event) =>
            setValues({ ...values, existingGapId: event.target.value })
          }
          value={values.existingGapId}
        >
          <option value="">New {PRODUCT_GAP_LABEL}</option>
          {gaps.map((gap) => (
            <option key={gap.id} value={gap.id}>
              {gap.title}
            </option>
          ))}
        </NativeSelect>
      </div>
      {attaching ? null : (
        <>
          <div className="grid gap-2 text-sm">
            <label htmlFor="product-gap-new-title">Title</label>
            <Input
              disabled={pending}
              id="product-gap-new-title"
              maxLength={255}
              onChange={(event) =>
                setValues({ ...values, title: event.target.value })
              }
              required
              value={values.title}
            />
          </div>
          <div className="grid gap-2 text-sm">
            <label htmlFor="product-gap-new-need">Unmet need</label>
            <Textarea
              disabled={pending}
              id="product-gap-new-need"
              onChange={(event) =>
                setValues({ ...values, unmetNeed: event.target.value })
              }
              required
              rows={3}
              value={values.unmetNeed}
            />
          </div>
          <div className="grid gap-2 text-sm">
            <label htmlFor="product-gap-new-scope">Scope (optional)</label>
            <Textarea
              disabled={pending}
              id="product-gap-new-scope"
              onChange={(event) =>
                setValues({ ...values, scope: event.target.value })
              }
              rows={2}
              value={values.scope}
            />
          </div>
          <ProductGapLinksField
            idPrefix="product-gap-new"
            loadTargets={loadTargets}
            onChange={(links) => setValues({ ...values, links })}
            value={values.links}
          />
        </>
      )}
      <ToolEscapeFields
        disabled={pending}
        idPrefix="product-gap-escape"
        loadTargets={loadTargets}
        onChange={(next) => setValues({ ...values, escape: next })}
        value={values.escape}
      />
      <Button disabled={pending} type="submit">
        {RECORD_PRODUCT_GAP_LABEL}
      </Button>
    </form>
  );
}
