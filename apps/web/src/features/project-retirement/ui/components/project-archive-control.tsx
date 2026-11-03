// biome-ignore-all lint/performance/noJsxPropsBind: Handlers bind to this surface state.

import {
  ARCHIVE_LABEL,
  PROJECT_ARCHIVED_BANNER,
} from "@cantiara/api/project-retirement";
import { Button } from "@cantiara/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  useArchivedProjects,
  useArchivePreview,
  useRetirementTransition,
} from "../../hooks/use-project-retirement";
import { ArchivePreviewPanel } from "./archive-preview-panel";

/**
 * On a working Project: `Archive`, which opens the preview first. On an
 * archived Project: the read-only banner and a way to the Archive view.
 */
export default function ProjectArchiveControl({
  projectId,
}: {
  projectId: string;
}) {
  const archived = useArchivedProjects();
  const [previewing, setPreviewing] = useState(false);
  const preview = useArchivePreview(projectId, previewing);
  const transition = useRetirementTransition();

  if (archived.isPending) {
    return null;
  }

  if (archived.data?.projects.some((entry) => entry.project.id === projectId)) {
    return (
      <div
        className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 p-4 text-sm"
        role="status"
      >
        <p className="font-medium">{PROJECT_ARCHIVED_BANNER}</p>
        <Link className="underline underline-offset-4" to="/archive">
          Open the Archive
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-3">
      {previewing ? null : (
        <Button
          className="min-h-11"
          onClick={() => setPreviewing(true)}
          type="button"
          variant="outline"
        >
          {ARCHIVE_LABEL}
        </Button>
      )}
      {previewing && preview.isPending ? <p>Loading…</p> : null}
      {previewing && preview.isError ? (
        <p role="alert">The archive preview could not be loaded.</p>
      ) : null}
      {previewing && preview.data ? (
        <ArchivePreviewPanel
          busy={transition.isPending}
          onCancel={() => setPreviewing(false)}
          onConfirm={() =>
            transition.mutate(
              {
                action: "archive",
                baseRevision: preview.data.project.revision,
                projectId,
              },
              { onSuccess: () => setPreviewing(false) },
            )
          }
          preview={preview.data}
        />
      ) : null}
      {transition.isError ? (
        <p role="alert">Archive did not complete. Review the preview again.</p>
      ) : null}
    </div>
  );
}
