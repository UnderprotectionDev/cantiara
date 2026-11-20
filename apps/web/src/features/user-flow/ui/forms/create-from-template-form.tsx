// biome-ignore-all lint/performance/noJsxPropsBind: Forms close over their own draft fields.

import type { UserFlowTemplateView } from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";

import { createUserFlowFromTemplateFormSchema } from "../../lib/user-flow-forms";

/** `Create from template`: a new, independent User Flow with no live bind to the source. */
export function CreateFromTemplateForm({
  onCreate,
  readOnly,
  templates,
}: {
  onCreate: (templateId: string, title: string) => Promise<unknown>;
  readOnly: boolean;
  templates: UserFlowTemplateView[];
}) {
  const form = useForm({
    defaultValues: { templateId: "", title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = createUserFlowFromTemplateFormSchema.safeParse(value);
      if (!parsed.success) {
        return;
      }
      try {
        await onCreate(parsed.data.templateId, parsed.data.title);
        formApi.reset();
        form.setErrorMap({ onSubmit: undefined });
      } catch (failure) {
        form.setErrorMap({
          onSubmit: {
            form:
              failure instanceof Error
                ? failure.message
                : "The User Flow could not be created.",
            fields: {},
          },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );

  if (templates.length === 0) {
    return null;
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    event.stopPropagation();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form className="space-y-2" onSubmit={submit}>
      <Label htmlFor="user-flow-from-template">Template</Label>
      <form.Field name="templateId">
        {(field) => (
          <NativeSelect
            id="user-flow-from-template"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          >
            <NativeSelectOption value="">Select a template</NativeSelectOption>
            {templates.map((template) => (
              <NativeSelectOption key={template.id} value={template.id}>
                {template.name} ({template.structure.nodes.length} nodes)
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <Label htmlFor="user-flow-from-template-title">Title</Label>
      <form.Field name="title">
        {(field) => (
          <Input
            id="user-flow-from-template-title"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      {error ? <p role="alert">{error}</p> : null}
      <form.Subscribe selector={(state) => state.values}>
        {(values) => (
          <Button
            disabled={
              readOnly ||
              !createUserFlowFromTemplateFormSchema.safeParse(values).success
            }
            type="submit"
          >
            Create from template
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
