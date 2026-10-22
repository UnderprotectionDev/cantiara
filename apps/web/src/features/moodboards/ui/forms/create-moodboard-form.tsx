// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  createMoodboardInputSchema,
  MOODBOARD_UI_LABELS,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";

import type { useMoodboards } from "../../hooks/use-moodboards";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

export function CreateMoodboardForm({
  api,
  projectId,
}: {
  api: MoodboardsApi;
  projectId: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { title: "" },
    onSubmit: ({ formApi, value }) => {
      const parsed = createMoodboardInputSchema.safeParse({
        projectId,
        title: value.title,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Check the title.");
        return;
      }
      setFormError(null);
      api.createMoodboard.mutate(
        { title: parsed.data.title },
        { onSuccess: () => formApi.setFieldValue("title", "") },
      );
    },
  });

  return (
    <>
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          form.handleSubmit().catch(() => undefined);
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
