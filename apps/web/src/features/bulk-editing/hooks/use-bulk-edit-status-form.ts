import type {
  WorkClosureResult,
  WorkStatus,
} from "@cantiara/api/work-lifecycle";
import { useForm } from "@tanstack/react-form";
import {
  type BulkEditStatusFormInput,
  bulkEditStatusFormSchema,
} from "../lib/bulk-edit-form";

const DEFAULT_VALUES: {
  closureReason: string;
  closureResult: WorkClosureResult;
  targetStatus: WorkStatus | "";
} = {
  closureReason: "",
  closureResult: "Completed",
  targetStatus: "",
};

export function useBulkEditStatusForm(
  onPreview: (input: BulkEditStatusFormInput) => Promise<void>,
) {
  return useForm({
    defaultValues: DEFAULT_VALUES,
    onSubmit: async ({ value, formApi }) => {
      const parsed = bulkEditStatusFormSchema.safeParse(value);
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: { form: parsed.error.issues[0]?.message, fields: {} },
        });
        return;
      }
      await onPreview(parsed.data);
    },
  });
}
