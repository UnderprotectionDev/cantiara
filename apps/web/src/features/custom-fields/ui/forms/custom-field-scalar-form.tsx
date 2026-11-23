// biome-ignore-all lint/performance/noJsxPropsBind: The blur editor binds to the current Custom field.

import {
  customFieldValuePayloadSchema,
  type ParsedCustomFieldValuePayload,
} from "@cantiara/api/custom-fields";
import { Input } from "@cantiara/ui/components/input";
import { useRetainVirtualRow } from "@cantiara/ui/hooks/use-retain-virtual-row";
import { useForm, useSelector } from "@tanstack/react-form";
import { useEffect } from "react";
import { mutationErrorMessage } from "@/lib/mutation-messages";
import { submitForm } from "@/lib/submit-form";

export function CustomFieldScalarForm({
  current,
  disabled,
  id,
  kind,
  onCommit,
  revision,
}: {
  current: ParsedCustomFieldValuePayload | null;
  disabled: boolean;
  id: string;
  kind: "text" | "number";
  onCommit: (
    value: ParsedCustomFieldValuePayload | null,
    baseRevision: number,
  ) => Promise<void>;
  revision: number;
}) {
  let committed = "";
  if (current?.kind === "text") {
    committed = current.text;
  } else if (current?.kind === "number") {
    committed = String(current.number);
  }
  const form = useForm({
    defaultValues: { draft: committed, editingRevision: null as number | null },
    onSubmit: async ({ formApi, value: { draft, editingRevision } }) => {
      if (editingRevision === null) {
        return;
      }
      if (draft === committed) {
        formApi.reset();
        return;
      }
      const trimmed = draft.trim();
      const payload =
        kind === "number"
          ? { kind, number: Number(trimmed) }
          : { kind, text: trimmed };
      const parsed = customFieldValuePayloadSchema
        .nullable()
        .safeParse(trimmed === "" ? null : payload);
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: {
            fields: {},
            form: parsed.error.issues[0]?.message ?? "Enter a valid value.",
          },
        });
        return;
      }
      try {
        await onCommit(parsed.data, editingRevision);
        formApi.reset(
          { draft: trimmed, editingRevision: null },
          { keepDefaultValues: true },
        );
      } catch (failure) {
        formApi.setErrorMap({
          onSubmit: {
            fields: {},
            form: mutationErrorMessage(
              failure,
              "Custom field could not be saved.",
            ),
          },
        });
      }
    },
  });
  useEffect(() => {
    if (
      form.getFieldValue("editingRevision") === null &&
      form.getFieldValue("draft") !== committed
    ) {
      form.reset(
        { draft: committed, editingRevision: null },
        { keepDefaultValues: true },
      );
    }
  }, [committed, form]);
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const hasDraft = useSelector(
    form.store,
    (state) => state.values.editingRevision !== null,
  );
  useRetainVirtualRow(hasDraft);
  const pending = useSelector(form.store, (state) => state.isSubmitting);
  const errorId = `${id}-error`;

  return (
    <>
      <form.Field name="draft">
        {(field) => (
          <Input
            aria-describedby={error ? errorId : undefined}
            aria-invalid={Boolean(error)}
            disabled={disabled || pending}
            id={id}
            onBlur={(event) => {
              field.handleBlur();
              if (event.currentTarget.validity.badInput) {
                form.setErrorMap({
                  onSubmit: { fields: {}, form: "Enter a valid number." },
                });
                return;
              }
              submitForm(form).catch(() => undefined);
            }}
            onChange={(event) => {
              if (form.getFieldValue("editingRevision") === null) {
                form.setFieldValue("editingRevision", revision);
              }
              field.handleChange(event.target.value);
            }}
            placeholder="Not evaluated"
            step={kind === "number" ? "any" : undefined}
            type={kind}
            value={field.state.value}
          />
        )}
      </form.Field>
      {error ? (
        <p className="text-sm text-destructive" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
