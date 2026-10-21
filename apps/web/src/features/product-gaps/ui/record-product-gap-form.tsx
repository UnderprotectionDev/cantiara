// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form fields.
import {
  PRODUCT_GAP_LABEL,
  type ProductGapRecord,
  RECORD_PRODUCT_GAP_LABEL,
  TOOL_ESCAPE_LABEL,
} from "@cantiara/api/product-gaps";
import { Alert } from "@cantiara/ui/components/alert";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { NativeSelect } from "@cantiara/ui/components/native-select";
import { Textarea } from "@cantiara/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import {
  emptyGapForm,
  errorText,
  type GapFormValues,
  gapFormError,
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
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: emptyGapForm(),
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      const invalid = gapFormError(value);
      if (invalid) {
        setError(invalid);
        return;
      }
      try {
        await onSubmit(value);
        formApi.reset(emptyGapForm());
      } catch (caught) {
        setError(errorText(caught, `${TOOL_ESCAPE_LABEL} was not saved.`));
      }
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      aria-label={RECORD_PRODUCT_GAP_LABEL}
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">{RECORD_PRODUCT_GAP_LABEL}</h3>
      {error ? <Alert variant="destructive">{error}</Alert> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="existingGapId">
              {(field) => (
                <Field className="text-sm">
                  <FieldLabel htmlFor="product-gap-new-choice">
                    {PRODUCT_GAP_LABEL}
                  </FieldLabel>
                  <NativeSelect
                    disabled={pending}
                    id="product-gap-new-choice"
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    value={field.state.value}
                  >
                    <option value="">New {PRODUCT_GAP_LABEL}</option>
                    {gaps.map((gap) => (
                      <option key={gap.id} value={gap.id}>
                        {gap.title}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
            </form.Field>
            <form.Subscribe selector={(state) => state.values.existingGapId}>
              {(existingGapId) =>
                existingGapId === "" ? (
                  <>
                    <form.Field name="title">
                      {(field) => (
                        <Field className="text-sm">
                          <FieldLabel htmlFor="product-gap-new-title">
                            Title
                          </FieldLabel>
                          <Input
                            disabled={pending}
                            id="product-gap-new-title"
                            maxLength={255}
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            value={field.state.value}
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="unmetNeed">
                      {(field) => (
                        <Field className="text-sm">
                          <FieldLabel htmlFor="product-gap-new-need">
                            Unmet need
                          </FieldLabel>
                          <Textarea
                            disabled={pending}
                            id="product-gap-new-need"
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            required
                            rows={3}
                            value={field.state.value}
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="scope">
                      {(field) => (
                        <Field className="text-sm">
                          <FieldLabel htmlFor="product-gap-new-scope">
                            Scope (optional)
                          </FieldLabel>
                          <Textarea
                            disabled={pending}
                            id="product-gap-new-scope"
                            onBlur={field.handleBlur}
                            onChange={(event) =>
                              field.handleChange(event.target.value)
                            }
                            rows={2}
                            value={field.state.value}
                          />
                        </Field>
                      )}
                    </form.Field>
                    <form.Field name="links">
                      {(field) => (
                        <ProductGapLinksField
                          idPrefix="product-gap-new"
                          loadTargets={loadTargets}
                          onChange={field.handleChange}
                          value={field.state.value}
                        />
                      )}
                    </form.Field>
                  </>
                ) : null
              }
            </form.Subscribe>
            <form.Field name="escape">
              {(field) => (
                <ToolEscapeFields
                  disabled={pending}
                  idPrefix="product-gap-escape"
                  loadTargets={loadTargets}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              )}
            </form.Field>
            <Button disabled={pending} type="submit">
              {RECORD_PRODUCT_GAP_LABEL}
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
