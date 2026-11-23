import {
  DELETE_PROJECT_CONFIRM_LABEL,
  DELETE_PROJECT_LABEL,
  type DeleteProjectPreview,
} from "@cantiara/api/project-retirement";
import { Button } from "@cantiara/ui/components/button";

import { RetirementPreviewList } from "./retirement-preview-list";

/**
 * Delete Project preview (Archive only): the delete group, the surfaces and
 * visitor sessions revoked now, the integrations that stop, the living
 * relations in other scopes and the no-republish notice. There is no
 * `Keep approved surface` choice on this preview.
 */
export function DeletePreviewPanel({
  busy,
  onCancel,
  onConfirm,
  preview,
}: {
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  preview: DeleteProjectPreview;
}) {
  return (
    <section
      aria-label={`${DELETE_PROJECT_LABEL} preview`}
      className="space-y-4 rounded-lg border p-4"
    >
      <RetirementPreviewList
        items={preview.group.map((member) => ({
          id: `${member.recordKind}:${member.recordId}`,
          label: `${member.recordKind}: ${member.label}`,
        }))}
        title="Delete group"
      />
      <RetirementPreviewList
        items={preview.revokedSurfaces.map((surface) => ({
          id: surface.surfaceId,
          label: `${surface.title} · ${surface.visibility} · revoked now, terminal`,
        }))}
        title="External Surfaces revoked immediately"
      />
      <RetirementPreviewList
        items={preview.ownRemovalSurfaces.map((surface) => ({
          id: surface.surfaceId,
          label: `${surface.title} · ${surface.visibility} · not revoked here`,
        }))}
        title="Build in Public surfaces to remove first"
      />
      {preview.visitorSessionsEnd ? (
        <p className="text-sm">Visitor sessions end immediately.</p>
      ) : null}
      <RetirementPreviewList
        items={preview.integrationsStop.map((link) => ({
          id: link.id,
          label: `${link.label} · ${link.state}`,
        }))}
        title="Integrations that stop"
      />
      <RetirementPreviewList
        items={preview.relations.map((relation) => ({
          id: relation.id,
          label: `${relation.sourceLabel} (${relation.scope}) → ${relation.targetLabel} · ${relation.mark}`,
        }))}
        title="Relations in other scopes"
      />
      {preview.notices.map((notice) => (
        <p className="text-sm text-muted-foreground" key={notice}>
          {notice}
        </p>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={onConfirm}
          type="button"
          variant="destructive"
        >
          {DELETE_PROJECT_CONFIRM_LABEL}
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
