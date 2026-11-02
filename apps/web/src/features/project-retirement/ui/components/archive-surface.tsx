// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface state.

import { DEFAULT_ACCOUNT_PREFERENCES } from "@cantiara/api/account-preferences";
import type { ArchivedProjectEntry } from "@cantiara/api/project-retirement";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { orpc } from "@/utils/orpc";
import {
  useArchivedProjects,
  useDeletePreview,
  useDeleteProject,
  useRestoreToArchive,
  useRetirementTransition,
} from "../../hooks/use-project-retirement";
import { ArchiveView } from "../views/archive-view";
import { DeletePreviewPanel } from "./delete-preview-panel";

/** The Archive route surface: archived Projects and `Unarchive`. */
export default function ArchiveSurface() {
  const archived = useArchivedProjects();
  const transition = useRetirementTransition();
  const preferences = useQuery(orpc.accountPreferences.queryOptions());
  const [deleting, setDeleting] = useState<ArchivedProjectEntry | null>(null);
  const preview = useDeletePreview(deleting?.project.id ?? null);
  const remove = useDeleteProject();
  const restore = useRestoreToArchive();

  let errorMessage: string | null = null;
  if (restore.isError) {
    errorMessage = "Restore to Archive did not complete. Try again.";
  } else if (transition.isError) {
    errorMessage = "Unarchive did not complete. Try again.";
  }

  return (
    <ArchiveView
      deletePanel={
        deleting && preview.data
          ? {
              node: (
                <DeletePreviewPanel
                  busy={remove.isPending}
                  onCancel={() => setDeleting(null)}
                  onConfirm={() =>
                    remove.mutate(
                      {
                        baseRevision: deleting.project.revision,
                        projectId: deleting.project.id,
                      },
                      { onSuccess: () => setDeleting(null) },
                    )
                  }
                  preview={preview.data}
                />
              ),
              projectId: deleting.project.id,
            }
          : null
      }
      error={archived.isError}
      errorMessage={errorMessage}
      formatting={preferences.data ?? DEFAULT_ACCOUNT_PREFERENCES}
      loading={archived.isPending}
      onDelete={setDeleting}
      onRestore={(entry: ArchivedProjectEntry) => {
        if (entry.trash) {
          restore.mutate({
            baseRevision: entry.trash.baseRevision,
            entryId: entry.trash.entryId,
            projectId: entry.project.id,
          });
        }
      }}
      onUnarchive={(entry: ArchivedProjectEntry) =>
        transition.mutate({
          action: "unarchive",
          baseRevision: entry.project.revision,
          projectId: entry.project.id,
        })
      }
      pendingProjectId={
        (restore.isPending ? restore.variables?.projectId : null) ??
        (transition.isPending ? transition.variables?.projectId : null)
      }
      projects={archived.data?.projects ?? []}
    />
  );
}
