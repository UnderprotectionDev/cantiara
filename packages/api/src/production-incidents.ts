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
export const PRODUCTION_INCIDENT_FOLLOW_UP_LABEL = "Create follow-up work";
/** Follow-up Work types the founder may pick; `Bug` only by that explicit choice. */
export const PRODUCTION_INCIDENT_FOLLOW_UP_TYPES = [
  "Task",
  "Bug",
  "Research",
  "Improvement",
] as const;
export const productionIncidentFollowUpTypeSchema = z.enum(
  PRODUCTION_INCIDENT_FOLLOW_UP_TYPES,
);
export type ProductionIncidentFollowUpType = z.infer<
  typeof productionIncidentFollowUpTypeSchema
>;

/** What the founder chooses before the preview: the Work type and its title. */
export const previewProductionIncidentFollowUpInputSchema = z
  .object({
    incidentId: identifier,
    projectId: identifier,
    title: z.string().trim().min(1).max(255),
    workType: productionIncidentFollowUpTypeSchema,
  })
  .strict();
export type PreviewProductionIncidentFollowUpInput = z.infer<
  typeof previewProductionIncidentFollowUpInputSchema
>;

/**
 * The commit repeats the previewed choice and must carry the fingerprint of
 * that exact preview; without it, or with another one, nothing is written.
 */
export const createProductionIncidentFollowUpInputSchema =
  humanMutationEnvelopeSchema
    .extend({
      incidentId: identifier,
      previewFingerprint: z.string().trim().min(1).max(255),
      projectId: identifier,
      title: z.string().trim().min(1).max(255),
      workId: identifier,
      workType: productionIncidentFollowUpTypeSchema,
    })
    .strict();
export type CreateProductionIncidentFollowUpInput = z.infer<
  typeof createProductionIncidentFollowUpInputSchema
>;

/** The Work and the source relations shown before anything is written. */
export interface ProductionIncidentFollowUpPlan {
  incident: {
    id: string;
    revision: number;
    status: ProductionIncidentStatus;
    title: string;
  };
  /** Source relations set by the commit; the incident is the Origin. */
  relations: {
    from: { id: string; label: string; type: "Production Incident" };
    kind: "Origin";
    to: { label: string; type: "Work" };
  }[];
  work: {
    description: string;
    status: "Not Started";
    title: string;
    type: ProductionIncidentFollowUpType;
  };
}
export interface ProductionIncidentFollowUpPreview {
  fingerprint: string;
  plan: ProductionIncidentFollowUpPlan;
}
export interface ProductionIncidentFollowUp {
  createdAt: string;
  id: string;
  work: {
    id: string;
    key: string;
    status: string;
    title: string | null;
    type: string;
    unavailable: boolean;
  };
}

export class ProductionIncidentFollowUpStaleError extends Error {
  readonly code = "PREVIEW_STALE" as const;
  readonly targetId: string;
  constructor(targetId: string, options?: ErrorOptions) {
    super("The preview changed. Review it again before creating.", options);
    this.name = "ProductionIncidentFollowUpStaleError";
    this.targetId = targetId;
  }
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
  followUps: ProductionIncidentFollowUp[];
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
 * The whole seam: read the incidents and their links, bind or unbind one
 * record, and create follow-up Work after its preview. There is deliberately
 * no member that writes an incident, a status or a linked record, and none
 * that accepts an alarm or an error event.
 */
export interface ProductionIncidentsAccess {
  /** Writes the previewed Work only when the fingerprint matches the live preview. */
  createFollowUp: (
    accountId: string,
    input: CreateProductionIncidentFollowUpInput,
  ) => Promise<ProductionIncidentFollowUp | null>;
  detail: (
    accountId: string,
    input: z.infer<typeof productionIncidentInputSchema>,
  ) => Promise<ProductionIncidentDetail | null>;
  overview: (
    accountId: string,
    projectId: string,
  ) => Promise<ProductionIncidentOverview | null>;
  /** Read-only: the Work and relations a commit would create. */
  previewFollowUp: (
    accountId: string,
    input: PreviewProductionIncidentFollowUpInput,
  ) => Promise<ProductionIncidentFollowUpPreview | null>;
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
