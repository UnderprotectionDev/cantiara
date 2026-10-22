// biome-ignore-all lint/performance/noJsxPropsBind: The form binds its own title field.
import { workTitleSchema } from "@cantiara/api/work-lifecycle";
import type { WorkTemplate } from "@cantiara/api/work-templates";
import { Button } from "@cantiara/ui/components/button";
import { Field, FieldLabel } from "@cantiara/ui/components/field";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";

export function InstantiateWorkTemplateForm({
  disabled,
  onCancel,
  onCreate,
  onValidationError,
  template,
}: {
  disabled: boolean;
  onCancel: () => void;
  onCreate: (title: string) => Promise<void>;
  onValidationError: (message: string) => void;
  template: WorkTemplate;
}) {
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value }) => {
      const parsed = workTitleSchema.safeParse(value.title);
      if (!parsed.success) {
        onValidationError(
          parsed.error.issues[0]?.message ?? "Check the Work title.",
        );
        return;
      }
      await onCreate(parsed.data);
    },
  });
  return (
    <form
      aria-label={`Create Work from ${template.name}`}
      className="mt-4 flex flex-wrap items-end gap-2 border-border/70 border-t pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Field className="min-w-64 flex-1">
            <FieldLabel htmlFor={`work-template-title-${template.id}`}>
              Title
            </FieldLabel>
            <Input
              disabled={disabled}
              id={`work-template-title-${template.id}`}
              onChange={(event) => field.handleChange(event.target.value)}
              required
              value={field.state.value}
            />
          </Field>
        )}
      </form.Field>
      <Button disabled={disabled} size="sm" type="submit">
        Create from template
      </Button>
      <Button
        disabled={disabled}
        onClick={onCancel}
        size="sm"
        type="button"
        variant="ghost"
      >
        Cancel
      </Button>
    </form>
  );
}
