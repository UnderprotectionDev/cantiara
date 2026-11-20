// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current Moodboard and field handlers.

import {
  addPaletteGroupInputSchema,
  MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH,
  MOODBOARD_UI_LABELS,
  type Moodboard,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import { useForm, useSelector } from "@tanstack/react-form";
import { submitForm } from "@/lib/submit-form";

import type { useMoodboards } from "../../hooks/use-moodboards";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

export function AddPaletteGroupForm({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const inputId = `moodboard-group-${moodboard.id}`;
  const form = useForm({
    defaultValues: { name: "" },
    onSubmit: async ({ formApi, value }) => {
      const parsed = addPaletteGroupInputSchema.safeParse({
        moodboardId: moodboard.id,
        name: value.name,
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ??
              "Check the Palette group name.",
            fields: {},
          },
        });
        return;
      }
      form.setErrorMap({ onSubmit: undefined });
      await api.addPaletteGroup.mutateAsync({
        moodboard,
        name: parsed.data.name,
      });
      formApi.setFieldValue("name", "");
    },
  });
  const formError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );

  return (
    <>
      <form
        aria-label={MOODBOARD_UI_LABELS.addPaletteGroup}
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          submitForm(form).catch(() => undefined);
        }}
      >
        <div className="flex-1 space-y-1">
          <Label htmlFor={inputId}>{MOODBOARD_UI_LABELS.paletteGroup}</Label>
          <form.Field name="name">
            {(field) => (
              <Input
                id={inputId}
                maxLength={MOODBOARD_PALETTE_GROUP_NAME_MAX_LENGTH}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                required
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <Button
          disabled={api.addPaletteGroup.isPending}
          type="submit"
          variant="outline"
        >
          {MOODBOARD_UI_LABELS.addPaletteGroup}
        </Button>
      </form>
      {formError ? <p role="alert">{formError}</p> : null}
    </>
  );
}
