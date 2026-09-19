export function projectErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "data" in error) {
    const { data } = error;
    if (typeof data === "object" && data !== null && "label" in data) {
      const { label } = data;
      if (typeof label === "string") {
        return label;
      }
    }
  }
  return "Short code could not be saved. Try again.";
}
