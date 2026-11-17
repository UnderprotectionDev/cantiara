// biome-ignore-all lint/performance/noJsxPropsBind: Commands capture the displayed preview and the Work type it was made for.
import {
  FEEDBACK_WORK_TYPES,
  type FeedbackWorkType,
} from "@cantiara/api/feedback";
import { Button } from "@cantiara/ui/components/button";
import { DialogFooter } from "@cantiara/ui/components/dialog";
import { Label } from "@cantiara/ui/components/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@cantiara/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import type { FormEvent, ReactNode } from "react";
import { convertToWorkFormSchema } from "../../lib/feedback-form";

/**
 * The Convert to Work choices: the Work type the preview is made for, then an
 * explicit Confirm. Preview is a separate action that creates nothing.
 */
export function ConvertToWorkForm({
  canConfirm,
  children,
  onClose,
  onConfirm,
  onPreview,
  onWorkTypeChange,
  pending,
  recordId,
}: {
  canConfirm: boolean;
  children: ReactNode;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onPreview: (workType: FeedbackWorkType) => Promise<void>;
  onWorkTypeChange: () => void;
  pending: boolean;
  recordId: string;
}) {
  const form = useForm({
    defaultValues: { workType: "Task" as FeedbackWorkType },
    onSubmit: async ({ value }) => {
      if (!convertToWorkFormSchema.safeParse(value).success) {
        return;
      }
      await onConfirm();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    event.stopPropagation();
    form.handleSubmit().catch(() => undefined);
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <form.Field name="workType">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor={`feedback-work-type-${recordId}`}>Work type</Label>
            <NativeSelect
              disabled={pending}
              id={`feedback-work-type-${recordId}`}
              onChange={(event) => {
                field.handleChange(event.target.value as FeedbackWorkType);
                onWorkTypeChange();
              }}
              value={field.state.value}
            >
              {FEEDBACK_WORK_TYPES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        )}
      </form.Field>
      {children}
      <DialogFooter>
        <Button onClick={onClose} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            onPreview(form.state.values.workType).catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          Preview
        </Button>
        <Button disabled={!canConfirm || pending} type="submit">
          Confirm
        </Button>
      </DialogFooter>
    </form>
  );
}
