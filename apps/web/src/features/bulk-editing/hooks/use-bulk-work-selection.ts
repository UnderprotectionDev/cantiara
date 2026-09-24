import { createStore } from "@tanstack/react-store";
import { useState } from "react";

function createBulkWorkSelection() {
  const store = createStore({ selectedWorkIds: new Set<string>() });

  function setWorkSelected(workId: string, selected: boolean) {
    store.setState((current) => {
      if (current.selectedWorkIds.has(workId) === selected) {
        return current;
      }

      const selectedWorkIds = new Set(current.selectedWorkIds);
      if (selected) {
        selectedWorkIds.add(workId);
      } else {
        selectedWorkIds.delete(workId);
      }
      return { ...current, selectedWorkIds };
    });
  }

  function clearSelection() {
    store.setState((current) =>
      current.selectedWorkIds.size === 0
        ? current
        : { ...current, selectedWorkIds: new Set<string>() },
    );
  }

  return { clearSelection, setWorkSelected, store };
}

export type BulkWorkSelection = ReturnType<typeof createBulkWorkSelection>;

export function useBulkWorkSelection() {
  const [selection] = useState(createBulkWorkSelection);
  return selection;
}
