// biome-ignore-all lint/performance/noJsxPropsBind: Row actions bind to the displayed link or status.

import type { AccountPreferences } from "@cantiara/api/account-preferences";
import {
  attachedProductionIncidentLinks,
  type ProductionIncidentDetail as Detail,
  type ProductionIncidentLink,
  type ProductionIncidentLinkTarget,
  type ProductionIncidentStatus,
} from "@cantiara/api/production-incidents";
import { PRODUCTION_INCIDENT_STATUS_OPTIONS } from "@cantiara/api/project-source-records";
import { Button } from "@cantiara/ui/components/button";
import { useState } from "react";
import { AppLink } from "@/components/app-link";
import { formatAccountDateTime } from "@/features/account-preferences/lib/account-preferences-format";
import { workRecordHref } from "@/features/project-shell/lib/project-shell-navigation";
import {
  PRODUCTION_INCIDENT_LINK_GROUPS,
  PRODUCTION_INCIDENT_TEXT_FIELDS,
  type ProductionIncidentFormValues,
  productionIncidentDraft,
  productionIncidentLinkHref,
  productionIncidentsHref,
} from "../../lib/production-incident-form";
import { ProductionIncidentForm } from "../forms/production-incident-form";
import {
  linkTargetKey,
  ProductionIncidentLinkForm,
} from "../forms/production-incident-link-form";
import {
  type ProductionIncidentFollowUpActions,
  ProductionIncidentFollowUpDialog,
} from "./production-incident-follow-up-dialog";

export interface ProductionIncidentActions
  extends ProductionIncidentFollowUpActions {
  onAddLink: (target: ProductionIncidentLinkTarget) => Promise<unknown>;
  onChangeStatus: (status: ProductionIncidentStatus) => Promise<unknown>;
  onRemoveLink: (link: ProductionIncidentLink) => Promise<unknown>;
  onSave: (values: ProductionIncidentFormValues) => Promise<unknown>;
}

/**
 * Production Incident detail: the record fields, its `Open` / `Watching` /
 * `Resolved` status and the linked records. A link never changes the linked
 * record, and the status never pages anyone.
 */
export function ProductionIncidentDetail({
  actions,
  detail,
  errorMessage,
  formatting,
  projectId,
  savedMessage,
}: {
  actions: ProductionIncidentActions;
  detail: Detail;
  errorMessage?: string;
  formatting: AccountPreferences;
  projectId: string;
  savedMessage?: string;
}) {
  const { incident, readOnly } = detail;
  const [editing, setEditing] = useState(false);
  const attached = attachedProductionIncidentLinks(detail.links);
  const unlinked = detail.candidates.filter(
    (candidate) =>
      !attached.some(
        (link) => linkTargetKey(link.target) === linkTargetKey(candidate),
      ),
  );
  return (
    <section aria-label="Production Incident" className="space-y-8">
      <header className="surface-header space-y-3">
        <AppLink
          className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
          href={productionIncidentsHref(projectId)}
        >
          Production
        </AppLink>
        <p className="text-muted-foreground text-sm">Production Incident</p>
        <h2 className="break-words font-semibold text-2xl tracking-tight">
          {incident.title}
        </h2>
      </header>
      {savedMessage ? (
        <p className="text-sm" role="status">
          {savedMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <p className="text-destructive text-sm" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-8">
          <section aria-label="Incident record" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-medium text-lg">Record</h3>
              {readOnly || editing ? null : (
                <Button
                  onClick={() => setEditing(true)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Edit incident
                </Button>
              )}
            </div>
            {editing ? (
              <ProductionIncidentForm
                draft={productionIncidentDraft(incident, formatting.timeZone)}
                mode="edit"
                onCancel={() => setEditing(false)}
                onSubmit={async (values) => {
                  await actions.onSave(values);
                  setEditing(false);
                }}
                timeZone={formatting.timeZone}
              />
            ) : (
              <dl className="grid gap-3 text-sm">
                <div className="grid gap-1">
                  <dt className="text-muted-foreground">Occurred at</dt>
                  <dd>
                    {formatAccountDateTime(incident.occurredAt, formatting)}
                  </dd>
                </div>
                {PRODUCTION_INCIDENT_TEXT_FIELDS.map(({ label, name }) => (
                  <div className="grid gap-1" key={name}>
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="whitespace-pre-wrap break-words">
                      {incident[name] || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </div>
        <div className="space-y-8">
          <section aria-label="Status" className="space-y-3">
            <h3 className="font-medium text-lg">Status</h3>
            {readOnly ? (
              <p className="font-medium text-sm">{incident.status}</p>
            ) : (
              <fieldset className="flex flex-wrap gap-2">
                <legend className="sr-only">Status</legend>
                {PRODUCTION_INCIDENT_STATUS_OPTIONS.map((status) => (
                  <Button
                    aria-pressed={incident.status === status}
                    key={status}
                    onClick={() => {
                      if (incident.status !== status) {
                        actions.onChangeStatus(status).catch(() => undefined);
                      }
                    }}
                    size="sm"
                    type="button"
                    variant={incident.status === status ? "default" : "outline"}
                  >
                    {status}
                  </Button>
                ))}
              </fieldset>
            )}
            <p className="text-muted-foreground text-sm">
              The status is your own note. It pages no one and changes no linked
              record.
            </p>
          </section>
        </div>
      </div>
      <section aria-label="Follow-up work" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-medium text-lg">Follow-up work</h3>
          {readOnly ? null : (
            <ProductionIncidentFollowUpDialog
              actions={actions}
              incident={incident}
            />
          )}
        </div>
        {detail.followUps.length ? (
          <ul className="divide-y rounded-lg border border-border/70">
            {detail.followUps.map((followUp) => (
              <li className="p-3 text-sm" key={followUp.id}>
                <AppLink
                  className="underline underline-offset-4"
                  href={workRecordHref(projectId, followUp.work.id)}
                >
                  {followUp.work.key}
                  {followUp.work.title ? ` ${followUp.work.title}` : ""}
                </AppLink>
                <span className="ml-2 text-muted-foreground">
                  {followUp.work.type} · {followUp.work.status} · Origin: this
                  Production Incident
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            No follow-up work yet. It is only created after you review a
            preview.
          </p>
        )}
      </section>
      <section aria-label="Linked records" className="space-y-4">
        <h3 className="font-medium text-lg">Linked records</h3>
        {attached.length ? null : (
          <p className="text-muted-foreground text-sm">
            No linked records yet. Link the Bug, GitHub PR, Project Release,
            Risk or Decision this incident taught you about.
          </p>
        )}
        {PRODUCTION_INCIDENT_LINK_GROUPS.map(({ label, type }) => {
          const group = attachedProductionIncidentLinks(detail.links, type);
          return group.length ? (
            <section aria-label={label} className="space-y-2" key={type}>
              <h4 className="font-medium text-sm">{label}</h4>
              <ul className="divide-y rounded-lg border border-border/70">
                {group.map((link) => {
                  const href = productionIncidentLinkHref(
                    projectId,
                    link.target.type,
                    link.target.id,
                  );
                  return (
                    <li
                      className="flex flex-wrap items-center justify-between gap-3 p-3 text-sm"
                      key={link.id}
                    >
                      <span className="min-w-0 break-words">
                        <LinkedRecordLabel href={href} target={link.target} />
                        {link.target.status ? (
                          <span className="ml-2 text-muted-foreground">
                            {link.target.status}
                          </span>
                        ) : null}
                      </span>
                      {readOnly ? null : (
                        <Button
                          onClick={() => {
                            actions.onRemoveLink(link).catch(() => undefined);
                          }}
                          size="sm"
                          type="button"
                          variant="ghost"
                        >
                          Remove link
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null;
        })}
        {readOnly ? null : (
          <ProductionIncidentLinkForm
            candidates={unlinked}
            onAdd={actions.onAddLink}
          />
        )}
      </section>
    </section>
  );
}

function LinkedRecordLabel({
  href,
  target,
}: {
  href: string | null;
  target: ProductionIncidentLinkTarget;
}) {
  if (target.unavailable) {
    return "Unavailable record";
  }
  return href ? (
    <AppLink className="underline underline-offset-4" href={href}>
      {target.label}
    </AppLink>
  ) : (
    target.label
  );
}
