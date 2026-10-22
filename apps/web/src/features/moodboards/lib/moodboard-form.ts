export function captionOrNull(value: string) {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
