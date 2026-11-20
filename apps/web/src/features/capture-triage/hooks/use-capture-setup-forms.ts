import {
  type CaptureAttachPreviewInput,
  type CaptureBindRelation,
  type CaptureConversionTarget,
  type CaptureConvertPreviewInput,
  captureAttachPreviewInputSchema,
  captureConvertPreviewInputSchema,
} from "@cantiara/api/capture-triage";
import { useForm } from "@tanstack/react-form";

export interface CaptureConversionSetupValues {
  projectId: string;
  recordType: CaptureConversionTarget | "";
}

function optionalProjectId(projectId: string) {
  return projectId.trim() || undefined;
}

export function useCaptureConversionSetupForm(
  initialValues: CaptureConversionSetupValues,
  itemId: string,
  onPreview: (input: CaptureConvertPreviewInput) => Promise<unknown>,
) {
  return useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value, formApi }) => {
      const parsed = captureConvertPreviewInputSchema.safeParse({
        itemId,
        projectId: optionalProjectId(value.projectId),
        recordType: value.recordType,
      });
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

export interface CaptureAttachmentSetupValues {
  relation: CaptureBindRelation;
  targetId: string;
}

export function useCaptureAttachmentSetupForm(
  initialValues: CaptureAttachmentSetupValues,
  itemId: string,
  onPreview: (input: CaptureAttachPreviewInput) => Promise<unknown>,
) {
  return useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value, formApi }) => {
      const parsed = captureAttachPreviewInputSchema.safeParse({
        itemId,
        relation: value.relation,
        targetId: value.targetId.trim(),
      });
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
