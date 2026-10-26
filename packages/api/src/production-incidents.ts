import { z } from "zod";
import { humanMutationEnvelopeSchema } from "./mutation-and-undo";
import {
  PRODUCTION_INCIDENT_STATUS_OPTIONS,
  type productionIncidentRecordSchema,
} from "./project-source-records";

/**
 * Production Incidents seam (spec 66): the founder's Project-scoped record of
 * a significant operational incident, with its timeline fields and the
 * source-linked context bound to it. The record itself (create, edit, status
 * `Open` / `Watching` / `Resolved`) keeps the Project source record write path
 * (`project-source-records.ts`); this seam owns the links to a Bug, GitHub PR,
 * Project Release, Risk and Decision of the same Project. It has no pager,
 * on-call, status page, downtime, TTD/TTI/TTR or trend operation, and no
 * input path for a service alarm (85) or a Sentry event (19): every write is a
 * human mutation. A link never writes the status or lifecycle of the linked
 * record, never writes the other direction and calls no Completion Effect;
 * binding or creating an incident never creates a Bug, Risk or Work.
 */

const identifier = z.string().trim().min(1).max(255);

export type ProductionIncidentRecord = z.infer<
  typeof productionIncidentRecordSchema
>;
export type ProductionIncidentStatus = ProductionIncidentRecord["status"];

export const PRODUCTION_INCIDENT_LINK_TYPES = [
  "Bug",
  "GitHub PR",
  "Project Release",
  "Risk",
  "Decision",
] as const;
export const productionIncidentLinkTypeSchema = z.enum(
  PRODUCTION_INCIDENT_LINK_TYPES,
);
export type ProductionIncidentLinkType = z.infer<
  typeof productionIncidentLinkTypeSchema
>;

export const productionIncidentsInputSchema = z
  .object({ projectId: identifier })
  .strict();
export const productionIncidentInputSchema = z
  .object({ incidentId: identifier, projectId: identifier })
  .strict();

/**
 * Bind or unbind one record of the same Project. The adapter derives the row
 * id from the full payload, so an identical repeated add reuses its row
 * instead of creating a duplicate link.
 */
export const setProductionIncidentLinkInputSchema = humanMutationEnvelopeSchema
  .extend({
    attached: z.boolean(),
    incidentId: identifier,
    projectId: identifier,
    targetId: identifier,
    targetType: productionIncidentLinkTypeSchema,
  })
  .strict();
export type SetProductionIncidentLinkInput = z.infer<
  typeof setProductionIncidentLinkInputSchema
>;

export interface ProductionIncidentLinkTarget {
  id: string;
  /** Shown name; `null` while the target is archived or in Trash. */
  label: string | null;
  /** The target's own status or life, read-only; `null` while unavailable. */
  status: string | null;
  type: ProductionIncidentLinkType;
  /** Archived or trashed targets stay listed without their content. */
  unavailable: boolean;
}
export interface ProductionIncidentLink {
  attached: boolean;
  id: string;
  revision: number;
  target: ProductionIncidentLinkTarget;
}
export interface ProductionIncidentSummary {
  incident: ProductionIncidentRecord;
  linkCount: number;
}
export interface ProductionIncidentOverview {
  incidents: ProductionIncidentSummary[];
  readOnly: boolean;
}
export interface ProductionIncidentDetail {
  /** Selectable records of this Project by type. */
  candidates: ProductionIncidentLinkTarget[];
  incident: ProductionIncidentRecord;
  /** Link rows, removed rows included so a re-add re-attaches them. */
  links: ProductionIncidentLink[];
  readOnly: boolean;
}

export class ProductionIncidentConflictError extends Error {
  readonly code = "CONFLICT" as const;
  readonly targetId: string;
  constructor(targetId: string, options?: ErrorOptions) {
    super("Production Incident changed. Reload before saving.", options);
    this.name = "ProductionIncidentConflictError";
    this.targetId = targetId;
  }
}

/**
 * The whole seam: read the incidents and their links, and bind or unbind one
 * record. There is deliberately no member that writes an incident, a status
 * or a linked record, and none that accepts an alarm or an error event.
 */
export interface ProductionIncidentsAccess {
  detail: (
    accountId: string,
    input: z.infer<typeof productionIncidentInputSchema>,
  ) => Promise<ProductionIncidentDetail | null>;
  overview: (
    accountId: string,
    projectId: string,
  ) => Promise<ProductionIncidentOverview | null>;
  setLink: (
    accountId: string,
    input: SetProductionIncidentLinkInput,
  ) => Promise<ProductionIncidentLink | null>;
}

/** Status groups of the `Production Incidents` list in the catalog order. */
export function groupProductionIncidentsByStatus<
  T extends { incident: Pick<ProductionIncidentRecord, "status"> },
>(incidents: readonly T[]) {
  return PRODUCTION_INCIDENT_STATUS_OPTIONS.map((status) => ({
    incidents: incidents.filter(
      (summary) => summary.incident.status === status,
    ),
    status,
  })).filter((group) => group.incidents.length > 0);
}

/** Attached links, optionally of one type, in the order they were read. */
export function attachedProductionIncidentLinks(
  links: readonly ProductionIncidentLink[],
  type?: ProductionIncidentLinkType,
) {
  return links.filter(
    (link) => link.attached && (!type || link.target.type === type),
  );
}
