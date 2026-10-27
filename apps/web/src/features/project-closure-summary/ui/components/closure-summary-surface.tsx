import type { ClosureSummarySourceRef } from "@cantiara/api/project-closure-summary";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { orpc } from "@/utils/orpc";
import { useClosureSummaryDraft } from "../../hooks/use-closure-summary-draft";
import { ClosureSummaryView } from "../views/closure-summary-view";

/**
 * Loads the selectable sources of a Project. Renders nothing unless the
 * Project is completed or abandoned; the draft is read-only and persists
 * nothing.
 */
export default function ClosureSummarySurface({
  projectId,
}: {
  projectId: string;
}) {
  const sources = useQuery(
    orpc.projectClosureSummarySources.queryOptions({ input: { projectId } }),
  );
  const draft = useClosureSummaryDraft();
  const { mutateAsync } = draft;
  const onDraft = useCallback(
    (selected: ClosureSummarySourceRef[]) =>
      mutateAsync({ projectId, sources: selected }),
    [mutateAsync, projectId],
  );
  if (sources.isPending) {
    return <p role="status">Loading Closure Summary Draft…</p>;
  }
  if (!sources.data) {
    return <p role="alert">Closure Summary Draft is unavailable.</p>;
  }
  return (
    <ClosureSummaryView
      onDraft={onDraft}
      projectId={projectId}
      sources={sources.data}
    />
  );
}
