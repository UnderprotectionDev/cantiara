// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form field.
import { screenTitleSchema } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { type FormEvent, useState } from "react";

export type CreateScreen = (title: string) => Promise<unknown>;

export function CreateScreenForm({ onCreate }: { onCreate: CreateScreen }) {
  const [error, setError] = useState<string>();
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      setError(undefined);
      const parsed = screenTitleSchema.safeParse(value.title);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message);
        return;
      }
      try {
        await onCreate(value.title);
        formApi.reset();
      } catch {
        setError("Screen could not be created.");
      }
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    form.handleSubmit().catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">Create Screen</h3>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(pending) => (
          <>
            <form.Field name="title">
              {(field) => (
                <div className="grid gap-2 text-sm">
                  <label htmlFor="screen-title">Title</label>
                  <Input
                    disabled={pending}
                    id="screen-title"
                    maxLength={255}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    required
                    value={field.state.value}
                  />
                </div>
              )}
            </form.Field>
            <Button disabled={pending} type="submit">
              Create Screen
            </Button>
          </>
        )}
      </form.Subscribe>
    </form>
  );
}
