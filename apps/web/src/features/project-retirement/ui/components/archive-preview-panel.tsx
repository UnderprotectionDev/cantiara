import {
  ARCHIVE_PROJECT_LABEL,
  type ArchivePreview,
} from "@cantiara/api/project-retirement";
import { Button } from "@cantiara/ui/components/button";
import { stoppedActivityLabel } from "../../lib/project-retirement-labels";

import { RetirementPreviewList } from "./retirement-preview-list";

/**
 * Archive preview: what the Project leaves, what is moving right now, which
 * approved External Surfaces may live on and which security actions stay
 * open. Nothing is written until the founder confirms.
 */
export function ArchivePreviewPanel({
  busy,
  onCancel,
  onConfirm,
  preview,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  preview: ArchivePreview;
}) {
  return (
    <section
      aria-label="Archive preview"
      className="space-y-4 rounded-lg border p-4"
    >
      <p className="text-sm">
        {preview.project.name} leaves the normal working surfaces. Its{" "}
        {preview.project.status} status does not change.
      </p>
      <RetirementPreviewList
        items={preview.leaves}
        title="Leaves the working surfaces"
      />
      <RetirementPreviewList
        items={preview.stops.map(stoppedActivityLabel)}
        title="Stops while archived"
      />
      <RetirementPreviewList
        items={preview.inFlight.map((work) => ({
          id: `${work.kind}:${work.id}`,
          label: `${work.kind}: ${work.state}`,
        }))}
        title="In-flight work"
      />
      <RetirementPreviewList
        items={preview.surfaces.map((surface) => ({
          id: surface.surfaceId,
          label: `${surface.title} · ${surface.visibility} · ${surface.sourceState}`,
        }))}
        title="Approved External Surfaces that may stay live"
      />
      <RetirementPreviewList
        items={preview.allowedActions.map((entry) => entry.label)}
        title="Security actions that stay open"
      />
      <p className="text-sm text-muted-foreground">{preview.githubNotice}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {ARCHIVE_PROJECT_LABEL}
        </Button>
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}
