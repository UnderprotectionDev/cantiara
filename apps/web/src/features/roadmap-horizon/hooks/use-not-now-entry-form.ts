import {
  recordWorkNotNowInputSchema,
  type WorkNotNowReviewLaterHandling,
} from "@cantiara/api/work-not-now";
import { useForm } from "@tanstack/react-form";

interface NotNowDraft {
  condition: string;
  groundRelationIds: string[];
  reason: string;
  reviewLaterHandling: WorkNotNowReviewLaterHandling;
}

const EMPTY_DRAFT: NotNowDraft = {
  condition: "",
  groundRelationIds: [],
  reason: "",
  reviewLaterHandling: "Keep Review later",
};

export type NotNowPreview = ReturnType<
  typeof recordWorkNotNowInputSchema.parse
>;

export function useNotNowEntryForm(
  baseRevision: number,
  workId: string,
  onPreview: () => void,
  initialHandling: WorkNotNowReviewLaterHandling = EMPTY_DRAFT.reviewLaterHandling,
) {
  return useForm({
    defaultValues: {
      draft: { ...EMPTY_DRAFT, reviewLaterHandling: initialHandling },
      preview: null as NotNowPreview | null,
    },
    onSubmit: ({ value: { draft: value }, formApi }) => {
      const parsed = recordWorkNotNowInputSchema.safeParse({
        baseRevision,
        clientIdempotencyKey: "preview",
        condition: value.condition,
        groundRelationIds: value.groundRelationIds,
        reason: value.reason,
        reviewLaterHandling: value.reviewLaterHandling,
        workId,
      });
      if (!parsed.success) {
        formApi.setErrorMap({
          onSubmit: {
            form:
              parsed.error.issues[0]?.message ?? "Check the Not now details.",
            fields: {},
          },
        });
        return;
      }
      formApi.setFieldValue("preview", parsed.data);
      onPreview();
    },
  });
}
