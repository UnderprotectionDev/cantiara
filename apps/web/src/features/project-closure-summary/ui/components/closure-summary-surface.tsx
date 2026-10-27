import type { ClosureSummarySourceRef } from "@cantiara/api/project-closure-summary";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { accountDateFormatter } from "@/features/account-preferences/lib/account-preferences-format";
import { orpc } from "@/utils/orpc";
import { useClosureSummaryDateComparison } from "../../hooks/use-closure-summary-date-comparison";
import { useClosureSummaryDraft } from "../../hooks/use-closure-summary-draft";
import { useSaveClosureSummary } from "../../hooks/use-save-closure-summary";
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
  const draft = useClosureSummaryDraft();
  const { mutateAsync } = draft;
  const onDraft = useCallback(
    (selected: ClosureSummarySourceRef[]) =>
      mutateAsync({ projectId, sources: selected }),
    [mutateAsync, projectId],
  );
  const save = useSaveClosureSummary();
  const { mutateAsync: saveAsync } = save;
  const onSave = useCallback(
    (input: { body: string; clientIdempotencyKey: string; title: string }) =>
      saveAsync({ ...input, baseRevision: 0, projectId }),
    [projectId, saveAsync],
  );
  const dateHistory = useClosureSummaryDateComparison();
  const { mutateAsync: dateHistoryAsync } = dateHistory;
  const onDateHistory = useCallback(
    (selected: ClosureSummarySourceRef[]) =>
      dateHistoryAsync({ projectId, sources: selected }),
    [dateHistoryAsync, projectId],
  );
  if (sources.isPending) {
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
      onSave={onSave}
      projectId={projectId}
      sources={sources.data}
    />
  );
}
