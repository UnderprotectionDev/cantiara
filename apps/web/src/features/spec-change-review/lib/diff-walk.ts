/** Pure state of the keyboard / screen-reader walk through changed sections. */
export type DiffWalkDirection = "next" | "previous";

/** Moves between changed sections; it stops at both ends rather than wrapping. */
export function walkIndex(
  current: number | null,
  count: number,
  direction: DiffWalkDirection,
) {
  if (count === 0) {
    return null;
  }
  if (current === null) {
    return direction === "next" ? 0 : count - 1;
  }
  const moved = current + (direction === "next" ? 1 : -1);
  return Math.min(count - 1, Math.max(0, moved));
}

export function walkStatus(
  index: number | null,
  count: number,
  heading: string,
) {
  if (index === null || count === 0) {
    return "";
  }
  return `Change ${index + 1} of ${count}: ${heading}`;
}

export function sectionElementId(reviewId: string, index: number) {
  return `spec-change-${reviewId}-${index}`;
}
