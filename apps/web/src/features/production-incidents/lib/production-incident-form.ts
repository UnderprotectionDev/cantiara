import type {
  ProductionIncidentLinkType,
  ProductionIncidentRecord,
} from "@cantiara/api/production-incidents";
import { format, isValid, parse } from "date-fns";
import { z } from "zod";
import {
  projectSourceRecordHash,
  workRecordHref,
} from "@/features/project-shell/lib/project-shell-navigation";

/** The project shell hash of the `Production` area. */
export const PRODUCTION_INCIDENTS_HASH = "project-area-production";

export function productionIncidentsHref(
  projectId: string,
  incidentId?: string,
) {
  const hash = incidentId
    ? projectSourceRecordHash("Production Incident", incidentId)
    : PRODUCTION_INCIDENTS_HASH;
  return `/projects/${encodeURIComponent(projectId)}#${hash}`;
}

/** Record page of a linked record; a GitHub PR has no Cantiara page of its own. */
export function productionIncidentLinkHref(
  projectId: string,
  type: ProductionIncidentLinkType,
  id: string,
) {
  switch (type) {
    case "Bug":
      return workRecordHref(projectId, id);
    case "Project Release":
    case "Risk":
    case "Decision":
      return `/projects/${encodeURIComponent(projectId)}#${projectSourceRecordHash(type, id)}`;
    default:
      return null;
  }
}

const LOCAL_DATE_TIME = "yyyy-MM-dd'T'HH:mm";

/** `datetime-local` text of a stored instant, in the browser's time zone. */
export function incidentTimeInput(value: string) {
  const date = new Date(value);
  return isValid(date) ? format(date, LOCAL_DATE_TIME) : "";
}

/** The stored instant of a `datetime-local` text, or `null` when it is not a time. */
export function incidentTimeInstant(value: string) {
  const date = parse(value, LOCAL_DATE_TIME, new Date());
  return isValid(date) ? date.toISOString() : null;
}

const optionalText = z
  .string()
  .trim()
  .max(20_000)
  .transform((value) => value || null);

/**
 * Production Incident record fields: a title, when it happened and five
 * optional founder-written texts. There is no severity, duration or score.
 */
export const productionIncidentFormSchema = z
  .object({
    detectedHow: optionalText,
    impact: optionalText,
    learning: optionalText,
    occurredAt: z
      .string()
      .trim()
      .transform((value, context) => {
        const instant = incidentTimeInstant(value);
        if (!instant) {
          context.addIssue({ code: "custom", message: "Enter when it began." });
          return z.NEVER;
        }
        return instant;
      }),
    resolution: optionalText,
    rootCause: optionalText,
    title: z.string().trim().min(1).max(255),
  })
  .strict();
export type ProductionIncidentFormValues = z.output<
  typeof productionIncidentFormSchema
>;
export interface ProductionIncidentDraft {
  detectedHow: string;
  impact: string;
  learning: string;
  occurredAt: string;
  resolution: string;
  rootCause: string;
  title: string;
}

export const EMPTY_PRODUCTION_INCIDENT_DRAFT: ProductionIncidentDraft = {
  detectedHow: "",
  impact: "",
  learning: "",
  occurredAt: "",
  resolution: "",
  rootCause: "",
  title: "",
};

export function productionIncidentDraft(
  incident: ProductionIncidentRecord,
): ProductionIncidentDraft {
  return {
    detectedHow: incident.detectedHow ?? "",
    impact: incident.impact ?? "",
    learning: incident.learning ?? "",
    occurredAt: incidentTimeInput(incident.occurredAt),
    resolution: incident.resolution ?? "",
    rootCause: incident.rootCause ?? "",
    title: incident.title,
  };
}

export const PRODUCTION_INCIDENT_TEXT_FIELDS = [
  { label: "Impact", name: "impact" },
  { label: "Detected how", name: "detectedHow" },
  { label: "Resolution", name: "resolution" },
  { label: "Root cause", name: "rootCause" },
  { label: "Learning", name: "learning" },
] as const;

export const PRODUCTION_INCIDENT_LINK_GROUPS = [
  { label: "Bugs", type: "Bug" },
  { label: "GitHub PRs", type: "GitHub PR" },
  { label: "Project Releases", type: "Project Release" },
  { label: "Risks", type: "Risk" },
  { label: "Decisions", type: "Decision" },
] as const satisfies readonly {
  label: string;
  type: ProductionIncidentLinkType;
}[];
