// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current Moodboard and field handlers.
import {
  MOODBOARD_CAPTION_MAX_LENGTH,
  MOODBOARD_UI_LABELS,
  type Moodboard,
  type MoodboardVisual,
  updateMoodboardVisualCaptionInputSchema,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";

import type { useMoodboards } from "../../hooks/use-moodboards";
import { captionOrNull } from "../../lib/moodboard-form";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

export function VisualCaptionForm({
  api,
  item,
  moodboard,
}: {
  api: MoodboardsApi;
  item: MoodboardVisual;
  moodboard: Moodboard;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const inputId = `moodboard-caption-${item.id}`;
  const form = useForm({
    defaultValues: { caption: item.caption ?? "" },
    onSubmit: ({ value }) => {
      const parsed = updateMoodboardVisualCaptionInputSchema.safeParse({
        caption: captionOrNull(value.caption),
        itemId: item.id,
        moodboardId: moodboard.id,
      });
      if (!parsed.success) {
        setFormError(parsed.error.issues[0]?.message ?? "Check the Caption.");
        return;
      }
      setFormError(null);
      api.updateCaption.mutate({
        caption: parsed.data.caption,
        itemId: item.id,
        moodboard,
      });
    },
  });
  const caption = useStore(form.store, (state) => state.values.caption);

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
          <Label htmlFor={inputId}>{MOODBOARD_UI_LABELS.caption}</Label>
          <form.Field name="caption">
            {(field) => (
              <Input
                id={inputId}
                maxLength={MOODBOARD_CAPTION_MAX_LENGTH}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <Button
          disabled={
            api.updateCaption.isPending ||
            captionOrNull(caption) === item.caption
          }
          type="submit"
          variant="outline"
        >
          Save
        </Button>
      </form>
      {formError ? <p role="alert">{formError}</p> : null}
    </>
  );
}
