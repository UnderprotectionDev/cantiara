// biome-ignore-all lint/performance/noJsxPropsBind: The retry handler binds to this query.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import { TRASH_LABEL } from "@cantiara/api/trash";
import { Button } from "@cantiara/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/utils/orpc";
import { useMoveToTrash } from "../../hooks/use-move-to-trash";
import { usePreviewMoveToTrash } from "../../hooks/use-move-to-trash-preview";
import { usePermanentDeleteFromTrash } from "../../hooks/use-permanent-delete-from-trash";
import { usePreviewRestoreFromTrash } from "../../hooks/use-preview-restore-from-trash";
import { useRestoreFromTrash } from "../../hooks/use-restore-from-trash";
import { trashCandidates } from "../../lib/trash-candidates";
import { TrashView } from "../views/trash-view";

/** Loads the Trash entries and the live records that can move into it. */
export default function TrashSurface({ projectId }: { projectId: string }) {
  const input = { projectId };
  const trash = useQuery(orpc.trash.queryOptions({ input }));
  const risks = useQuery(orpc.projectRisks.queryOptions({ input }));
  const decisions = useQuery(orpc.projectDecisions.queryOptions({ input }));
  const customFields = useQuery(orpc.customFields.queryOptions({ input }));
  const workTemplates = useQuery(orpc.workTemplates.queryOptions({ input }));
  const automationRules = useQuery(
    orpc.workAutomationRules.queryOptions({ input }),
  );
  const documentTemplates = useQuery(
    orpc.documentTemplates.queryOptions({ input }),
  );
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const move = useMoveToTrash(projectId);
  const preview = usePreviewMoveToTrash(projectId);
  const restore = useRestoreFromTrash(projectId);
  const permanentDelete = usePermanentDeleteFromTrash(projectId);
  const restorePreview = usePreviewRestoreFromTrash(projectId);

  const candidates = useMemo(
    () =>
      trashCandidates({
        automationRules: automationRules.data,
        customFields: customFields.data,
        decisions: decisions.data?.records,
        documentTemplates: documentTemplates.data,
        risks: risks.data?.records,
        workTemplates: workTemplates.data,
      }),
    [
      automationRules.data,
      customFields.data,
      decisions.data,
      documentTemplates.data,
      risks.data,
      workTemplates.data,
    ],
  );

  if (trash.isPending) {
    return <p role="status">Loading {TRASH_LABEL}…</p>;
  }
  if (trash.isError || !trash.data) {
    return (
      <div className="space-y-3">
        <p role="alert">{TRASH_LABEL} is unavailable.</p>
        <Button
          onClick={() => {
            trash.refetch().catch(() => undefined);
          }}
          type="button"
          variant="outline"
        >
          Retry
        </Button>
      </div>
    );
  }
  return (
    <TrashView
      candidates={candidates}
      entries={trash.data.entries}
      formatting={preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES}
      onMove={move}
      onPreview={preview}
      onRestore={restore}
      onRestorePreview={restorePreview}
      permanentDelete={permanentDelete}
    />
  );
}
