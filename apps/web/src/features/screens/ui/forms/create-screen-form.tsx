// biome-ignore-all lint/performance/noJsxPropsBind: Controls bind to the form field.

import { screenTitleSchema } from "@cantiara/api/screens";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { useForm, useSelector } from "@tanstack/react-form";
import type { SubmitEvent } from "react";
import { submitForm } from "@/lib/submit-form";

export type CreateScreen = (title: string) => Promise<unknown>;

export function CreateScreenForm({ onCreate }: { onCreate: CreateScreen }) {
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ value, formApi }) => {
      form.setErrorMap({ onSubmit: undefined });
      const parsed = screenTitleSchema.safeParse(value.title);
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: { form: parsed.error.issues[0]?.message, fields: {} },
        });
        return;
      }
      try {
        await onCreate(value.title);
        formApi.reset();
      } catch {
        form.setErrorMap({
          onSubmit: { form: "Screen could not be created.", fields: {} },
        });
      }
    },
  });
  const error = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    submitForm(form).catch(() => undefined);
  }
  return (
    <form
      className="space-y-4 rounded-lg border border-border/70 p-5"
      onSubmit={submit}
    >
      <h3 className="font-medium">Create Screen</h3>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
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
