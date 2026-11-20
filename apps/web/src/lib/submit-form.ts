/**
 * Clear the previous attempt's submit error before asking Form to validate
 * again. Other validation errors still participate in the new submission.
 */
export function submitForm<TMeta>(
  form: {
    handleSubmit: (meta?: TMeta) => Promise<void>;
    setErrorMap: (errorMap: { onSubmit: undefined }) => void;
    state: { isSubmitting: boolean };
  },
  meta?: TMeta,
): Promise<void> {
  if (form.state.isSubmitting) {
    return Promise.resolve();
  }
  form.setErrorMap({ onSubmit: undefined });
  return form.handleSubmit(meta);
}
