// biome-ignore-all lint/performance/noJsxPropsBind: Form field render props close over the current field handlers.
import {
  CAPTURE_BIND_RELATIONS,
  type CaptureBindRelation,
} from "@cantiara/api/capture-triage";
import { Button } from "@cantiara/ui/components/button";
import { Input } from "@cantiara/ui/components/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import type { SubmitEvent } from "react";
import type { useCaptureAttachmentSetupForm } from "../../hooks/use-capture-setup-forms";

export function CaptureAttachmentSetupForm({
  form,
  isOnline,
  onCancel,
  previewPending,
}: {
  form: ReturnType<typeof useCaptureAttachmentSetupForm>;
  isOnline: boolean;
  onCancel: () => void;
  previewPending: boolean;
}) {
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.setErrorMap({ onSubmit: undefined });
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form
      className="space-y-3 border border-border/70 bg-muted/15 p-4"
      onSubmit={submit}
    >
      <form.Subscribe selector={(state): unknown => state.errorMap.onSubmit}>
        {(error) =>
          typeof error === "string" ? <p role="alert">{error}</p> : null
        }
      </form.Subscribe>
      <h3 className="text-sm font-semibold">Choose existing record</h3>
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
