import {
  PRODUCTION_INCIDENT_FOLLOW_UP_TYPES,
  type ProductionIncidentLinkType,
  type ProductionIncidentRecord,
} from "@cantiara/api/production-incidents";
import { isValid } from "date-fns";
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

const LOCAL_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

/** `yyyy-MM-ddTHH:mm` wall clock of `date` in `timeZone`, or `null`. */
function wallClockInTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Map(
      new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric",
      })
        .formatToParts(date)
        .map((part) => [part.type, part.value]),
    );
    const clock = (type: Intl.DateTimeFormatPartTypes) => parts.get(type) ?? "";
    const wall = `${clock("year")}-${clock("month")}-${clock("day")}T${clock("hour")}:${clock("minute")}`;
    return LOCAL_DATE_TIME_PATTERN.test(wall) ? wall : null;
  } catch {
    // An unsupported time zone reads as UTC.
    return null;
  }
}

/** Milliseconds `timeZone` is east of UTC at `date`; an unsupported zone reads as 0. */
function timeZoneOffsetMs(date: Date, timeZone: string) {
  const wall = wallClockInTimeZone(date, timeZone);
  return wall ? Date.parse(`${wall}:00Z`) - date.getTime() : 0;
}

/**
 * `datetime-local` text of a stored instant, in the Account time zone the
 * detail view also displays it in.
 */
export function incidentTimeInput(value: string, timeZone: string) {
  const date = new Date(value);
  return isValid(date) ? (wallClockInTimeZone(date, timeZone) ?? "") : "";
}

/** The stored instant of a `datetime-local` text in `timeZone`, or `null` when it is not a time. */
export function incidentTimeInstant(value: string, timeZone: string) {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) {
    return null;
  }
  const naive = Date.parse(`${value}:00Z`);
  if (Number.isNaN(naive)) {
    return null;
  }
  // Two passes land on the instant whose wall clock in `timeZone` is the
  // entered text, correcting the offset across a DST edge.
  const guess = new Date(naive - timeZoneOffsetMs(new Date(naive), timeZone));
  return new Date(naive - timeZoneOffsetMs(guess, timeZone)).toISOString();
}

const optionalText = z
  .string()
  .trim()
  .max(20_000)
  .transform((value) => value || null);

/**
 * Production Incident record fields: a title, when it happened and five
 * optional founder-written texts. The occurrence time is entered in the
 * Account time zone and stored as an instant. There is no severity, duration
 * or score.
 */
export function productionIncidentFormSchema(timeZone: string) {
  return z
    .object({
      detectedHow: optionalText,
      impact: optionalText,
      learning: optionalText,
      occurredAt: z
        .string()
        .trim()
        .transform((value, context) => {
          const instant = incidentTimeInstant(value, timeZone);
          if (!instant) {
            context.addIssue({
              code: "custom",
              message: "Enter when it began.",
            });
            return z.NEVER;
          }
          return instant;
        }),
      resolution: optionalText,
      rootCause: optionalText,
      title: z.string().trim().min(1).max(255),
    })
    .strict();
}
export type ProductionIncidentFormValues = z.output<
  ReturnType<typeof productionIncidentFormSchema>
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
  timeZone: string,
): ProductionIncidentDraft {
  return {
    detectedHow: incident.detectedHow ?? "",
    impact: incident.impact ?? "",
    learning: incident.learning ?? "",
    occurredAt: incidentTimeInput(incident.occurredAt, timeZone),
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

/** Choice before the preview: the Work type and its title; nothing is written yet. */
export const productionIncidentFollowUpFormSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    workType: z.enum(PRODUCTION_INCIDENT_FOLLOW_UP_TYPES),
  })
  .strict();
export type ProductionIncidentFollowUpValues = z.output<
  typeof productionIncidentFollowUpFormSchema
>;
export interface ProductionIncidentFollowUpDraft {
  title: string;
  workType: ProductionIncidentFollowUpValues["workType"];
}

export function productionIncidentFollowUpDraft(
  incident: Pick<ProductionIncidentRecord, "title">,
): ProductionIncidentFollowUpDraft {
  return {
    title: `Follow up: ${incident.title}`.slice(0, 255),
    workType: "Task",
  };
}
