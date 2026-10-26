import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  groupProductionIncidentsByStatus,
  type ProductionIncidentOverview,
} from "@cantiara/api/production-incidents";
import type { ReactNode } from "react";
import { AppLink } from "@/components/app-link";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { productionIncidentsHref } from "../../lib/production-incident-form";

/** Production Incidents: status-grouped, scannable list of one Project's incidents. */
export function ProductionIncidentList({
  createControl,
  formatting,
  overview,
  projectId,
}: {
  createControl?: ReactNode;
  formatting: AccountPreferences;
  overview: ProductionIncidentOverview;
  projectId: string;
}) {
  const groups = groupProductionIncidentsByStatus(overview.incidents);
  return (
    <section aria-label="Production Incidents" className="space-y-6">
      <header className="surface-header flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">Production</p>
          <h2 className="font-semibold text-2xl tracking-tight">
            Production Incidents
          </h2>
        </div>
        {overview.readOnly ? null : <div>{createControl}</div>}
      </header>
      {overview.readOnly ? (
        <p className="text-muted-foreground text-sm">
          This Project is archived. Its Production Incidents are read-only.
        </p>
      ) : null}
      {groups.length ? null : (
        <p className="text-muted-foreground">
          A Production Incident records what happened and what you learned. It
          is not a Bug, and it pages no one.
        </p>
      )}
      {groups.map(({ incidents, status }) => (
        <section aria-label={status} className="space-y-2" key={status}>
          <h3 className="font-medium text-sm">
            {status}{" "}
            <span className="text-muted-foreground">({incidents.length})</span>
          </h3>
          <ul className="divide-y rounded-lg border border-border/70">
            {incidents.map(({ incident, linkCount }) => (
              <li key={incident.id}>
                <AppLink
                  className="grid gap-1 p-4 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_auto]"
                  href={productionIncidentsHref(projectId, incident.id)}
                >
                  <span className="min-w-0 break-words font-medium">
                    {incident.title}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {incident.status}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {formatAccountDateTime(incident.occurredAt, formatting)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {linkCount === 1
                      ? "1 linked record"
                      : `${linkCount} linked records`}
                  </span>
                </AppLink>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
