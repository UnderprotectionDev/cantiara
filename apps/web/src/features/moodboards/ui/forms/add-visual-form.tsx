// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current Moodboard and field handlers.

import {
  addMoodboardVisualInputSchema,
  MOODBOARD_CAPTION_MAX_LENGTH,
  MOODBOARD_UI_LABELS,
  type Moodboard,
} from "@cantiara/api/moodboards";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import { Label } from "@cantiara/ui/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@cantiara/ui/components/radio-group";
import { useForm, useSelector } from "@tanstack/react-form";
import { submitForm } from "@/lib/submit-form";

import type { useMoodboards } from "../../hooks/use-moodboards";
import { captionOrNull } from "../../lib/moodboard-form";

type MoodboardsApi = ReturnType<typeof useMoodboards>;

type OriginKind = "External link" | "File Attachment version";

const ORIGIN_KINDS: readonly OriginKind[] = [
  "External link",
  "File Attachment version",
];

export function AddVisualForm({
  api,
  moodboard,
}: {
  api: MoodboardsApi;
  moodboard: Moodboard;
}) {
  const idPrefix = `moodboard-add-${moodboard.id}`;
  const form = useForm({
    defaultValues: {
      caption: "",
      originKind: "External link" as OriginKind,
      reference: "",
    },
    onSubmit: async ({ formApi, value }) => {
      const reference = value.reference.trim();
      const parsed = addMoodboardVisualInputSchema.safeParse({
        caption: captionOrNull(value.caption),
        moodboardId: moodboard.id,
        origin:
          value.originKind === "External link"
            ? { kind: "External link", url: reference }
            : {
                attachmentVersionId: reference,
                kind: "File Attachment version",
              },
      });
      if (!parsed.success) {
        form.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ?? "Check the Visual details.",
            fields: {},
          },
        });
        return;
      }
      form.setErrorMap({ onSubmit: undefined });
      await api.addVisual.mutateAsync({
        caption: parsed.data.caption,
        moodboard,
        origin: parsed.data.origin,
      });
      formApi.setFieldValue("reference", "");
      formApi.setFieldValue("caption", "");
    },
  });
  const formError = useSelector(
    form.store,
    (state): string | undefined => state.errorMap.onSubmit,
  );
  const originKind = useSelector(
    form.store,
    (state) => state.values.originKind,
  );

  return (
    <form
      aria-label={MOODBOARD_UI_LABELS.addVisual}
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        submitForm(form).catch(() => undefined);
      }}
    >
      <form.Field name="originKind">
        {(field) => (
          <fieldset>
            <legend className="sr-only">Origin</legend>
            <RadioGroup
              className="flex w-auto gap-4"
              name={`${idPrefix}-origin`}
              onValueChange={(next) => {
                const kind = ORIGIN_KINDS.find((option) => option === next);
                if (kind) {
                  field.handleChange(kind);
                }
              }}
              value={field.state.value}
            >
              {ORIGIN_KINDS.map((kind) => (
                <label
                  className="inline-flex items-center gap-1"
                  htmlFor={`${idPrefix}-origin-${kind === "External link" ? "link" : "attachment"}`}
                  key={kind}
                >
                  <RadioGroupItem
                    id={`${idPrefix}-origin-${kind === "External link" ? "link" : "attachment"}`}
                    value={kind}
                  />
                  {kind === "External link"
                    ? MOODBOARD_UI_LABELS.externalLink
                    : MOODBOARD_UI_LABELS.fileAttachmentVersion}
                </label>
              ))}
            </RadioGroup>
          </fieldset>
        )}
      </form.Field>
      <Label htmlFor={`${idPrefix}-reference`}>
        {originKind === "External link"
          ? MOODBOARD_UI_LABELS.externalLink
          : `${MOODBOARD_UI_LABELS.fileAttachmentVersion} ID`}
      </Label>
      <form.Field name="reference">
        {(field) => (
          <Input
            id={`${idPrefix}-reference`}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            required
            value={field.state.value}
          />
        )}
      </form.Field>
      <Label htmlFor={`${idPrefix}-caption`}>
        {MOODBOARD_UI_LABELS.caption}
      </Label>
      <form.Field name="caption">
        {(field) => (
          <Input
            id={`${idPrefix}-caption`}
            maxLength={MOODBOARD_CAPTION_MAX_LENGTH}
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button disabled={api.addVisual.isPending} type="submit">
        {MOODBOARD_UI_LABELS.addVisual}
      </Button>
      {formError ? <p role="alert">{formError}</p> : null}
    </form>
  );
}
