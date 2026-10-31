// biome-ignore-all lint/performance/noJsxPropsBind: Fields bind to their own form state.

import {
  EXPORT_PERSONAL_DATA_LABEL,
  personalDataPreviewInputSchema,
} from "@cantiara/api/personal-data-rights";
import { Button } from "@cantiara/ui/components/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

/** Picks the one Contact whose person package is reviewed. */
export function PersonalDataContactForm({
  contacts,
  disabled,
  onPreview,
}: {
  contacts: ReadonlyArray<{ id: string; label: string }>;
  disabled: boolean;
  onPreview: (contactId: string) => void;
}) {
  const [refusal, setRefusal] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { contactId: contacts[0]?.id ?? "" },
    onSubmit: ({ value }) => {
      const parsed = personalDataPreviewInputSchema.safeParse(value);
      if (!parsed.success) {
        setRefusal("Choose a Contact first.");
        return;
      }
      setRefusal(null);
      onPreview(parsed.data.contactId);
    },
  });
  return (
    <form
      aria-label={`${EXPORT_PERSONAL_DATA_LABEL} selection`}
      className="space-y-3"
      onSubmit={(event: FormEvent) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
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
      <Button disabled={disabled || contacts.length === 0} type="submit">
        Preview package
      </Button>
    </form>
  );
}
