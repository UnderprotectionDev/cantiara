// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.

import { userFlowTitleSchema } from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm, useSelector } from "@tanstack/react-form";
import { submitForm } from "@/lib/submit-form";

export function CreateUserFlowForm({
  onCreate,
  readOnly,
}: {
  onCreate: (title: string) => Promise<unknown>;
  readOnly: boolean;
}) {
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = userFlowTitleSchema.safeParse(value.title);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the title.",
            fields: {},
          },
        });
        return;
      }
      try {
        await onCreate(parsed.data);
        formApi.setFieldValue("title", "");
        form.setErrorMap({ onSubmit: undefined });
      } catch (failure) {
        form.setErrorMap({
          onSubmit: {
            form:
              failure instanceof Error
                ? failure.message
                : "User Flow could not be created.",
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
  const title = useSelector(form.store, (state) => state.values.title);

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form).catch(() => undefined);
      }}
    >
      <Label htmlFor="user-flow-title">Title</Label>
      <form.Field name="title">
        {(field) => (
          <Input
            id="user-flow-title"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      {error ? <p role="alert">{error}</p> : null}
      <Button disabled={readOnly || title.trim() === ""} type="submit">
        Create User Flow
      </Button>
    </form>
  );
}
