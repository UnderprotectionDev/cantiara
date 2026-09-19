interface SequentialTriageCompleteState {
  itemIds: readonly string[];
  mode: "complete";
  resolvedItemIds: readonly string[];
}

interface SequentialTriageFocusedState {
  itemId: string;
  itemIds: readonly string[];
  itemIndex: number;
  mode: "focused";
  resolvedItemIds: readonly string[];
}

export type SequentialTriageState =
  | SequentialTriageCompleteState
  | SequentialTriageFocusedState
  | { mode: "list" };

function focusItem(
  state: SequentialTriageFocusedState,
  itemIndex: number,
): SequentialTriageFocusedState {
  const itemId = state.itemIds[itemIndex];
  if (!itemId) {
    return state;
  }

  return {
    ...state,
    itemId,
    itemIndex,
  };
}

export function beginSequentialTriage(
  orderedItemIds: readonly string[],
): SequentialTriageState {
  const [firstItemId] = orderedItemIds;
  if (!firstItemId) {
    return {
      itemIds: [],
      mode: "complete",
      resolvedItemIds: [],
    };
  }

  return {
    itemId: firstItemId,
    itemIndex: 0,
    itemIds: [...orderedItemIds],
    mode: "focused",
    resolvedItemIds: [],
  };
}

export function moveToPreviousSequentialTriageItem(
  state: SequentialTriageState,
): SequentialTriageState {
  if (state.mode !== "focused" || state.itemIndex <= 0) {
    return state;
  }

  return focusItem(state, state.itemIndex - 1);
}

export function moveToNextSequentialTriageItem(
  state: SequentialTriageState,
): SequentialTriageState {
  if (
    state.mode !== "focused" ||
    !state.resolvedItemIds.includes(state.itemId) ||
    state.itemIndex >= state.itemIds.length - 1
  ) {
    return state;
  }

  return focusItem(state, state.itemIndex + 1);
}

export function advanceSequentialTriageAfterExit(
  state: SequentialTriageState,
): SequentialTriageState {
  if (
    state.mode !== "focused" ||
    state.resolvedItemIds.includes(state.itemId)
  ) {
    return state;
  }

  const resolvedItemIds = [...state.resolvedItemIds, state.itemId];
  if (state.itemIndex >= state.itemIds.length - 1) {
    return {
      itemIds: state.itemIds,
      mode: "complete",
      resolvedItemIds,
    };
  }

  return focusItem(
    {
      ...state,
      resolvedItemIds,
    },
    state.itemIndex + 1,
  );
}

export function restoreSequentialTriageItem(
  state: SequentialTriageState,
  itemId: string,
): SequentialTriageState {
  if (state.mode === "list" || !state.resolvedItemIds.includes(itemId)) {
    return state;
  }

  const resolvedItemIds = state.resolvedItemIds.filter(
    (resolvedItemId) => resolvedItemId !== itemId,
  );
  if (state.mode === "complete") {
    return {
      itemId,
      itemIds: state.itemIds,
      itemIndex: state.itemIds.indexOf(itemId),
      mode: "focused",
      resolvedItemIds,
    };
  }

  return {
    ...state,
    resolvedItemIds,
  };
}

export function leaveSequentialTriage(): SequentialTriageState {
  return { mode: "list" };
}
