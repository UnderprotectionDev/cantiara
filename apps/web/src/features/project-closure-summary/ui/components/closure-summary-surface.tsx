import type { ClosureSummarySourceRef } from "@cantiara/api/project-closure-summary";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { accountDateFormatter } from "@/features/account-preferences/lib/account-preferences-format";
import { client, orpc } from "@/utils/orpc";
import { ClosureSummaryView } from "../views/closure-summary-view";

/**
 * Loads the selectable sources of a Project and the Account Preferences for
 * the shared date formatter. Renders nothing unless the Project is completed
 * or abandoned; the draft and the date history are read-only, and only
 * `Save as Document` writes (a Documents create).
 */
export default function ClosureSummarySurface({
  projectId,
}: {
  projectId: string;
}) {
  const sources = useQuery(
    orpc.projectClosureSummarySources.queryOptions({ input: { projectId } }),
  );
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const onDraft = useCallback(
    (selected: ClosureSummarySourceRef[]) =>
      client.projectClosureSummaryDraft({ projectId, sources: selected }),
    [projectId],
  );
  const onDateHistory = useCallback(
    (selected: ClosureSummarySourceRef[]) =>
      client.projectClosureSummaryDateComparison({
        projectId,
        sources: selected,
      }),
    [projectId],
  );
  if (sources.status === "pending") {
    return <p role="status">Loading Closure Summary Draft…</p>;
  }
  if (!sources.data) {
    return <p role="alert">Closure Summary Draft is unavailable.</p>;
  }
  return (
    <ClosureSummaryView
      formatDate={accountDateFormatter(preferences.data)}
      onDateHistory={onDateHistory}
      onDraft={onDraft}
      onSave={client.saveProjectClosureSummary}
      projectId={projectId}
      sources={sources.data}
    />
  );
}
