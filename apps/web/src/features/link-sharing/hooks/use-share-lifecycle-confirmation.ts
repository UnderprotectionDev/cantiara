import { useForm } from "@tanstack/react-form";

export function useShareConfirmationForm(
  requireAcknowledgment: boolean,
  onConfirm: () => Promise<unknown>,
) {
  return useForm({
    defaultValues: { acknowledged: !requireAcknowledgment },
    onSubmit: async ({ value }) => {
      if (value.acknowledged) {
        await onConfirm();
      }
    },
  });
}
