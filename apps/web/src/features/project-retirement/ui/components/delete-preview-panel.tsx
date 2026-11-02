import {
  DELETE_PROJECT_CONFIRM_LABEL,
  DELETE_PROJECT_LABEL,
  type DeleteProjectPreview,
} from "@cantiara/api/project-retirement";
import { Button } from "@cantiara/ui/components/button";

function List({ items, title }: { items: string[]; title: string }) {
  return (
    <section aria-label={title} className="space-y-1">
      <h3 className="font-medium text-sm">{title}</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">None.</p>
      ) : (
        <ul className="list-disc space-y-0.5 pl-5 text-sm">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

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
      <List
        items={preview.group.map(
          (member) => `${member.recordKind}: ${member.label}`,
        )}
        title="Delete group"
      />
      <List
        items={preview.revokedSurfaces.map(
          (surface) =>
            `${surface.title} · ${surface.visibility} · revoked now, terminal`,
        )}
        title="External Surfaces revoked immediately"
      />
      {preview.visitorSessionsEnd ? (
        <p className="text-sm">Visitor sessions end immediately.</p>
      ) : null}
      <List
        items={preview.integrationsStop.map(
          (link) => `${link.label} · ${link.state}`,
        )}
        title="Integrations that stop"
      />
      <List
        items={preview.relations.map(
          (relation) =>
            `${relation.sourceLabel} (${relation.scope}) → ${relation.targetLabel} · ${relation.mark}`,
        )}
        title="Relations in other scopes"
      />
      {preview.notices.map((notice) => (
        <p className="text-muted-foreground text-sm" key={notice}>
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
