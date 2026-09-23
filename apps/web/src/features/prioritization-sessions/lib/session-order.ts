export function moveWorkInOrder(
  workIds: readonly string[],
  workId: string,
  offset: -1 | 1,
) {
  const currentIndex = workIds.indexOf(workId);
  const nextIndex = currentIndex + offset;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= workIds.length) {
    return [...workIds];
  }

  const next = [...workIds];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
  return next;
}

export function workPosition(workIds: readonly string[], workId: string) {
  const position = workIds.indexOf(workId);
  return position < 0 ? null : position + 1;
}
