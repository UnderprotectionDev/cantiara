import { useState } from "react";

export function useBulkWorkSelection() {
  const [selectedWorkIds, setSelectedWorkIds] = useState<Set<string>>(
    () => new Set(),
  );

  function setWorkSelected(workId: string, selected: boolean) {
    setSelectedWorkIds((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(workId);
      } else {
        next.delete(workId);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedWorkIds(new Set());
  }

  return { clearSelection, selectedWorkIds, setWorkSelected };
}
