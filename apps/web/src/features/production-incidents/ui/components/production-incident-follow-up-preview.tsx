import type { ProductionIncidentFollowUpPreview } from "@cantiara/api/production-incidents";
import { Button } from "@cantiara/ui/components/button";

/**
 * Second step of `Create follow-up work`: the Work and the source relations
 * exactly as the commit will write them. Confirming sends the preview's
 * fingerprint; the incident status is shown unchanged.
 */
export function ProductionIncidentFollowUpPreviewView({
  confirming,
  error,
  onBack,
  onConfirm,
  preview,
}: {
  confirming: boolean;
  error: string | null;
  onBack: () => void;
  onConfirm: () => void;
  preview: ProductionIncidentFollowUpPreview;
}) {
  const { plan } = preview;
  return (
    <section aria-label="Follow-up preview" className="space-y-4">
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Work to create</h4>
        <dl className="grid gap-2 text-sm">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Type</dt>
            <dd>{plan.work.type}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Title</dt>
            <dd className="break-words">{plan.work.title}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">Status</dt>
            <dd>{plan.work.status}</dd>
          </div>
          <div className="grid gap-1">
            <dt className="text-muted-foreground">Description</dt>
            <dd className="break-words">{plan.work.description}</dd>
          </div>
        </dl>
      </div>
      <div className="space-y-2">
        <h4 className="font-medium text-sm">Relations to set</h4>
        <ul className="space-y-1 text-sm">
          {plan.relations.map((relation) => (
            <li key={`${relation.kind}:${relation.from.id}`}>
              {relation.kind}: {relation.from.type} {relation.from.label} →{" "}
              {relation.to.type} {relation.to.label}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-muted-foreground text-sm">
        The Production Incident stays {plan.incident.status}. No other Bug, Risk
        or Work is created.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button disabled={confirming} onClick={onConfirm} type="button">
          {confirming ? "Creating…" : "Create follow-up work"}
        </Button>
        <Button
          disabled={confirming}
          onClick={onBack}
          type="button"
          variant="outline"
        >
          Back
        </Button>
      </div>
    </section>
  );
}
