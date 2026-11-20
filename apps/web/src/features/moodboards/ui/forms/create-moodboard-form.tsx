// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.

import {
  createMoodboardInputSchema,
  MOODBOARD_UI_LABELS,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm, useSelector } from "@tanstack/react-form";
import { submitForm } from "@/lib/submit-form";

import type { useMoodboards } from "../../hooks/use-moodboards";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

export function CreateMoodboardForm({
  api,
  projectId,
}: {
  api: MoodboardsApi;
  projectId: string;
}) {
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = createMoodboardInputSchema.safeParse({
        projectId,
        title: value.title,
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form: parsed.error.issues[0]?.message ?? "Check the title.",
            fields: {},
          },
        });
        return;
      }
      form.setErrorMap({ onSubmit: undefined });
      await api.createMoodboard.mutateAsync({ title: parsed.data.title });
      formApi.setFieldValue("title", "");
    },
  });
  const formError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );

  return (
    <>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submitForm(form).catch(() => undefined);
        }}
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor="moodboard-title">{MOODBOARD_UI_LABELS.title}</Label>
          <form.Field name="title">
            {(field) => (
              <Input
                id="moodboard-title"
                maxLength={255}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <Button disabled={api.createMoodboard.isPending} type="submit">
          {MOODBOARD_UI_LABELS.createMoodboard}
        </Button>
      </form>
      {formError ? <p role="alert">{formError}</p> : null}
    </>
  );
}
