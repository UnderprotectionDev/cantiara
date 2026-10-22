// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CAPTURE_BIND_RELATIONS,
  type CaptureAttachPreviewInput,
  type CaptureBindRelation,
  captureAttachPreviewInputSchema,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent } from "react";

export interface CaptureAttachmentSetupValues {
  relation: CaptureBindRelation;
  targetId: string;
}

export function CaptureAttachmentSetupForm({
  initialValues,
  isOnline,
  itemId,
  onCancel,
  onPreview,
  previewPending,
}: {
  initialValues: CaptureAttachmentSetupValues;
  isOnline: boolean;
  itemId: string;
  onCancel: () => void;
  onPreview: (input: CaptureAttachPreviewInput) => void;
  previewPending: boolean;
}) {
  const form = useForm({
    defaultValues: initialValues,
    onSubmit: ({ value }) => {
      const parsed = captureAttachPreviewInputSchema.safeParse({
        itemId,
        relation: value.relation,
        targetId: value.targetId.trim(),
      });
      if (!parsed.success) {
        return;
      }
      onPreview(parsed.data);
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="space-y-3 border border-border/70 bg-muted/15 p-4"
      onSubmit={submit}
    >
      <h3 className="font-semibold text-sm">Choose existing record</h3>
      <form.Field name="targetId">
        {(field) => (
          <Input
            aria-label="Target record ID"
            name={field.name}
            onChange={(event) => field.handleChange(event.target.value)}
            placeholder="Target record ID"
            value={field.state.value}
          />
        )}
      </form.Field>
      <form.Field name="relation">
        {(field) => (
          <NativeSelect
            aria-label="Relation"
            name={field.name}
            onChange={(event) =>
              field.handleChange(event.target.value as CaptureBindRelation)
            }
            value={field.state.value}
          >
            {CAPTURE_BIND_RELATIONS.map((option) => (
              <NativeSelectOption key={option} value={option}>
                {option}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </form.Field>
      <form.Subscribe selector={(state) => state.values.targetId}>
        {(targetId) => (
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={!(isOnline && targetId.trim()) || previewPending}
              type="submit"
            >
              Preview
            </Button>
            <Button onClick={onCancel} type="button" variant="outline">
              Cancel
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
