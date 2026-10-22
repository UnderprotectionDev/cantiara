// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import { userFlowTitleSchema } from "@cantiara/api/user-flow";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";

export function CreateUserFlowForm({
  onCreate,
  readOnly,
}: {
  onCreate: (title: string) => Promise<unknown>;
  readOnly: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = userFlowTitleSchema.safeParse(value.title);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "Check the title.");
        return;
      }
      try {
        await onCreate(parsed.data);
        formApi.setFieldValue("title", "");
        setError(null);
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "User Flow could not be created.",
        );
      }
    },
  });
  const title = useStore(form.store, (state) => state.values.title);

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
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
