import { useForm } from "@tanstack/react-form";
import { upEditFormSchema } from "../lib/schema-artifact-form-schemas";

export function useUpEditForm() {
  return useForm({
    defaultValues: {
      upSql: null as string | null,
      submitted: null as string | null,
    },
    onSubmitMeta: { currentSql: "" },
    onSubmit: ({ formApi, meta, value }) => {
      const parsed = upEditFormSchema.safeParse({
        upSql: value.upSql ?? meta.currentSql,
      });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: { form: parsed.error.issues[0]?.message, fields: {} },
        });
        return;
      }
      formApi.setFieldValue("submitted", parsed.data.upSql);
    },
  });
}
