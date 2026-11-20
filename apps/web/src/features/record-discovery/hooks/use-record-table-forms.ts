import { useForm } from "@tanstack/react-form";

export function useRecordTableCellForm(
  initialValue: string,
  onSave: (value: string) => Promise<void>,
) {
  return useForm({
    defaultValues: { value: initialValue },
    onSubmit: ({ value }) => onSave(value.value),
  });
}

export function useRecordTablePasteReviewForm() {
  return useForm({
    defaultValues: {
      columnIds: [] as string[],
      corrections: {} as Record<string, string>,
      createRecordIds: [] as string[],
      excludedRows: [] as number[],
      headers: [] as string[],
      mappings: [] as string[],
      rawRows: [] as string[][],
      rowIds: [] as string[],
    },
  });
}
