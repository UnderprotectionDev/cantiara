// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the chosen version and form fields.
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";
import { createScreenFromTemplateFormSchema } from "../../lib/screen-forms";
import type { ScreenTemplateActions } from "../../lib/screen-template-actions";

/** `Create Screen from Template` into the current Project. */
export function CreateScreenFromTemplate({
  actions,
}: {
  actions: Pick<ScreenTemplateActions, "create" | "templates">;
}) {
  const [error, setError] = useState<string>();
  const firstTemplateId = actions.templates[0]?.id;
  const form = useForm({
    defaultValues: { templateId: "", title: "" },
    onSubmit: async ({ formApi, value }) => {
      setError(undefined);
      const parsed = createScreenFromTemplateFormSchema.safeParse({
        templateId: value.templateId || firstTemplateId,
        title: value.title,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the form.");
        return;
      }
      try {
        await actions.create(parsed.data.templateId, parsed.data.title);
        formApi.setFieldValue("title", "");
      } catch {
        setError("Screen could not be created from the template.");
      }
    },
  });
  if (!firstTemplateId) {
    return null;
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      aria-label="Create Screen from Template"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-border/70 p-5 text-sm"
      onSubmit={submit}
    >
      <label htmlFor="screen-template">Template</label>
      <form.Field name="templateId">
        {(field) => (
          <NativeSelect
            id="screen-template"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value || firstTemplateId}
          >
            {actions.templates.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <label htmlFor="screen-from-template-title">Title</label>
      <form.Field name="title">
        {(field) => (
          <Input
            className="w-56"
            id="screen-from-template-title"
            maxLength={255}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button type="submit">Create Screen from Template</Button>
      {error ? (
        <span className="text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </form>
  );
}
