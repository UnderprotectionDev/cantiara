// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current Moodboard and field handlers.
import { normalizeColorHex } from "@cantiara/api/moodboard-color";
import {
  addColorSwatchInputSchema,
  MOODBOARD_NOTE_MAX_LENGTH,
  MOODBOARD_UI_LABELS,
  type Moodboard,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";

import type { useMoodboards } from "../../hooks/use-moodboards";
import {
  isEyeDropperAvailable,
  pickColorWithEyeDropper,
} from "../../lib/color-sampling";
import { captionOrNull } from "../../lib/moodboard-form";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

export function AddColorSwatchForm({
  api,
  moodboard,
  onStartSampling,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
  onStartSampling: (apply: ((hex: string) => void) | null) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const idPrefix = `moodboard-swatch-${moodboard.id}`;
  const form = useForm({
    defaultValues: { entry: "#808080", note: "", paletteGroupId: "" },
    onSubmit: ({ formApi, value }) => {
      const parsed = addColorSwatchInputSchema.safeParse({
        color: value.entry,
        moodboardId: moodboard.id,
        note: captionOrNull(value.note),
        paletteGroupId: value.paletteGroupId || null,
      });
      if (!parsed.success) {
        setFormError(
          parsed.error.issues[0]?.message ?? "Check the Color Swatch details.",
        );
        return;
      }
      setFormError(null);
      api.addColorSwatch.mutate(
        {
          color: parsed.data.color,
          moodboard,
          note: parsed.data.note,
          paletteGroupId: parsed.data.paletteGroupId,
        },
        { onSuccess: () => formApi.setFieldValue("note", "") },
      );
    },
  });
  const entry = useStore(form.store, (state) => state.values.entry);
  const normalized = normalizeColorHex(entry);

  async function pickFromVisual() {
    if (isEyeDropperAvailable()) {
      const hex = await pickColorWithEyeDropper();
      if (hex) {
        form.setFieldValue("entry", hex);
      }
      return;
    }
    onStartSampling((hex) => {
      form.setFieldValue("entry", hex);
      onStartSampling(null);
    });
  }

  return (
    <form
      aria-label={MOODBOARD_UI_LABELS.addColorSwatch}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        form.handleSubmit().catch(() => undefined);
      }}
    >
      <div className="flex items-end gap-2">
        <Input
          aria-label="Picker"
          className="h-9 w-12 rounded border p-1"
          onChange={(event) => form.setFieldValue("entry", event.target.value)}
          type="color"
          value={normalized?.toLowerCase() ?? "#808080"}
        />
        <div className="flex-1 space-y-1">
          <Label htmlFor={`${idPrefix}-color`}>
            {MOODBOARD_UI_LABELS.color} (
            {MOODBOARD_UI_LABELS.colorSwatchEntryHint})
          </Label>
          <form.Field name="entry">
            {(field) => (
              <Input
                aria-invalid={normalized === null}
                id={`${idPrefix}-color`}
                name={field.name}
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            )}
          </form.Field>
        </div>
        <Button onClick={pickFromVisual} type="button" variant="outline">
          {MOODBOARD_UI_LABELS.eyedrop}
        </Button>
      </div>
      <Label htmlFor={`${idPrefix}-note`}>{MOODBOARD_UI_LABELS.note}</Label>
      <form.Field name="note">
        {(field) => (
          <Input
            id={`${idPrefix}-note`}
            maxLength={MOODBOARD_NOTE_MAX_LENGTH}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Label htmlFor={`${idPrefix}-group`}>
        {MOODBOARD_UI_LABELS.paletteGroup}
      </Label>
      <form.Field name="paletteGroupId">
        {(field) => (
          <NativeSelect
            id={`${idPrefix}-group`}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          >
            <NativeSelectOption value="">
              {MOODBOARD_UI_LABELS.noPaletteGroup}
            </NativeSelectOption>
            {moodboard.paletteGroups.map((group) => (
              <NativeSelectOption key={group.id} value={group.id}>
                {group.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <Button
        disabled={api.addColorSwatch.isPending || normalized === null}
        type="submit"
      >
        {MOODBOARD_UI_LABELS.addColorSwatch}
      </Button>
      {formError ? <p role="alert">{formError}</p> : null}
    </form>
  );
}
