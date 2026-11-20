import {
  EXPORT_PERSONAL_DATA_LABEL,
  type PersonalDataArtifact,
  type PersonalDataFormat,
  type PersonalDataPreview,
} from "@cantiara/api/personal-data-rights";
import { useMutation } from "@tanstack/react-query";
import { personalDataRefusalMessage } from "../lib/personal-data-refusal";

export function usePersonalDataFlow({
  onPreview,
  onProduce,
}: {
  onPreview: (contactId: string) => Promise<PersonalDataPreview>;
  onProduce: (
    preview: PersonalDataPreview,
    format: PersonalDataFormat,
  ) => Promise<PersonalDataArtifact>;
}) {
  const inspect = useMutation({
    gcTime: 0,
    meta: { presentsSupportFailure: true },
    mutationFn: onPreview,
  });
  const produce = useMutation({
    gcTime: 0,
    meta: { presentsSupportFailure: true },
    mutationFn: ({
      preview,
      format,
    }: {
      preview: PersonalDataPreview;
      format: PersonalDataFormat;
    }) => onProduce(preview, format),
  });
  const failure = produce.error ?? inspect.error;

  return {
    cancel: () => {
      inspect.reset();
      produce.reset();
    },
    async confirm(format: PersonalDataFormat) {
      if (inspect.data && !produce.isPending) {
        await produce
          .mutateAsync({ preview: inspect.data, format })
          .catch(() => undefined);
      }
    },
    pending: inspect.isPending || produce.isPending,
    preview: inspect.data ?? null,
    produced: produce.data ?? null,
    refusal: failure
      ? personalDataRefusalMessage(failure, EXPORT_PERSONAL_DATA_LABEL)
      : null,
    async review(contactId: string) {
      produce.reset();
      await inspect.mutateAsync(contactId).catch(() => undefined);
    },
  };
}
