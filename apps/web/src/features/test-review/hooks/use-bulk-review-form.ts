import { useForm } from "@tanstack/react-form";

export function useBulkReviewForm(onPreview: (ids: string[]) => Promise<void>) {
  return useForm({
    defaultValues: { selected: [] as string[] },
    onSubmit: ({ value }) => onPreview(value.selected),
  });
}
