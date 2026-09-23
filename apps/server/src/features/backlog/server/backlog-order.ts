function uniqueWorkIds(workIds: readonly string[]) {
  return [...new Set(workIds)];
}

export class BacklogOrderMismatchError extends Error {
  readonly code = "BACKLOG_ORDER_MISMATCH" as const;

  constructor() {
    super("Backlog order must include every active Work exactly once.");
    this.name = "BacklogOrderMismatchError";
  }
}

export function normalizeBacklogOrder(
  storedWorkIds: readonly string[],
  allWorkIds: readonly string[],
) {
  const all = uniqueWorkIds(allWorkIds);
  const allSet = new Set(all);
  const ordered = uniqueWorkIds(storedWorkIds).filter((workId) =>
    allSet.has(workId),
  );
  const orderedSet = new Set(ordered);

  return [...ordered, ...all.filter((workId) => !orderedSet.has(workId))];
}

export function applyBacklogOrder(
  storedWorkIds: readonly string[],
  allWorkIds: readonly string[],
  activeWorkIds: readonly string[],
  nextActiveWorkIds: readonly string[],
) {
  const allSet = new Set(allWorkIds);
  const activeSet = new Set(activeWorkIds);
  const nextActiveSet = new Set(nextActiveWorkIds);
  const isCompleteActiveOrder =
    activeSet.size === activeWorkIds.length &&
    nextActiveSet.size === nextActiveWorkIds.length &&
    activeSet.size === nextActiveSet.size &&
    [...activeSet].every(
      (workId) => allSet.has(workId) && nextActiveSet.has(workId),
    );

  if (!isCompleteActiveOrder) {
    throw new BacklogOrderMismatchError();
  }

  const currentOrder = normalizeBacklogOrder(storedWorkIds, allWorkIds);
  let nextIndex = 0;

  return currentOrder.map((workId) => {
    if (!activeSet.has(workId)) {
      return workId;
    }

    const nextWorkId = nextActiveWorkIds[nextIndex];
    nextIndex += 1;
    return nextWorkId ?? workId;
  });
}
