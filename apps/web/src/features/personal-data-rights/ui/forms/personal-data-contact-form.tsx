// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  EXPORT_PERSONAL_DATA_LABEL,
  personalDataErasePreviewInputSchema,
  personalDataPreviewInputSchema,
} from "@cantiara/api/personal-data-rights";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";

/** Picks the one Contact whose person package is reviewed. */
export function PersonalDataContactForm({
  contacts,
  disabled,
  onPreview,
  onPreviewErase,
}: {
  contacts: ReadonlyArray<{ id: string; label: string }>;
  disabled: boolean;
  onPreview: (contactId: string) => void;
  onPreviewErase: (contactId: string) => void;
}) {
  const form = useForm({
    defaultValues: { contactId: contacts[0]?.id ?? "" },
    onSubmitMeta: { preview: "package" } as { preview: "package" | "erase" },
    onSubmit: async ({ meta, value }) => {
      const schema =
        meta.preview === "erase"
          ? personalDataErasePreviewInputSchema
          : personalDataPreviewInputSchema;
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: { form: "Choose a Contact first.", fields: {} },
        });
        return;
      }
      form.setErrorMap({ onSubmit: undefined });
      const preview = meta.preview === "erase" ? onPreviewErase : onPreview;
      await preview(parsed.data.contactId);
    },
  });
  const refusal = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  return (
    <form
      aria-label={`${EXPORT_PERSONAL_DATA_LABEL} selection`}
      className="space-y-3"
      onSubmit={(event: SubmitEvent) => {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form).catch(() => undefined);
      }}
    >
      <form.Field name="contactId">
        {(field) => (
          <label
            className="block space-y-1 text-sm"
            htmlFor="personal-data-contact"
          >
            <span>Contact</span>
            <NativeSelect
              disabled={disabled || contacts.length === 0}
              id="personal-data-contact"
              onChange={(event) => field.handleChange(event.target.value)}
              value={field.state.value}
            >
              {contacts.map((contact) => (
                <NativeSelectOption key={contact.id} value={contact.id}>
                  {contact.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </label>
        )}
      </form.Field>
      {refusal ? (
        <p className="text-sm" role="alert">
          {refusal}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={disabled || contacts.length === 0} type="submit">
          Preview package
        </Button>
        <Button
          disabled={disabled || contacts.length === 0}
          onClick={() =>
            submitForm(form, { preview: "erase" }).catch(() => undefined)
          }
          type="button"
          variant="outline"
        >
          Preview erase
        </Button>
      </div>
    </form>
  );
}
